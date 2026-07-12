/**
 * recordingBuffer.ts — the crash-safe GPS recording buffer (migration 017,
 * Map Record M2).
 *
 * "SQLite is the recording, React state a cache" (gps-recording-expo.md §8):
 * the background location task appends every gated fix here the moment it
 * arrives, so a lock, background, or app kill loses at most one undelivered
 * deferred batch (~5 s / 25 m). The recorder hook reads points back out to
 * hydrate the live trace; save summarizes the buffer into an ordinary session
 * Observation and clears it.
 *
 * Single-writer by design: only the background task appends. The foreground
 * hook only reads (WAL keeps readers and the writer coexisting). A row in
 * recording_sessions — any status — means an in-flight recording; save and
 * discard both end in clearRecording, so a surviving row on launch is the
 * recovery marker ("finish the partial session").
 *
 * Store raw, derive clean (research §5): points keep accuracy/speed/mocked so
 * M3 can derive honest stats at read time; the sanity gate's drops are
 * counted on the session row, never silently discarded.
 *
 * Tests pass an injected `SqlDatabase`; the app falls through to the singleton.
 */
import { getDb, type SqlDatabase, type SqlParam } from './db';
import type { GeoPoint } from '@core/observation';
import { uuidv7 } from '@/lib/id';

export type RecordingElement = 'earth' | 'sky' | 'water';

export type RecordingStatus = 'active' | 'stopped';

export type RecordingSession = {
  recordingId: string;
  activityId: string;
  element: RecordingElement;
  startedAt: string; // ISO instant the user tapped Record
  status: RecordingStatus;
  droppedLowAccuracy: number;
  droppedTsRegression: number;
  mockedCount: number;
};

/**
 * A gated fix as the task persists it — canonical GeoPoint plus the raw
 * capture metadata (accuracy m, speed m/s, Android mocked flag) that M3's
 * read-time derivations want. The *saved* track strips back to GeoPoint.
 */
export type RecordedFix = GeoPoint & {
  accuracy?: number;
  speed?: number;
  mocked?: boolean;
};

/** Per-batch tallies from the capture sanity gate (dropped, but counted). */
export type GateCounters = {
  droppedLowAccuracy?: number;
  droppedTsRegression?: number;
  mockedCount?: number;
};

type SessionRow = {
  id: string;
  activityId: string;
  element: string;
  startedAt: string;
  status: string;
  droppedLowAccuracy: number;
  droppedTsRegression: number;
  mockedCount: number;
};

type PointRow = {
  seq: number;
  lat: number;
  lng: number;
  tsSec: number;
  eleM: number | null;
  eleSource: string | null;
  accuracy: number | null;
  speed: number | null;
  mocked: number;
};

function rowToSession(row: SessionRow): RecordingSession {
  return {
    recordingId: row.id,
    activityId: row.activityId,
    element: row.element as RecordingElement,
    startedAt: row.startedAt,
    status: row.status as RecordingStatus,
    droppedLowAccuracy: row.droppedLowAccuracy,
    droppedTsRegression: row.droppedTsRegression,
    mockedCount: row.mockedCount,
  };
}

function rowToFix(row: PointRow): RecordedFix {
  const fix: RecordedFix = { lat: row.lat, lng: row.lng, tsSec: row.tsSec };
  // eleM/eleSource travel together or not at all (null ≠ 0 convention,
  // same as locationToGeoPoint).
  if (row.eleM != null) {
    fix.eleM = row.eleM;
    fix.eleSource = (row.eleSource ?? 'gps') as GeoPoint['eleSource'];
  }
  if (row.accuracy != null) fix.accuracy = row.accuracy;
  if (row.speed != null) fix.speed = row.speed;
  if (row.mocked === 1) fix.mocked = true;
  return fix;
}

/**
 * Begins a recording. Throws if any in-flight recording row exists — the UI
 * must resolve it first (recovery banner → finish or discard), so a crashed
 * session can never be silently orphaned by starting a new one over it.
 */
export async function startRecording(
  input: { activityId: string; element: RecordingElement },
  db?: SqlDatabase
): Promise<RecordingSession> {
  const d = db ?? (await getDb());
  const existing = await d.getFirstAsync<{ id: string }>(
    'SELECT id FROM recording_sessions LIMIT 1;'
  );
  if (existing != null) {
    throw new Error('recording-already-in-flight');
  }
  const session: RecordingSession = {
    recordingId: uuidv7(),
    activityId: input.activityId,
    element: input.element,
    startedAt: new Date().toISOString(),
    status: 'active',
    droppedLowAccuracy: 0,
    droppedTsRegression: 0,
    mockedCount: 0,
  };
  await d.runAsync(
    `INSERT INTO recording_sessions (id, activityId, element, startedAt, status)
     VALUES (?, ?, ?, ?, 'active');`,
    [session.recordingId, session.activityId, session.element, session.startedAt]
  );
  return session;
}

/**
 * The in-flight recording, whatever its status — 'active' (task may still be
 * delivering) or 'stopped' (killed between Stop and save). Null when none:
 * save/discard clear the row. This is the launch-time recovery probe.
 */
