/**
 * Storage round-trip tests for Benchmark (Phase 5 Pass 2.5 — v0.4 faces).
 *
 * Real SQL via better-sqlite3 in-memory — exercises migrations 001 + 007 + 008,
 * the serializer, and the CRUD module. Confirms the v0.4 collapse survives a
 * genuine JSON round-trip: `behavior` and `outcome` faces each carrying their
 * own dimension, either face alone or both together, plus the ≥1-face gate and
 * migration 008's rewrite of legacy v0.3 rows (resolution + shape → faces).
 * House rule: real DB, never a mock.
 */
import { describe, it, expect } from '@jest/globals';
import type { Benchmark } from '@core/benchmark';
import { runMigrations } from '../db';
import {
  createBenchmark,
  listBenchmarks,
  getBenchmarkById,
  updateBenchmark,
} from '../benchmarks';
import { legacyShapeRewrite } from '../migrations/008_benchmark_faces';
import { makeTestDb } from './sqliteTestDb';

/** Behavior-only — "I just want to be consistent." */
function behaviorBenchmark(id: string, over: Partial<Benchmark> = {}): Benchmark {
  return {
    id,
    createdAt: '2026-07-01T10:00:00Z',
    status: 'active',
    title: 'Kayak more',
    behavior: {
      dimension: { metric: 'sessionCount', modality: 'paddle', activity: 'kayak' },
      window: 'week',
      measure: { type: 'count', target: 4 },
    },
    pinned: true,
    ...over,
  };
}

/** Outcome-only — a number to move, no behavioral commitment named. */
function outcomeBenchmark(id: string, over: Partial<Benchmark> = {}): Benchmark {
  return {
    id,
    createdAt: '2026-07-01T10:01:00Z',
    status: 'active',
    title: 'Lose some weight',
    outcome: { dimension: { metric: 'bodyweight' }, direction: 'down', target: 75 },
    pinned: true,
    ...over,
  };
}

/** Both faces — the outcome names success, the behavior is the chosen path. */
function dualFaceBenchmark(id: string, over: Partial<Benchmark> = {}): Benchmark {
  return {
    id,
    createdAt: '2026-07-01T10:02:00Z',
    status: 'active',
    title: 'Train 3×/week, weight down',
    behavior: {
      dimension: { metric: 'sessionCount', modality: 'gym', activity: 'gym' },
      window: 'week',
      measure: { type: 'count', target: 3 },
    },
    outcome: { dimension: { metric: 'bodyweight' }, direction: 'down' },
    pinned: true,
    ...over,
  };
}

