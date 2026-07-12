/**
 * useBackgroundRecorder — the M2 recorder behind Map Record
 * (map-tab.md §7 M2; built against gps-recording-expo.md §11).
 *
 * Same surface as useGpsTracker (status/points/errorMessage/start/stop/
 * reset), same lazy-native-import posture, ONE deliberate contract change:
 * stop() is async — the authoritative track lives in the SQLite recording
 * buffer (written by the headless task), not an in-memory ref, so reading
 * it back is a query. "SQLite is the recording, React state a cache."
 *
 * What this hook deliberately does NOT do:
 *  - it never tears the recording down on unmount. Navigating off the Map
 *    tab leaves the OS task recording; remounting re-attaches to the live
 *    state via attach(). Only Stop/discard end a recording.
 *  - no live auto-pause (research §6) and no pause/resume at MVP — Stop is
 *    the only interrupt.
 *  - it never starts over an in-flight recording: a surviving buffer row
 *    surfaces as `recoverable` (the "finish the partial session" banner)
 *    instead of being silently overwritten.
 *
 * Concurrency posture (post-review hardening): start() takes a synchronous
 * re-entrancy guard at entry (a double-tap's second call no-ops); discard()
 * during 'starting' flags an abort the in-flight start() honors at its next
 * await-boundary; the poll skips overlapping runs and re-checks the
 * recording id after every await so a stop/discard can never be overwritten
 * by a stale resolve; every failure path tears the OS task down rather than
 * leaving it running behind an 'error' status.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '@core/observation';
import {
  startRecording,
  getActiveRecording,
  getFixesAfter,
  getBufferedPoints,
  stopRecording,
  clearRecording,
  type RecordingElement,
  type RecordingSession,
} from '@/storage/recordingBuffer';
import { RECORDING_TASK, RECORDING_UPDATE_OPTIONS } from '@/lib/recording/recordingTask';
import { haversineM } from '@/lib/geo';

export type RecorderStatus =
  | 'idle' // not recording
  | 'starting' // permission + task start pending
  | 'tracking' // OS task live, buffer filling
  | 'denied' // location permission refused (honest floor: log by hand)
  | 'unavailable' // native module missing — this dev build predates M2
  | 'error';

/** GPS quality for the live chip, derived HONESTLY from the gate: fixes
 *  landing → the newest fix's accuracy band; only drops landing (all fixes
 *  gated out for accuracy) → 'weak' — the gate means stored accuracy can
 *  never exceed the 50 m threshold, so the chip must read the drop counter,
 *  not the stored values, to ever say "weak". */
export type GpsQuality = 'unknown' | 'good' | 'weak';

export type StoppedRecording = {
  recordingId: string;
  activityId: string;
  element: RecordingElement;
  startedAt: string;
  /** Canonical clean GeoPoints, buffer-authoritative (the poll mirror may
   *  trail by one undelivered batch). */
  points: GeoPoint[];
};

export type BackgroundRecorder = {
  status: RecorderStatus;
  /** Live mirror of the buffer, refreshed by an incremental poll. */
  points: GeoPoint[];
  errorMessage: string | null;
  /** Live accumulated distance (m) — incremental, so the panel never
   *  re-walks a multi-hour track. */
  distanceM: number;
  gpsQuality: GpsQuality;
  /** ISO instant Record was tapped — drives the elapsed clock. */
  startedAt: string | null;
  /** An in-flight recording found on attach that the OS task is no longer
   *  feeding (iOS swipe-kill, reboot, or a kill between Stop and save) —
   *  the "finish the partial session" banner's subject. */
  recoverable: RecordingSession | null;
  /** Ask permission, open the buffer, start OS location updates. */
  start: (input: { activityId: string; element: RecordingElement }) => Promise<void>;
  /** End the recording (live or recovered) and hand back everything
   *  buffered plus the session identity it was recorded under. The buffer
   *  row survives (status 'stopped') until save/discard clears it. */
  stop: () => Promise<StoppedRecording | null>;
  /** Discard an in-flight or recovered recording: teardown + clear buffer.
   *  During 'starting' it aborts the in-flight start instead. */
  discard: (recordingId?: string) => Promise<void>;
  /** Re-check for a live or recoverable recording (runs on mount too). */
  attach: () => Promise<void>;
};

const POLL_MS = 2500;

async function loadLocation(): Promise<typeof import('expo-location') | null> {
  try {
    return await import('expo-location');
  } catch {
    return null; // native module missing in this dev build
  }
}

/** Stops OS updates if (and only if) the task is actually running — never
 *  throws: teardown must always be safe to call. */
async function stopOsUpdates(): Promise<void> {
  const Location = await loadLocation();
  if (!Location) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)) {
      await Location.stopLocationUpdatesAsync(RECORDING_TASK);
    }
  } catch {
    /* already stopped, or task never registered on this build */
  }
}