export async function getActiveRecording(db?: SqlDatabase): Promise<RecordingSession | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<SessionRow>('SELECT * FROM recording_sessions LIMIT 1;');
  return row == null ? null : rowToSession(row);
}

/**
 * Appends a gated batch. Called only from the background task (single
 * writer); seq continues from the stored maximum so a headless relaunch
 * never restarts numbering. Counter increments ride the same call so a
 * dropped fix is always accounted for.
 */
export async function appendFixes(
  recordingId: string,
  fixes: RecordedFix[],
  counters?: GateCounters,
  db?: SqlDatabase
): Promise<void> {
  const d = db ?? (await getDb());
  if (fixes.length > 0) {
    const maxRow = await d.getFirstAsync<{ maxSeq: number | null }>(
      'SELECT MAX(seq) AS maxSeq FROM recording_points WHERE recordingId = ?;',
      [recordingId]
    );
    let seq = (maxRow?.maxSeq ?? -1) + 1;
    for (const f of fixes) {
      await d.runAsync(
        `INSERT INTO recording_points
           (recordingId, seq, lat, lng, tsSec, eleM, eleSource, accuracy, speed, mocked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          recordingId,
          seq,
          f.lat,
          f.lng,
          f.tsSec,
          f.eleM ?? null,
          f.eleM != null ? (f.eleSource ?? 'gps') : null,
          f.accuracy ?? null,
          f.speed ?? null,
          f.mocked ? 1 : 0,
        ] as SqlParam[]
      );
      seq += 1;
    }
  }
  if (
    counters &&
    ((counters.droppedLowAccuracy ?? 0) > 0 ||
      (counters.droppedTsRegression ?? 0) > 0 ||
      (counters.mockedCount ?? 0) > 0)
  ) {
    await d.runAsync(
      `UPDATE recording_sessions SET
         droppedLowAccuracy  = droppedLowAccuracy + ?,
         droppedTsRegression = droppedTsRegression + ?,
         mockedCount         = mockedCount + ?
       WHERE id = ?;`,
      [
        counters.droppedLowAccuracy ?? 0,
        counters.droppedTsRegression ?? 0,
        counters.mockedCount ?? 0,
        recordingId,
      ]
    );
  }
}

/**
 * Points after a given seq, in order — the hook's incremental poll, so the
 * live trace never re-reads a multi-hour track every tick. Pass afterSeq -1
 * (or omit) for everything.
 */
export async function getFixesAfter(
  recordingId: string,
  afterSeq = -1,
  db?: SqlDatabase
): Promise<Array<RecordedFix & { seq: number }>> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<PointRow>(
    `SELECT seq, lat, lng, tsSec, eleM, eleSource, accuracy, speed, mocked
     FROM recording_points WHERE recordingId = ? AND seq > ? ORDER BY seq;`,
    [recordingId, afterSeq]
  );
  return rows.map((r) => ({ ...rowToFix(r), seq: r.seq }));
}

/** The whole buffered track as CLEAN canonical GeoPoints, ordered by seq.
 *  The capture metadata (accuracy/speed/mocked) deliberately stays inside
 *  the buffer — it exists for the gate and M3's read-time derivations, and
 *  must never ride out on a whole-track read where it could leak into a
 *  saved payload. Callers that need the metadata use getFixesAfter. */
export async function getBufferedPoints(
  recordingId: string,
  db?: SqlDatabase
): Promise<GeoPoint[]> {
  const fixes = await getFixesAfter(recordingId, -1, db);
  return fixes.map((f) => ({
    lat: f.lat,
    lng: f.lng,
    tsSec: f.tsSec,
    ...(f.eleM != null ? { eleM: f.eleM, eleSource: f.eleSource ?? 'gps' } : {}),
  }));
}

/** The most recent fix — drives the live accuracy chip. */
export async function getLastFix(
  recordingId: string,
  db?: SqlDatabase
): Promise<RecordedFix | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<PointRow>(
    `SELECT seq, lat, lng, tsSec, eleM, eleSource, accuracy, speed, mocked
     FROM recording_points WHERE recordingId = ? ORDER BY seq DESC LIMIT 1;`,
    [recordingId]
  );
  return row == null ? null : rowToFix(row);
}

/** Marks the recording stopped (Stop tapped; OS updates torn down). The row
 *  and points stay until save/discard clears them — a kill between Stop and
 *  save still recovers. */
export async function stopRecording(recordingId: string, db?: SqlDatabase): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(`UPDATE recording_sessions SET status = 'stopped' WHERE id = ?;`, [
    recordingId,
  ]);
}

/** Ends the recording's buffer life — after a successful save, or a
 *  confirmed discard. Removes points first so a kill mid-clear leaves the
 *  session row (recoverable, just empty) rather than orphaned points. */
export async function clearRecording(recordingId: string, db?: SqlDatabase): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync('DELETE FROM recording_points WHERE recordingId = ?;', [recordingId]);
  await d.runAsync('DELETE FROM recording_sessions WHERE id = ?;', [recordingId]);
}