describe('benchmarks storage', () => {
  it('round-trips a behavior-only benchmark with its dimension intact', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = behaviorBenchmark('b-beh');
    await createBenchmark(original, db);

    const back = await getBenchmarkById('b-beh', db);
    expect(back).toEqual(original);
    // The face carries its own dimension — the per-face existence gate.
    expect(back!.behavior).toEqual({
      dimension: { metric: 'sessionCount', modality: 'paddle', activity: 'kayak' },
      window: 'week',
      measure: { type: 'count', target: 4 },
    });
    expect(back!.outcome).toBeUndefined();
  });

  it('round-trips an outcome-only benchmark; threshold preserved, pure direction omits it', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(outcomeBenchmark('b-thresh'), db); // down, target 75
    await createBenchmark(
      outcomeBenchmark('b-pure', {
        outcome: { dimension: { metric: 'bodyweight' }, direction: 'up' },
      }),
      db
    );

    const thresh = await getBenchmarkById('b-thresh', db);
    const pure = await getBenchmarkById('b-pure', db);

    expect(thresh!.outcome).toEqual({
      dimension: { metric: 'bodyweight' },
      direction: 'down',
      target: 75,
    });
    expect(thresh!.behavior).toBeUndefined();
    // Pure direction ("get stronger") carries no threshold — key absent, not null.
    expect(pure!.outcome!.direction).toBe('up');
    expect('target' in pure!.outcome!).toBe(false);
  });

  it('round-trips a dual-face benchmark — two faces, two dimensions, one object', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = dualFaceBenchmark('b-dual');
    await createBenchmark(original, db);

    const back = await getBenchmarkById('b-dual', db);
    expect(back).toEqual(original);
    // Cross-dimension pairing is the point: sessionCount behavior + bodyweight outcome.
    expect(back!.behavior!.dimension.metric).toBe('sessionCount');
    expect(back!.outcome!.dimension.metric).toBe('bodyweight');
  });

  it('refuses to write a benchmark with neither face — the existence gate', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const faceless = { ...behaviorBenchmark('b-none') };
    delete faceless.behavior;
    await expect(createBenchmark(faceless, db)).rejects.toThrow(/neither a behavior nor an outcome/);
  });

  it('listBenchmarks filters by status and orders by createdAt desc', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(
      behaviorBenchmark('b-old', { createdAt: '2026-06-01T00:00:00Z' }),
      db
    );
    await createBenchmark(
      outcomeBenchmark('b-new', { createdAt: '2026-06-29T00:00:00Z' }),
      db
    );
    await createBenchmark(behaviorBenchmark('b-done', { status: 'achieved' }), db);

    const all = await listBenchmarks({}, db);
    expect(all).toHaveLength(3);

    const active = await listBenchmarks({ status: 'active' }, db);
    expect(active.map((b) => b.id)).toEqual(['b-new', 'b-old']); // newest first, achieved excluded
  });

  it('updateBenchmark patches fields and persists the merged faces', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = behaviorBenchmark('b-1');
    await createBenchmark(original, db);

    await updateBenchmark(
      'b-1',
      {
        status: 'achieved',
        resolvedAt: '2026-07-01T09:00:00Z',
        pinned: false,
        behavior: {
          dimension: { metric: 'sessionCount', modality: 'paddle', activity: 'kayak' },
          window: 'month',
          measure: { type: 'count', target: 12 },
        },
      },
      db
    );

    const back = await getBenchmarkById('b-1', db);
    expect(back!.status).toBe('achieved');
    expect(back!.resolvedAt).toBe('2026-07-01T09:00:00Z');
    expect(back!.pinned).toBe(false);
    expect(back!.behavior!.window).toBe('month');
    expect(back!.behavior!.measure).toEqual({ type: 'count', target: 12 });
    // Untouched fields are preserved.
    expect(back!.title).toBe(original.title);
    expect(back!.createdAt).toBe(original.createdAt);
  });

  it('updateBenchmark removes a face only when the key is passed explicitly', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(dualFaceBenchmark('b-shed'), db);

    // Patch WITHOUT face keys — both faces survive the merge.
    await updateBenchmark('b-shed', { title: 'renamed' }, db);
    let back = await getBenchmarkById('b-shed', db);
    expect(back!.behavior).toBeDefined();
    expect(back!.outcome).toBeDefined();

    // Explicit undefined sheds the face.
    await updateBenchmark('b-shed', { outcome: undefined }, db);
    back = await getBenchmarkById('b-shed', db);
    expect(back!.behavior).toBeDefined();
    expect(back!.outcome).toBeUndefined();

    // Shedding the LAST face trips the existence gate.
    await expect(
      updateBenchmark('b-shed', { behavior: undefined }, db)
    ).rejects.toThrow(/neither a behavior nor an outcome/);
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

    await createBenchmark(behaviorBenchmark('b-on', { pinned: true }), db);
    await createBenchmark(behaviorBenchmark('b-off', { pinned: false }), db);

    expect((await getBenchmarkById('b-on', db))!.pinned).toBe(true);
    expect((await getBenchmarkById('b-off', db))!.pinned).toBe(false);
  });

  it('migration 008 rewrites legacy v0.3 rows into faces', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    // Hand-plant v0.3-format rows (resolution + shape columns, faces NULL) —
    // the state Dylan's sim DB was in after the Pass-2 tap-through.
    const insertLegacy = `INSERT INTO benchmarks
      (id, createdAt, status, title, resolution, shape, pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?);`;
    await db.runAsync(insertLegacy, [
      'l-cad',
      '2026-06-29T10:00:00Z',
      'active',
      'Kayak more',
      JSON.stringify({ metric: 'sessionCount', modality: 'paddle', activity: 'kayak' }),
      JSON.stringify({ family: 'cadence', window: 'week', measure: { type: 'count', target: 4 } }),
      1,
    ]);
    await db.runAsync(insertLegacy, [
      'l-thresh',
      '2026-06-29T10:01:00Z',
      'active',
      'Lose some weight',
      JSON.stringify({ metric: 'bodyweight' }),
      JSON.stringify({ family: 'trend', direction: 'down', target: 75 }),
      1,
    ]);
    await db.runAsync(insertLegacy, [
      'l-pure',
      '2026-06-29T10:02:00Z',
      'active',
      'Get lighter',
      JSON.stringify({ metric: 'bodyweight' }),
      JSON.stringify({ family: 'trend', direction: 'down' }),
      0,
    ]);

    // Re-run just the rewrite block (idempotent: guarded on face IS NULL).
    await db.execAsync(legacyShapeRewrite);

    const cad = await getBenchmarkById('l-cad', db);
    expect(cad!.behavior).toEqual({
      dimension: { metric: 'sessionCount', modality: 'paddle', activity: 'kayak' },
      window: 'week',
      measure: { type: 'count', target: 4 },
    });
    expect(cad!.outcome).toBeUndefined();

    const thresh = await getBenchmarkById('l-thresh', db);
    expect(thresh!.outcome).toEqual({
      dimension: { metric: 'bodyweight' },
      direction: 'down',
      target: 75,
    });
    expect(thresh!.behavior).toBeUndefined();

    // Targetless trend → outcome with the key absent (not null).
    const pure = await getBenchmarkById('l-pure', db);
    expect(pure!.outcome!.direction).toBe('down');
    expect('target' in pure!.outcome!).toBe(false);
    expect(pure!.pinned).toBe(false);
  });
});
