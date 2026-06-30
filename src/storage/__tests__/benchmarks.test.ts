/**
 * Storage round-trip tests for Benchmark (Phase 5 Pass 1a — v0.3 goal layer).
 *
 * Real SQL via better-sqlite3 in-memory — exercises migration 001 + 007, the
 * serializer, and the CRUD module. Confirms the v0.3 additions survive a genuine
 * JSON.stringify/parse round-trip with their discriminators intact: `resolution`
 * (the existence gate, always present), `shape` (cadence | trend), and `pinned`
 * (stored 0/1). House rule: real DB, never a mock.
 */
import { describe, it, expect } from '@jest/globals';
import type { Benchmark, CadenceShape, TrendShape } from '@core/benchmark';
import { runMigrations } from '../db';
import {
  createBenchmark,
  listBenchmarks,
  getBenchmarkById,
  updateBenchmark,
} from '../benchmarks';
import { makeTestDb } from './sqliteTestDb';

function cadenceBenchmark(id: string, over: Partial<Benchmark> = {}): Benchmark {
  return {
    id,
    createdAt: '2026-06-29T10:00:00Z',
    status: 'active',
    title: 'Kayak more',
    resolution: { metric: 'sessionCount', modality: 'paddle', activity: 'kayak' },
    shape: { family: 'cadence', window: 'week', measure: { type: 'count', target: 4 } },
    pinned: true,
    ...over,
  };
}

function trendBenchmark(id: string, over: Partial<Benchmark> = {}): Benchmark {
  return {
    id,
    createdAt: '2026-06-29T10:01:00Z',
    status: 'active',
    title: 'Lose some weight',
    resolution: { metric: 'bodyweight' },
    shape: { family: 'trend', direction: 'down', target: 75 },
    pinned: true,
    ...over,
  };
}

describe('benchmarks storage', () => {
  it('round-trips a cadence benchmark with resolution + measure intact', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = cadenceBenchmark('b-cad-1');
    await createBenchmark(original, db);

    const back = await getBenchmarkById('b-cad-1', db);
    expect(back).not.toBeNull();
    // No optional fields were set, so the row reconstructs to exactly the original.
    expect(back).toEqual(original);
    // Discriminators + nested shape survived the JSON round-trip.
    expect(back!.resolution).toEqual({
      metric: 'sessionCount',
      modality: 'paddle',
      activity: 'kayak',
    });
    expect(back!.shape.family).toBe('cadence');
    const shape = back!.shape as CadenceShape;
    expect(shape.window).toBe('week');
    expect(shape.measure).toEqual({ type: 'count', target: 4 });
    expect(back!.pinned).toBe(true);
  });

  it('round-trips a trend benchmark; threshold target preserved, pure trend omits it', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(trendBenchmark('b-thresh'), db); // direction down, target 75
    await createBenchmark(
      trendBenchmark('b-pure', { shape: { family: 'trend', direction: 'up' } }),
      db
    );

    const thresh = await getBenchmarkById('b-thresh', db);
    const pure = await getBenchmarkById('b-pure', db);

    expect(thresh!.resolution).toEqual({ metric: 'bodyweight' });
    expect(thresh!.shape.family).toBe('trend');
    expect((thresh!.shape as TrendShape).direction).toBe('down');
    expect((thresh!.shape as TrendShape).target).toBe(75);
    // Pure trend ("get stronger") carries a direction but no threshold.
    expect((pure!.shape as TrendShape).direction).toBe('up');
    expect((pure!.shape as TrendShape).target).toBeUndefined();
  });

  it('keeps resolution present — the existence gate survives the round-trip', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(cadenceBenchmark('b-res'), db);
    const back = await getBenchmarkById('b-res', db);

    expect(back!.resolution).toBeDefined();
    expect(back!.resolution.metric).toBe('sessionCount');
  });

  it('listBenchmarks filters by status and orders by createdAt desc', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(
      cadenceBenchmark('b-old', { createdAt: '2026-06-01T00:00:00Z' }),
      db
    );
    await createBenchmark(
      trendBenchmark('b-new', { createdAt: '2026-06-29T00:00:00Z' }),
      db
    );
    await createBenchmark(cadenceBenchmark('b-done', { status: 'achieved' }), db);

    const all = await listBenchmarks({}, db);
    expect(all).toHaveLength(3);

    const active = await listBenchmarks({ status: 'active' }, db);
    expect(active.map((b) => b.id)).toEqual(['b-new', 'b-old']); // newest first, achieved excluded
  });

  it('updateBenchmark patches fields and persists the merged shape', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = cadenceBenchmark('b-1');
    await createBenchmark(original, db);

    await updateBenchmark(
      'b-1',
      {
        status: 'achieved',
        resolvedAt: '2026-07-01T09:00:00Z',
        pinned: false,
        shape: { family: 'cadence', window: 'month', measure: { type: 'count', target: 12 } },
      },
      db
    );

    const back = await getBenchmarkById('b-1', db);
    expect(back!.status).toBe('achieved');
    expect(back!.resolvedAt).toBe('2026-07-01T09:00:00Z');
    expect(back!.pinned).toBe(false);
    expect((back!.shape as CadenceShape).window).toBe('month');
    expect((back!.shape as CadenceShape).measure).toEqual({ type: 'count', target: 12 });
    // Untouched fields are preserved.
    expect(back!.title).toBe(original.title);
    expect(back!.resolution).toEqual(original.resolution);
    expect(back!.createdAt).toBe(original.createdAt);
  });

  it('updateBenchmark throws when the id does not exist', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await expect(
      updateBenchmark('ghost', { status: 'paused' }, db)
    ).rejects.toThrow(/benchmark ghost not found/);
  });

  it('pinned round-trips as boolean (stored 0/1)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(cadenceBenchmark('b-on', { pinned: true }), db);
    await createBenchmark(cadenceBenchmark('b-off', { pinned: false }), db);

    expect((await getBenchmarkById('b-on', db))!.pinned).toBe(true);
    expect((await getBenchmarkById('b-off', db))!.pinned).toBe(false);
  });
});
