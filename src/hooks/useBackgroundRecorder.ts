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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '@core/observation';
import {
  startRecording,
  getActiveRecording,
  getFixesAfter,
  stopRecording,
  clearRecording,
  type RecordedFix,
  type RecordingElement,
  type RecordingSession,
} from '@/storage/recordingBuffer';
import { RECORDING_TASK, RECORDING_UPDATE_OPTIONS } from '@/lib/recording/recordingTask';

export type RecorderStatus =
  | 'idle' // not recording
  | 'starting' // permission + task start pending
  | 'tracking' // OS task live, buffer filling
  | 'denied' // location permission refused (honest floor: log by hand)
  | 'unavailable' // native module missing — this dev build predates M2
  | 'error';

export type BackgroundRecorder = {
  status: RecorderStatus;
  /** Live mirror of the buffer, refreshed by an incremental poll. */
  points: GeoPoint[];
  errorMessage: string | null;
  /** Horizontal accuracy (m) of the newest fix — drives the accuracy chip. */
  lastAccuracyM: number | null;
  /** ISO instant Record was tapped — drives the elapsed clock. */
  startedAt: string | null;
  recordingId: string | null;
  /** An in-flight recording found on attach that the OS task is no longer
   *  feeding (iOS swipe-kill, reboot, or a kill between Stop and save) —
   *  the "finish the partial session" banner's subject. */
  recoverable: RecordingSession | null;
  /** Ask permission, open the buffer, start OS location updates. */
  start: (input: { activityId: string; element: RecordingElement }) => Promise<void>;
  /** End the recording and hand back everything buffered. The buffer row
   *  survives (status 'stopped') until save/discard clears it. */
  stop: () => Promise<{ recordingId: string; fixes: RecordedFix[] } | null>;
  /** Discard an in-flight or recovered recording: teardown + clear buffer. */
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
  const [lastAccuracyM, setLastAccuracyM] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<RecordingSession | null>(null);

  const pointsRef = useRef<GeoPoint[]>([]);
  const lastSeqRef = useRef(-1);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /** Pull anything new out of the buffer into the live mirror. */
  const pollOnce = useCallback(async () => {
    const id = recordingIdRef.current;
    if (id == null) return;
    try {
      const fresh = await getFixesAfter(id, lastSeqRef.current);
      if (fresh.length === 0) return;
      lastSeqRef.current = fresh[fresh.length - 1].seq;
      const newest = fresh[fresh.length - 1];
      pointsRef.current = [
        ...pointsRef.current,
        ...fresh.map(({ seq: _seq, accuracy: _a, speed: _s, mocked: _m, ...pt }) => pt),
      ];
      setPoints(pointsRef.current);
      setLastAccuracyM(newest.accuracy ?? null);
    } catch {
      /* a failed poll is just a stale frame — the buffer is the truth */
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    void pollOnce();
    pollRef.current = setInterval(() => void pollOnce(), POLL_MS);
  }, [pollOnce, stopPolling]);

  /** Enter live-tracking state for an existing buffer session. */
  const attachLive = useCallback(
    (session: RecordingSession) => {
      recordingIdRef.current = session.recordingId;
      setRecordingId(session.recordingId);
      setStartedAt(session.startedAt);
      setRecoverable(null);
      pointsRef.current = [];
      lastSeqRef.current = -1;
      setPoints([]);
      setStatus('tracking');
      startPolling();
    },
    [startPolling]
  );

  /**
   * The mount-time (and manual) probe — research §8's recovery check:
   *  - buffer row 'active' AND the OS task still running → the recording
   *    never stopped; re-attach the live panel to it.
   *  - buffer row present otherwise → the OS task died with it (iOS
   *    swipe-kill / reboot / kill after Stop) → surface as recoverable.
   */
  const attach = useCallback(async () => {
    try {
      const session = await getActiveRecording();
      if (session == null) return;
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

  const start = useCallback(
    async (input: { activityId: string; element: RecordingElement }) => {
      if (recordingIdRef.current != null) return; // already tracking
      setErrorMessage(null);
      setStatus('starting');

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

      // Buffer row first, OS updates second: a delivery with no active row
      // is dropped silently (safe), whereas updates without a row would
      // record into the void. Roll the row back if the task won't start.
      let session: RecordingSession;
      try {
        session = await startRecording(input);
      } catch (e) {
        if (e instanceof Error && e.message === 'recording-already-in-flight') {
          await attach(); // someone left a session behind — surface it
          setStatus('idle');
          return;
        }
        setStatus('error');
        setErrorMessage('Could not open the recording buffer.');
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
        await clearRecording(session.recordingId).catch(() => {});
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : 'Could not start GPS recording.');
        return;
      }

      attachLive(session);
    },
    [attach, attachLive]
  );

  const stop = useCallback(async (): Promise<{
    recordingId: string;
    fixes: RecordedFix[];
  } | null> => {
    const id = recordingIdRef.current ?? recoverable?.recordingId ?? null;
    if (id == null) return null;
    stopPolling();
    await stopOsUpdates();
    try {
      await stopRecording(id);
      // Everything, from the top — the poll mirror may trail the buffer by
      // one undelivered batch; the buffer is authoritative.
      const fixes = await getFixesAfter(id, -1);
      recordingIdRef.current = null;
      setRecordingId(null);
      setRecoverable(null);
      setStatus('idle');
      return { recordingId: id, fixes: fixes.map(({ seq: _seq, ...fix }) => fix) };
    } catch (e) {
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Could not read the recording back.');
      return null;
    }
  }, [recoverable, stopPolling]);

  const discard = useCallback(
    async (explicitId?: string) => {
      const id = explicitId ?? recordingIdRef.current ?? recoverable?.recordingId ?? null;
      stopPolling();
      await stopOsUpdates();
      if (id != null) {
        await clearRecording(id).catch(() => {});
      }
      recordingIdRef.current = null;
      pointsRef.current = [];
      lastSeqRef.current = -1;
      setPoints([]);
      setRecordingId(null);
      setRecoverable(null);
      setLastAccuracyM(null);
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
    lastAccuracyM,
    startedAt,
    recordingId,
    recoverable,
    start,
    stop,
    discard,
    attach,
  };
}
