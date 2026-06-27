/**
 * Storage smoke test — insert a weigh-in and read it back, against real SQL
 * (in-memory SQLite). Also covers the append-only supersede behavior.
 */
import { describe, it, expect } from '@jest/globals';
import type { Observation } from '@core/observation';
import { runMigrations } from '../db';
import {
  createObservation,
  listObservations,
  getObservationById,
  supersedeObservation,
  deleteObservation,
  updateObservation,
} from '../observations';
import { makeTestDb } from './sqliteTestDb';

function fakeWeighIn(id: string, weightKg: number, occurredAt: string): Observation {
  return {
    id,
    kind: 'weighIn',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'America/Los_Angeles',
    tier: 1,
    fidelity: 1.0,
    source: { type: 'manual' },
    payload: { kind: 'weighIn', weightKg },
  };
}

describe('observations storage', () => {
  it('inserts a weigh-in and reads it back', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(fakeWeighIn('w1', 80, '2026-06-26T14:00:00Z'), db);

    const back = await getObservationById('w1', db);
    expect(back).not.toBeNull();
    expect(back!.tier).toBe(1);
    expect(back!.fidelity).toBe(1.0);
    expect(back!.source).toEqual({ type: 'manual' });
    expect(back!.payload).toEqual({ kind: 'weighIn', weightKg: 80 });

    const list = await listObservations({ kinds: ['weighIn'] }, db);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('w1');
  });

  it('supersede keeps history but list returns only the latest version', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(fakeWeighIn('w1', 80, '2026-06-26T14:00:00Z'), db);
    await supersedeObservation('w1', fakeWeighIn('w2', 80.5, '2026-06-26T14:00:00Z'), db);

    const list = await listObservations({ kinds: ['weighIn'] }, db);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('w2');
    expect((list[0].payload as { weightKg: number }).weightKg).toBe(80.5);

    // The old version is still retrievable by id (append-only).
    expect(await getObservationById('w1', db)).not.toBeNull();
  });

  it('deleteObservation removes the row and returns true; false when missing', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(fakeWeighIn('w1', 80, '2026-06-26T14:00:00Z'), db);
    expect(await deleteObservation('w1', db)).toBe(true);
    expect(await getObservationById('w1', db)).toBeNull();
    expect(await listObservations({ kinds: ['weighIn'] }, db)).toHaveLength(0);

    // Idempotent: deleting again is a no-op, not an error.
    expect(await deleteObservation('w1', db)).toBe(false);
  });

  it('updateObservation overwrites payload in place; id and loggedAt preserved', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = fakeWeighIn('w1', 80, '2026-06-26T14:00:00Z');
    await createObservation(original, db);

    // User edited the weight. We deliberately pass a different loggedAt to
    // assert it is ignored — original loggedAt is the source of truth.
    const edited: Observation = {
      ...original,
      loggedAt: '2026-06-27T09:00:00Z',
      fidelity: 0.9,
      payload: { kind: 'weighIn', weightKg: 81.2 },
    };
    await updateObservation(edited, db);

    const back = await getObservationById('w1', db);
    expect(back).not.toBeNull();
    expect(back!.id).toBe('w1');
    expect(back!.loggedAt).toBe(original.loggedAt);
    expect(back!.fidelity).toBe(0.9);
    expect((back!.payload as { weightKg: number }).weightKg).toBe(81.2);

    // list() still returns one row (no supersede chain created).
    const list = await listObservations({ kinds: ['weighIn'] }, db);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('w1');
  });

  it('updateObservation throws when the id does not exist', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await expect(
      updateObservation(fakeWeighIn('ghost', 75, '2026-06-26T14:00:00Z'), db)
    ).rejects.toThrow(/no observation with id ghost/);
  });

  it('filters by date window', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(fakeWeighIn('a', 80, '2026-06-01T12:00:00Z'), db);
    await createObservation(fakeWeighIn('b', 81, '2026-06-15T12:00:00Z'), db);
    await createObservation(fakeWeighIn('c', 82, '2026-06-30T12:00:00Z'), db);

    const mid = await listObservations(
      { from: '2026-06-10T00:00:00Z', to: '2026-06-20T00:00:00Z' },
      db
    );
    expect(mid.map((o) => o.id)).toEqual(['b']);
  });
});
