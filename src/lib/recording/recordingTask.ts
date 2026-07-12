/**
 * recordingTask — the background location task behind Map Record M2
 * (gps-recording-expo.md §2/§4/§8).
 *
 * Layer 1 of the two-layer stack: the OS delivers batched fixes here —
 * headless, possibly with no React tree at all (Android can relaunch a
 * killed app straight into this task) — and each batch is gated and
 * persisted to the SQLite recording buffer immediately. React state is only
 * ever a cache of that buffer.
 *
 * Rules this module lives by:
 *  - defineTask MUST run at module scope (research §2): a task defined
 *    inside a component silently never fires on a cold background launch.
 *    app/_layout.tsx imports this module once for exactly that reason.
 *  - The handler NEVER throws (research §2): an error is logged and the
 *    batch dropped — a crash here kills the OS task and the whole recording.
 *  - Store raw, derive clean (research §5): the gate drops only the provably
 *    wrong — accuracy worse than 50 m, clock regressions — and counts every
 *    drop on the session row. Android mock-location fixes are KEPT and
 *    counted (a provenance tag, not a verdict). Everything else persists.
 *  - expo-task-manager loads via require() in a try/catch: module-scope
 *    registration with the same graceful degradation as every other native
 *    module here — an old dev build surfaces 'unavailable', never a crash.
 */
import {
  appendFixes,
  getActiveRecording,
  getLastFix,
  type GateCounters,
  type RecordedFix,
} from '@/storage/recordingBuffer';
import type { SqlDatabase } from '@/storage/db';

export const RECORDING_TASK = 'health-coach-recording';

/** Fixes with reported horizontal accuracy worse than this are dropped (and
 *  counted) at capture — research §5's minimal sanity gate. */
export const MAX_ACCURACY_M = 50;

/**
 * The static half of the startLocationUpdatesAsync options — research §2's
 * exact block, minus the two values that need the lazy-loaded native enums
 * (accuracy: BestForNavigation; activityType: Fitness/Airborne by element).
 * Lives here (native-free) so tests can pin the two found-in-source trap
 * doors: pausesUpdatesAutomatically MUST stay explicitly false (iOS native
 * default is true — the "stopped for lunch, lost the hike" bug, research §4
 * gotcha #1) and killServiceOnDestroy MUST stay false (⚑1, Dylan 2026-07-11:
 * an app-swipe does not stop a recording; the notification is the consent
 * surface).
 */
export const RECORDING_UPDATE_OPTIONS = {
  distanceInterval: 5, // meters, both platforms
  timeInterval: 2000, // ms — Android only; iOS paces by distance
  deferredUpdatesInterval: 5000, // batch JS delivery ~5 s in background
  deferredUpdatesDistance: 25, // … or 25 m, whichever is later
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true, // iOS status pill — honesty-friendly
  foregroundService: {
    notificationTitle: 'Recording session',
    notificationBody: 'GPS is on until you stop the session.',
    killServiceOnDestroy: false,
  },
} as const;

/** The slice of an expo-location LocationObject the gate reads — declared
 *  here (like useGpsTracker's LocationFix) so gating stays unit-testable
 *  without the native module. */
export type RawLocation = {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    speed: number | null;
  };
  timestamp: number; // ms epoch
  mocked?: boolean; // Android only
};

export type GateResult = {
  fixes: RecordedFix[];
  counters: GateCounters;
  /** Last accepted tsSec — feed back in as `lastTsSec` for the next batch. */
  lastTsSec: number;
};

/**
 * The capture sanity gate, pure. Drops (and counts) fixes with accuracy
 * worse than MAX_ACCURACY_M and true clock regressions (tsSec strictly
 * below the last accepted fix — equal seconds are normal at ~1 Hz and kept).
 * Mocked fixes are kept but counted. Altitude maps exactly like
 * locationToGeoPoint: absent altitude omits BOTH eleM and eleSource; iOS's
 * negative "invalid" sentinels for accuracy/speed are omitted rather than
 * stored as fake readings.
 */
export function gateLocations(locations: RawLocation[], lastTsSec: number): GateResult {
  const fixes: RecordedFix[] = [];
  const counters: Required<GateCounters> = {
    droppedLowAccuracy: 0,
    droppedTsRegression: 0,
    mockedCount: 0,
  };
  let last = lastTsSec;

  for (const loc of locations) {
    const accuracy =
      loc.coords.accuracy != null && loc.coords.accuracy >= 0 ? loc.coords.accuracy : undefined;
    if (accuracy != null && accuracy > MAX_ACCURACY_M) {
      counters.droppedLowAccuracy += 1;
      continue;
    }
    const tsSec = Math.floor(loc.timestamp / 1000);
    if (tsSec < last) {
      counters.droppedTsRegression += 1;
      continue;
    }
    const fix: RecordedFix = { lat: loc.coords.latitude, lng: loc.coords.longitude, tsSec };
    if (loc.coords.altitude != null) {
      fix.eleM = loc.coords.altitude;
      fix.eleSource = 'gps';
    }
    if (accuracy != null) fix.accuracy = accuracy;
    if (loc.coords.speed != null && loc.coords.speed >= 0) fix.speed = loc.coords.speed;
    if (loc.mocked === true) {
      fix.mocked = true;
      counters.mockedCount += 1;
    }
    fixes.push(fix);
    last = tsSec;
  }

  return { fixes, counters, lastTsSec: last };
}

/**
 * One delivered batch, end to end: look up the in-flight recording, gate
 * against the buffer's last accepted fix, persist. A delivery with no
 * active recording (a straggler batch after Stop, or a cleared session)
 * is dropped silently — never resurrect a finished recording.
 */
export async function ingestLocations(locations: RawLocation[], db?: SqlDatabase): Promise<void> {
  if (locations.length === 0) return;
  const rec = await getActiveRecording(db);
  if (rec == null || rec.status !== 'active') return;
  const lastFix = await getLastFix(rec.recordingId, db);
  const gate = gateLocations(locations, lastFix?.tsSec ?? -Infinity);
  await appendFixes(rec.recordingId, gate.fixes, gate.counters, db);
}

// ─── Module-scope task registration ─────────────────────────────────────────
// require() (not a static import) so a dev build without the native module
// degrades to Record showing 'unavailable' instead of crashing on import;
// try/catch because registration itself must never take the app down.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
  TaskManager.defineTask(RECORDING_TASK, async ({ data, error }) => {
    // NEVER throw from here — an exception kills the OS task (and with it
    // the rest of a multi-hour recording). Log and move on.
    try {
      if (error) {
        console.warn('[recording] background task error:', error.message);
        return;
      }
      const locations = (data as { locations?: RawLocation[] } | null)?.locations ?? [];
      await ingestLocations(locations);
    } catch (e) {
      console.warn(
        '[recording] failed to persist a location batch:',
        e instanceof Error ? e.message : e
      );
    }
  });
} catch {
  /* expo-task-manager not in this dev build — Record degrades honestly */
}
