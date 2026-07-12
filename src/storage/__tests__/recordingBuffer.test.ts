/**
 * recordingBuffer tests (migration 017, Map Record M2): the crash-safe
 * round-trip — start → append batches → incremental reads → stop → clear —
 * plus the invariants the recovery flow leans on: a surviving row (any
 * status) is recoverable, a second start over an in-flight recording throws,
 * seq numbering survives a simulated headless relaunch, and gate drops are
 * counted, never silent.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { makeTestDb } from './sqliteTestDb';
import { runMigrations, type SqlDatabase } from '../db';
import {
  startRecording,
  getActiveRecording,
  appendFixes,
  getFixesAfter,
  getBufferedPoints,
  getLastFix,
  stopRecording,
  clearRecording,
  type RecordedFix,
} from '../recordingBuffer';

const fix = (tsSec: number, over: Partial<RecordedFix> = {}): RecordedFix => ({
  lat: 45.7 + tsSec * 1e-5,
  lng: -121.5,
  tsSec,
  ...over,
});

describe('recordingBuffer', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = makeTestDb();
    await runMigrations(db);
  });

  it('round-trips start → append → read → stop → clear', async () => {
    const rec = await startRecording({ activityId: 'trail-run', element: 'earth' }, db);
    expect(rec.status).toBe('active');
    expect(rec.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await appendFixes(
      rec.recordingId,
      [fix(100, { eleM: 120.5, eleSource: 'gps', accuracy: 8, speed: 2.4 }), fix(102)],
      undefined,
      db
    );
    await appendFixes(rec.recordingId, [fix(104, { mocked: true })], undefined, db);

    // Whole-track read: CLEAN canonical GeoPoints — the capture metadata
    // never rides out where it could leak into a saved payload.
    const points = await getBufferedPoints(rec.recordingId, db);
    expect(points.map((p) => p.tsSec)).toEqual([100, 102, 104]);
    // eleM/eleSource travel together; absent altitude stays absent (null ≠ 0).
    expect(points[0].eleM).toBe(120.5);
    expect(points[0].eleSource).toBe('gps');
    expect(Object.keys(points[0]).sort()).toEqual(['eleM', 'eleSource', 'lat', 'lng', 'tsSec']);
    expect('eleM' in points[1]).toBe(false);
    expect('eleSource' in points[1]).toBe(false);
    // Incremental read: metadata kept — the gate and M3 read it here.
    const fixes = await getFixesAfter(rec.recordingId, -1, db);
    expect(fixes[0].accuracy).toBe(8);
    expect(fixes[0].speed).toBe(2.4);
    expect(fixes[2].mocked).toBe(true);

    const last = await getLastFix(rec.recordingId, db);
    expect(last?.tsSec).toBe(104);

    await stopRecording(rec.recordingId, db);
    // Stopped-but-uncleared is still recoverable (kill between Stop and save).
    const stopped = await getActiveRecording(db);
    expect(stopped?.recordingId).toBe(rec.recordingId);
    expect(stopped?.status).toBe('stopped');

    await clearRecording(rec.recordingId, db);
    expect(await getActiveRecording(db)).toBeNull();
    expect(await getBufferedPoints(rec.recordingId, db)).toEqual([]);
  });

  it('getFixesAfter reads incrementally by seq', async () => {
    const rec = await startRecording({ activityId: 'kayak', element: 'water' }, db);
    await appendFixes(rec.recordingId, [fix(1), fix(2)], undefined, db);

    const first = await getFixesAfter(rec.recordingId, -1, db);
    expect(first.map((f) => f.seq)).toEqual([0, 1]);

    await appendFixes(rec.recordingId, [fix(3)], undefined, db);
    const delta = await getFixesAfter(rec.recordingId, first[first.length - 1].seq, db);
    expect(delta).toHaveLength(1);
    expect(delta[0].seq).toBe(2);
    expect(delta[0].tsSec).toBe(3);
  });

  it('seq numbering continues across appends (headless relaunch safe)', async () => {
    const rec = await startRecording({ activityId: 'paragliding', element: 'sky' }, db);
    await appendFixes(rec.recordingId, [fix(1)], undefined, db);
    // A headless relaunch has no in-memory counter — numbering must resume
    // from the stored maximum, not restart at 0.
    await appendFixes(rec.recordingId, [fix(2), fix(3)], undefined, db);
    const all = await getFixesAfter(rec.recordingId, -1, db);
    expect(all.map((f) => f.seq)).toEqual([0, 1, 2]);
  });

  it('refuses to start over an in-flight recording (either status)', async () => {
    const rec = await startRecording({ activityId: 'hike', element: 'earth' }, db);
    await expect(startRecording({ activityId: 'hike', element: 'earth' }, db)).rejects.toThrow(
      'recording-already-in-flight'
    );
    await stopRecording(rec.recordingId, db);
    // Still in flight until cleared — the recovery banner owns this row.
    await expect(startRecording({ activityId: 'hike', element: 'earth' }, db)).rejects.toThrow(
      'recording-already-in-flight'
    );
    await clearRecording(rec.recordingId, db);
    const again = await startRecording({ activityId: 'hike', element: 'earth' }, db);
    expect(again.status).toBe('active');
  });

  it('accumulates gate counters without requiring fixes in the batch', async () => {
    const rec = await startRecording({ activityId: 'trail-run', element: 'earth' }, db);
    await appendFixes(rec.recordingId, [fix(1)], { droppedLowAccuracy: 2 }, db);
    // An all-dropped batch still records its drops.
    await appendFixes(
      rec.recordingId,
      [],
      { droppedLowAccuracy: 1, droppedTsRegression: 3, mockedCount: 2 },
      db
    );
    const session = await getActiveRecording(db);
    expect(session?.droppedLowAccuracy).toBe(3);
    expect(session?.droppedTsRegression).toBe(3);
    expect(session?.mockedCount).toBe(2);
  });
});