export function useBackgroundRecorder(): BackgroundRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [distanceM, setDistanceM] = useState(0);
  const [gpsQuality, setGpsQuality] = useState<GpsQuality>('unknown');
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<RecordingSession | null>(null);

  const pointsRef = useRef<GeoPoint[]>([]);
  const lastSeqRef = useRef(-1);
  const distanceRef = useRef(0);
  const dropCountRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollBusyRef = useRef(false);
  const recordingIdRef = useRef<string | null>(null);
  const sessionRef = useRef<RecordingSession | null>(null);
  // Synchronous start guard + abort flag: the ref-based id guard only
  // becomes true after several awaits, so a double-tap (or a discard mid-
  // start) needs these to be caught at the entry/await boundaries.
  const startingRef = useRef(false);
  const abortStartRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /** Pull anything new out of the buffer into the live mirror. Re-entrant-
   *  safe: overlapping ticks skip, and a resolve that lands after a stop/
   *  discard (id changed) is thrown away rather than resurrecting state. */
  const pollOnce = useCallback(async () => {
    const id = recordingIdRef.current;
    if (id == null || pollBusyRef.current) return;
    pollBusyRef.current = true;
    try {
      const [fresh, session] = await Promise.all([
        getFixesAfter(id, lastSeqRef.current),
        getActiveRecording(),
      ]);
      // The recording this poll was issued for may be gone by now.
      if (recordingIdRef.current !== id) return;
      if (fresh.length > 0) {
        lastSeqRef.current = fresh[fresh.length - 1].seq;
        // Incremental distance: only the boundary pair + the fresh tail —
        // the panel never re-walks the whole track (O(n) per poll → O(1)).
        let d = distanceRef.current;
        let prev = pointsRef.current[pointsRef.current.length - 1];
        for (const f of fresh) {
          if (prev) d += haversineM(prev, f);
          prev = f;
          pointsRef.current.push({
            lat: f.lat,
            lng: f.lng,
            tsSec: f.tsSec,
            ...(f.eleM != null ? { eleM: f.eleM, eleSource: f.eleSource ?? 'gps' } : {}),
          });
        }
        distanceRef.current = d;
        setDistanceM(d);
        setPoints(pointsRef.current.slice());
        setGpsQuality('good');
      } else if (session != null && session.recordingId === id) {
        // No fixes landed this tick — if the gate dropped some for accuracy
        // in the meantime, the signal is honestly weak (stored accuracies
        // can never exceed the gate, so ONLY the drop counter can say so).
        if (session.droppedLowAccuracy > dropCountRef.current) setGpsQuality('weak');
      }
      if (session != null && session.recordingId === id) {
        dropCountRef.current = session.droppedLowAccuracy;
      }
    } catch {
      /* a failed poll is just a stale frame — the buffer is the truth */
    } finally {
      pollBusyRef.current = false;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    void pollOnce();
    pollRef.current = setInterval(() => void pollOnce(), POLL_MS);
  }, [pollOnce, stopPolling]);

  /** Enter live-tracking state for a buffer session. */
  const attachLive = useCallback(
    (session: RecordingSession) => {
      recordingIdRef.current = session.recordingId;
      sessionRef.current = session;
      setStartedAt(session.startedAt);
      setRecoverable(null);
      pointsRef.current = [];
      lastSeqRef.current = -1;
      distanceRef.current = 0;
      dropCountRef.current = 0;
      setPoints([]);
      setDistanceM(0);
      setGpsQuality('unknown');
      setStatus('tracking');
      startPolling();
    },
    [startPolling]
  );

  /**
   * The mount/focus probe — research §8's recovery check:
   *  - already attached to this exact recording → no-op (a tab refocus must
   *    not blank the live trace and re-read the whole buffer);
   *  - buffer row 'active' AND the OS task still running → the recording
   *    never stopped; re-attach the live panel to it;
   *  - buffer row present otherwise → the OS task died with it (iOS
   *    swipe-kill / reboot / kill after Stop) → surface as recoverable.
   * No-ops while a start() is in flight — the half-created row it would
   * find is not an orphan.
   */
  const attach = useCallback(async () => {
    if (startingRef.current) return;
    try {
      const session = await getActiveRecording();
      if (session == null) {
        setRecoverable(null);
        return;
      }
      if (session.recordingId === recordingIdRef.current) return; // already live
      if (session.status === 'active') {
        const Location = await loadLocation();
        let taskRunning = false;
        try {
          taskRunning = Location
            ? await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)
            : false;
        } catch {
          taskRunning = false;
        }
        if (taskRunning) {
          attachLive(session);
          return;
        }
      }
      setRecoverable(session);
    } catch {
      /* no buffer yet (fresh install mid-migration) — nothing to attach */
    }
  }, [attachLive]);

  /** Roll back a half-started recording (abort or task-start failure):
   *  OS task down first, then the buffer row. */
  const rollbackStart = useCallback(async (recordingId: string) => {
    await stopOsUpdates();
    await clearRecording(recordingId).catch(() => {});
  }, []);

  const start = useCallback(
    async (input: { activityId: string; element: RecordingElement }) => {
      // Synchronous guard: a second tap in the same frame (or any time
      // before the first start resolves) no-ops instead of racing it.
      if (startingRef.current || recordingIdRef.current != null) return;
      startingRef.current = true;
      abortStartRef.current = false;
      setErrorMessage(null);
      setStatus('starting');

      try {
        const Location = await loadLocation();
        if (!Location) {
          setStatus('unavailable');
          setErrorMessage(
            'Background GPS recording needs an updated dev build of the app — rebuild to enable it.'
          );
          return;
        }

        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (!perm.granted) {
            setStatus('denied');
            return;
          }
        } catch (e) {
          setStatus('error');
          setErrorMessage(e instanceof Error ? e.message : 'Could not check location permission.');
          return;
        }
        if (abortStartRef.current) {
          setStatus('idle');
          return;
        }

        // Buffer row first, OS updates second: a delivery with no active row
        // is dropped silently (safe), whereas updates without a row would
        // record into the void.
        let session: RecordingSession;
        try {
          session = await startRecording(input);
        } catch (e) {
          if (e instanceof Error && e.message === 'recording-already-in-flight') {
            // Someone left a session behind — surface it. attach() may go
            // LIVE (the OS task never stopped); only fall back to idle when
            // it didn't.
            startingRef.current = false; // let attach() run
            await attach();
            if (recordingIdRef.current == null) setStatus('idle');
            return;
          }
          setStatus('error');
          setErrorMessage('Could not open the recording buffer.');
          return;
        }

        if (abortStartRef.current) {
          await rollbackStart(session.recordingId);
          setStatus('idle');
          return;
        }

        try {
          // The exact options block — research §2. The static half (including
          // the two pinned trap doors: pausesUpdatesAutomatically:false and
          // killServiceOnDestroy:false) lives in recordingTask.ts under test.
          await Location.startLocationUpdatesAsync(RECORDING_TASK, {
            ...RECORDING_UPDATE_OPTIONS,
            accuracy: Location.Accuracy.BestForNavigation,
            activityType:
              input.element === 'sky'
                ? Location.ActivityType.Airborne
                : Location.ActivityType.Fitness,
          });
        } catch (e) {
          // A partial start may have left the OS task alive — tear it down
          // with the row, never strand a running task behind an 'error'.
          await rollbackStart(session.recordingId);
          setStatus('error');
          setErrorMessage(e instanceof Error ? e.message : 'Could not start GPS recording.');
          return;
        }

        if (abortStartRef.current) {
          await rollbackStart(session.recordingId);
          setStatus('idle');
          return;
        }

        attachLive(session);
      } finally {
        startingRef.current = false;
      }
    },
    [attach, attachLive, rollbackStart]
  );

  const stop = useCallback(async (): Promise<StoppedRecording | null> => {
    const session = sessionRef.current ?? recoverable;
    const id = session?.recordingId ?? null;
    if (id == null) return null;
    stopPolling();
    await stopOsUpdates();
    try {
      await stopRecording(id);
      // Everything, from the top, cleaned to canonical GeoPoints — the poll
      // mirror may trail the buffer by one undelivered batch; the buffer is
      // authoritative.
      const bufferedPoints = await getBufferedPoints(id);
      recordingIdRef.current = null;
      sessionRef.current = null;
      setRecoverable(null);
      setStatus('idle');
      return {
        recordingId: id,
        activityId: session!.activityId,
        element: session!.element,
        startedAt: session!.startedAt,
        points: bufferedPoints,
      };
    } catch (e) {
      // Symmetric teardown even on failure: never strand a stale id that
      // wedges start() while the pre-start card shows. The surviving row
      // re-surfaces through attach() as recoverable.
      recordingIdRef.current = null;
      sessionRef.current = null;
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Could not read the recording back.');
      void attach();
      return null;
    }
  }, [recoverable, stopPolling, attach]);

  const discard = useCallback(
    async (explicitId?: string) => {
      // Discard while still starting: flag the in-flight start() to abort
      // and roll itself back at its next await boundary.
      if (startingRef.current) {
        abortStartRef.current = true;
        setStatus('idle');
        return;
      }
      const id = explicitId ?? recordingIdRef.current ?? recoverable?.recordingId ?? null;
      stopPolling();
      await stopOsUpdates();
      if (id != null) {
        await clearRecording(id).catch(() => {});
      }
      recordingIdRef.current = null;
      sessionRef.current = null;
      pointsRef.current = [];
      lastSeqRef.current = -1;
      distanceRef.current = 0;
      dropCountRef.current = 0;
      setPoints([]);
      setDistanceM(0);
      setGpsQuality('unknown');
      setRecoverable(null);
      setStartedAt(null);
      setErrorMessage(null);
      setStatus('idle');
    },
    [recoverable, stopPolling]
  );

  // Attach on mount; on unmount stop ONLY the poll — the recording is the
  // OS task's and keeps running until the user stops it (M2's whole point).
  useEffect(() => {
    void attach();
    return stopPolling;
  }, [attach, stopPolling]);

  return {
    status,
    points,
    errorMessage,
    distanceM,
    gpsQuality,
    startedAt,
    recoverable,
    start,
    stop,
    discard,
    attach,
  };
}
