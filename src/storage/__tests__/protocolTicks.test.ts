/**
 * Body P1b — protocol tick toggle contract, against real SQL.
 *
 * The accessor layer owns the rules the UI (P7b) will lean on: one tick per
 * exercise per local civil day, re-tap untoggles (deletes — an undone tick is
 * absent, never a 0), exercises toggle independently, and a new civil day gets
 * a fresh tick while history stays put.
 */
import { describe, it, expect } from '@jest/globals';
import { runMigrations } from '../db';
import { makeTestDb } from './sqliteTestDb';
import { createObservation } from '../observations';
import { listProtocolTicks, toggleProtocolTick } from '../protocolTicks';

const ARGS = { protocolId: 'proto-1', exerciseId: 'ex-1', tz: 'America/Los_Angeles' };
// Local-noon instants — safely inside one civil day in any test-runner zone.
const DAY1 = new Date(2026, 6, 5, 12, 0, 0);
const DAY2 = new Date(2026, 6, 6, 12, 0, 0);

describe('protocol ticks', () => {
  it('first tap creates one tier-1 tick observation (value 1)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const res = await toggleProtocolTick({ ...ARGS, id: 't1', now: DAY1 }, db);
    expect(res).toEqual({ ticked: true, observationId: 't1' });

    const ticks = await listProtocolTicks({}, db);
    expect(ticks).toHaveLength(1);
    expect(ticks[0].tier).toBe(1);
    expect(ticks[0].payload).toEqual({
      kind: 'subjective',
      metric: 'protocolTick',
      value: 1,
      protocolId: 'proto-1',
      exerciseId: 'ex-1',
    });
  });

  it('re-tap the same day untoggles — the tick row is gone, not zeroed', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await toggleProtocolTick({ ...ARGS, id: 't1', now: DAY1 }, db);
    const res = await toggleProtocolTick({ ...ARGS, id: 't2', now: DAY1 }, db);
    expect(res).toEqual({ ticked: false, observationId: 't1' });
    expect(await listProtocolTicks({}, db)).toHaveLength(0);

    // Tapping again re-ticks with the fresh id — one row, never a stack.
    const res3 = await toggleProtocolTick({ ...ARGS, id: 't3', now: DAY1 }, db);
    expect(res3.ticked).toBe(true);
    expect(await listProtocolTicks({}, db)).toHaveLength(1);
  });

  it('exercises toggle independently within the same day and protocol', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await toggleProtocolTick({ ...ARGS, id: 't1', now: DAY1 }, db);
    await toggleProtocolTick({ ...ARGS, exerciseId: 'ex-2', id: 't2', now: DAY1 }, db);
    expect(await listProtocolTicks({}, db)).toHaveLength(2);

    // Untoggling ex-1 leaves ex-2's tick untouched.
    await toggleProtocolTick({ ...ARGS, id: 't3', now: DAY1 }, db);
    const left = await listProtocolTicks({}, db);
    expect(left).toHaveLength(1);
    expect(left[0].payload.exerciseId).toBe('ex-2');
  });

  it('a new civil day gets its own tick; yesterday stays in the ledger', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await toggleProtocolTick({ ...ARGS, id: 't1', now: DAY1 }, db);
    const res = await toggleProtocolTick({ ...ARGS, id: 't2', now: DAY2 }, db);
    expect(res.ticked).toBe(true); // NOT an untoggle — different day

    const all = await listProtocolTicks({}, db);
    expect(all.map((t) => t.id)).toEqual(['t1', 't2']); // oldest first, both kept
  });

  it('listProtocolTicks windows by occurredAt and ignores other subjective metrics', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await toggleProtocolTick({ ...ARGS, id: 't1', now: DAY1 }, db);
    await toggleProtocolTick({ ...ARGS, id: 't2', now: DAY2 }, db);

    // A neighbouring subjective (a flare-up) must never read as a tick.
    await createObservation(
      {
        id: 'p1',
        kind: 'subjective',
        occurredAt: DAY1.toISOString(),
        loggedAt: DAY1.toISOString(),
        tz: 'America/Los_Angeles',
        tier: 1,
        fidelity: 1,
        source: { type: 'manual' },
        payload: { kind: 'subjective', metric: 'pain', value: 2, zoneId: 'knees' },
      },
      db
    );

    const day1Only = await listProtocolTicks(
      { from: DAY1.toISOString(), to: new Date(DAY1.getTime() + 3600_000).toISOString() },
      db
    );
    expect(day1Only.map((t) => t.id)).toEqual(['t1']);
  });
});
