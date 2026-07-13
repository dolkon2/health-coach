/**
 * Storage round-trip tests for benchmark_groups + the membership join
 * (migration 018, Phase 4 P4-3 / B4). Real SQL via better-sqlite3 in-memory
 * — house rule: real DB, never a mock.
 */
import { describe, it, expect } from '@jest/globals';
import type { Benchmark } from '@core/benchmark';
import { runMigrations } from '../db';
import { createBenchmark, getBenchmarkById } from '../benchmarks';
import {
  createBenchmarkGroup,
  listBenchmarkGroups,
  getBenchmarkGroupById,
  updateBenchmarkGroup,
  deleteBenchmarkGroup,
  addBenchmarkToGroup,
  removeBenchmarkFromGroup,
  listGroupMemberIds,
  listGroupsForBenchmark,
  listBenchmarkGroupsWithCounts,
  pausedBenchmarkIds,
} from '../benchmarkGroups';
import { makeTestDb } from './sqliteTestDb';

function behaviorBenchmark(id: string, over: Partial<Benchmark> = {}): Benchmark {
  return {
    id,
    createdAt: '2026-07-01T10:00:00Z',
    status: 'active',
    title: `Benchmark ${id}`,
    behavior: {
      dimension: { metric: 'sessionCount', modality: 'paddle', activity: 'kayak' },
      window: 'week',
      measure: { type: 'count', target: 4 },
    },
    pinned: true,
    ...over,
  };
}

describe('benchmark groups storage', () => {
  it('round-trips a group and lists newest first', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmarkGroup(
      { id: 'g-old', createdAt: '2026-07-01T00:00:00Z', title: 'Kayak season', paused: false },
      db
    );
    await createBenchmarkGroup(
      { id: 'g-new', createdAt: '2026-07-02T00:00:00Z', title: 'Winter push', paused: true },
      db
    );

    const all = await listBenchmarkGroups(db);
    expect(all.map((g) => g.id)).toEqual(['g-new', 'g-old']);

    const got = await getBenchmarkGroupById('g-old', db);
    expect(got).toEqual({
      id: 'g-old',
      createdAt: '2026-07-01T00:00:00Z',
      title: 'Kayak season',
      paused: false,
    });
  });

  it('updateBenchmarkGroup patches title and the paused toggle', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmarkGroup(
      { id: 'g-1', createdAt: '2026-07-01T00:00:00Z', title: 'Original', paused: false },
      db
    );

    const updated = await updateBenchmarkGroup('g-1', { paused: true }, db);
    expect(updated.paused).toBe(true);
    expect(updated.title).toBe('Original'); // untouched field preserved

    const renamed = await updateBenchmarkGroup('g-1', { title: 'Renamed' }, db);
    expect(renamed.title).toBe('Renamed');
    expect(renamed.paused).toBe(true);
  });

  it('updateBenchmarkGroup throws when the id does not exist', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await expect(updateBenchmarkGroup('ghost', { paused: true }, db)).rejects.toThrow(
      /benchmark group ghost not found/
    );
  });

  it('add/remove membership is idempotent and queryable both directions', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(behaviorBenchmark('b-1'), db);
    await createBenchmark(behaviorBenchmark('b-2'), db);
    await createBenchmarkGroup(
      { id: 'g-1', createdAt: '2026-07-01T00:00:00Z', title: 'Group', paused: false },
      db
    );

    await addBenchmarkToGroup('g-1', 'b-1', db);
    await addBenchmarkToGroup('g-1', 'b-2', db);
    await addBenchmarkToGroup('g-1', 'b-1', db); // duplicate add — no-op (INSERT OR IGNORE)

    expect(new Set(await listGroupMemberIds('g-1', db))).toEqual(new Set(['b-1', 'b-2']));
    expect((await listGroupsForBenchmark('b-1', db)).map((g) => g.id)).toEqual(['g-1']);

    await removeBenchmarkFromGroup('g-1', 'b-1', db);
    expect(await listGroupMemberIds('g-1', db)).toEqual(['b-2']);
    expect(await listGroupsForBenchmark('b-1', db)).toEqual([]);
  });

  it('deleteBenchmarkGroup removes the group and its membership rows only', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(behaviorBenchmark('b-1'), db);
    await createBenchmarkGroup(
      { id: 'g-1', createdAt: '2026-07-01T00:00:00Z', title: 'Group', paused: false },
      db
    );
    await addBenchmarkToGroup('g-1', 'b-1', db);

    await deleteBenchmarkGroup('g-1', db);

    expect(await getBenchmarkGroupById('g-1', db)).toBeNull();
    expect(await listGroupMemberIds('g-1', db)).toEqual([]);
    // The member benchmark itself survives the group's deletion untouched.
    expect(await getBenchmarkById('b-1', db)).not.toBeNull();
  });

  it('listBenchmarkGroupsWithCounts reports member counts, zero for an empty group', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(behaviorBenchmark('b-1'), db);
    await createBenchmark(behaviorBenchmark('b-2'), db);
    await createBenchmarkGroup(
      { id: 'g-full', createdAt: '2026-07-01T00:00:00Z', title: 'Full', paused: false },
      db
    );
    await createBenchmarkGroup(
      { id: 'g-empty', createdAt: '2026-07-02T00:00:00Z', title: 'Empty', paused: false },
      db
    );
    await addBenchmarkToGroup('g-full', 'b-1', db);
    await addBenchmarkToGroup('g-full', 'b-2', db);

    const withCounts = await listBenchmarkGroupsWithCounts(db);
    const byId = Object.fromEntries(withCounts.map((g) => [g.id, g.memberCount]));
    expect(byId['g-full']).toBe(2);
    expect(byId['g-empty']).toBe(0);
  });

  it('pausedBenchmarkIds returns members of paused groups only, deduped across groups', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createBenchmark(behaviorBenchmark('b-active-group'), db);
    await createBenchmark(behaviorBenchmark('b-paused-group'), db);
    await createBenchmark(behaviorBenchmark('b-both-groups'), db);
    await createBenchmark(behaviorBenchmark('b-no-group'), db);

    await createBenchmarkGroup(
      { id: 'g-active', createdAt: '2026-07-01T00:00:00Z', title: 'Active', paused: false },
      db
    );
    await createBenchmarkGroup(
      { id: 'g-paused-1', createdAt: '2026-07-01T00:00:00Z', title: 'Paused 1', paused: true },
      db
    );
    await createBenchmarkGroup(
      { id: 'g-paused-2', createdAt: '2026-07-01T00:00:00Z', title: 'Paused 2', paused: true },
      db
    );

    await addBenchmarkToGroup('g-active', 'b-active-group', db);
    await addBenchmarkToGroup('g-paused-1', 'b-paused-group', db);
    await addBenchmarkToGroup('g-paused-1', 'b-both-groups', db);
    await addBenchmarkToGroup('g-paused-2', 'b-both-groups', db); // same benchmark, second paused group

    const paused = await pausedBenchmarkIds(db);
    expect(paused).toEqual(new Set(['b-paused-group', 'b-both-groups']));
    expect(paused.has('b-active-group')).toBe(false);
    expect(paused.has('b-no-group')).toBe(false);

    // Resuming the group drops its members out of the paused set — the
    // benchmark's own row is never touched by this call.
    await updateBenchmarkGroup('g-paused-1', { paused: false }, db);
    const afterResume = await pausedBenchmarkIds(db);
    expect(afterResume).toEqual(new Set(['b-both-groups'])); // still paused via g-paused-2
  });
});
