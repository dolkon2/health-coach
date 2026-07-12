/**
 * recordingTask tests: the capture sanity gate (research §5 — drop only the
 * provably wrong, count every drop, tag never verdict) and the end-to-end
 * ingest path against a real in-memory buffer (no active recording → silent
 * no-op; straggler batches after Stop never resurrect a recording; ts
 * regressions judged against what's already buffered, not just the batch).
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { makeTestDb } from '@/storage/__tests__/sqliteTestDb';
import { runMigrations, type SqlDatabase } from '@/storage/db';
import {
  startRecording,
  stopRecording,
  getActiveRecording,
  getBufferedPoints,
} from '@/storage/recordingBuffer';
import {
  gateLocations,
  ingestLocations,
  MAX_ACCURACY_M,
  RECORDING_UPDATE_OPTIONS,
  type RawLocation,
} from '../recordingTask';

describe('RECORDING_UPDATE_OPTIONS — the two trap doors stay pinned', () => {
  it('pausesUpdatesAutomatically is explicitly false (iOS native default is TRUE — research §4 gotcha #1)', () => {
    expect(RECORDING_UPDATE_OPTIONS.pausesUpdatesAutomatically).toBe(false);
  });

  it('killServiceOnDestroy is false — an app-swipe never stops a recording (⚑1, Dylan 2026-07-11)', () => {
    expect(RECORDING_UPDATE_OPTIONS.foregroundService.killServiceOnDestroy).toBe(false);
  });
});

const loc = (
  tsMs: number,
  over: { accuracy?: number | null; altitude?: number | null; speed?: number | null; mocked?: boolean } = {}
): RawLocation => ({
  coords: {
    latitude: 45.7,
    longitude: -121.5,
    altitude: over.altitude !== undefined ? over.altitude : null,
    accuracy: over.accuracy !== undefined ? over.accuracy : 10,
    speed: over.speed !== undefined ? over.speed : null,
  },
  timestamp: tsMs,
  ...(over.mocked !== undefined ? { mocked: over.mocked } : {}),
});

describe('gateLocations — the capture sanity gate', () => {
  it('drops and counts fixes with accuracy worse than the gate', () => {
    const r = gateLocations(
      [loc(1000, { accuracy: MAX_ACCURACY_M + 1 }), loc(2000, { accuracy: MAX_ACCURACY_M })],
      -Infinity
    );
    expect(r.fixes).toHaveLength(1); // exactly-50 m is kept — the gate is "worse than"
    expect(r.fixes[0].tsSec).toBe(2);
    expect(r.counters.droppedLowAccuracy).toBe(1);
  });

  it('keeps fixes whose accuracy is unknown or an iOS negative sentinel, without fabricating a reading', () => {
    const r = gateLocations([loc(1000, { accuracy: null }), loc(2000, { accuracy: -1 })], -Infinity);
    expect(r.fixes).toHaveLength(2);
    expect('accuracy' in r.fixes[0]).toBe(false);
    expect('accuracy' in r.fixes[1]).toBe(false);
    expect(r.counters.droppedLowAccuracy).toBe(0);
  });

  it('drops strict clock regressions but keeps equal-second fixes (~1 Hz is normal)', () => {
    const r = gateLocations([loc(5000), loc(5400), loc(4000), loc(6000)], -Infinity);
    expect(r.fixes.map((f) => f.tsSec)).toEqual([5, 5, 6]);
    expect(r.counters.droppedTsRegression).toBe(1);
    expect(r.lastTsSec).toBe(6);
  });

  it('judges regressions against the carried-in lastTsSec, not just within the batch', () => {
    const r = gateLocations([loc(3000)], 10);
    expect(r.fixes).toHaveLength(0);
    expect(r.counters.droppedTsRegression).toBe(1);
    expect(r.lastTsSec).toBe(10); // unchanged — nothing was accepted
  });

  it('keeps mocked fixes but counts them — a provenance tag, not a verdict', () => {
    const r = gateLocations([loc(1000, { mocked: true }), loc(2000)], -Infinity);
    expect(r.fixes).toHaveLength(2);
    expect(r.fixes[0].mocked).toBe(true);
    expect('mocked' in r.fixes[1]).toBe(false);
    expect(r.counters.mockedCount).toBe(1);
  });

  it('maps altitude like locationToGeoPoint (absent → both keys omitted) and drops speed sentinels', () => {
    const r = gateLocations(
      [loc(1000, { altitude: 320.5, speed: 2.5 }), loc(2000, { altitude: null, speed: -1 })],
      -Infinity
    );
    expect(r.fixes[0].eleM).toBe(320.5);
    expect(r.fixes[0].eleSource).toBe('gps');
    expect(r.fixes[0].speed).toBe(2.5);
    expect('eleM' in r.fixes[1]).toBe(false);
    expect('eleSource' in r.fixes[1]).toBe(false);
    expect('speed' in r.fixes[1]).toBe(false);
  });
});

describe('ingestLocations — batch → buffer', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = makeTestDb();
    await runMigrations(db);
  });

  it('is a silent no-op when no recording is in flight', async () => {
    await expect(ingestLocations([loc(1000)], db)).resolves.toBeUndefined();
  });

  it('never resurrects a stopped recording from a straggler batch', async () => {
    const rec = await startRecording({ activityId: 'trail-run', element: 'earth' }, db);
    await ingestLocations([loc(1000)], db);
    await stopRecording(rec.recordingId, db);
    await ingestLocations([loc(2000)], db); // arrives after Stop — dropped
    expect(await getBufferedPoints(rec.recordingId, db)).toHaveLength(1);
  });

  it('gates against what is already buffered across batches and accumulates counters', async () => {
    const rec = await startRecording({ activityId: 'kayak', element: 'water' }, db);
    await ingestLocations([loc(10_000), loc(12_000)], db);
    // A whole second batch older than the buffered tail: all regressions.
    await ingestLocations([loc(8000), loc(9000)], db);
    // And one good batch with a bad-accuracy straggler.
    await ingestLocations([loc(14_000), loc(15_000, { accuracy: 80 })], db);

    const points = await getBufferedPoints(rec.recordingId, db);
    expect(points.map((p) => p.tsSec)).toEqual([10, 12, 14]);
    const session = await getActiveRecording(db);
    expect(session?.droppedTsRegression).toBe(2);
    expect(session?.droppedLowAccuracy).toBe(1);
  });
});
