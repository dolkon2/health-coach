/**
 * Body P1b — romReading + widened subjective payloads through real SQL.
 *
 * Mirrors weighInFlow.test.ts for the new ObservationKind: an ROM self-test
 * reading persists, lists by kind, edits and deletes — proving the weigh-in
 * analog path needs zero storage/serialize changes (payload JSON passthrough).
 * Also proves the P1b SubjectivePayload extension round-trips: a pain-0 reading
 * stays a recorded 0 (distinct from absent), and a protocolTick keeps its
 * protocol/exercise keys.
 */
import { describe, it, expect } from '@jest/globals';
import { isKind, type ObservationOf } from '@core/observation';
import { runMigrations } from '../storage/db';
import {
  createObservation,
  deleteObservation,
  listObservations,
  updateObservation,
} from '../storage/observations';
import { makeTestDb } from '../storage/__tests__/sqliteTestDb';

function romReading(
  id: string,
  over: Partial<ObservationOf<'romReading'>['payload']> = {},
  occurredAt = '2026-07-05T15:00:00Z'
): ObservationOf<'romReading'> {
  return {
    id,
    kind: 'romReading',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'America/Los_Angeles',
    tier: 1,
    fidelity: 1.0,
    source: { type: 'manual' },
    payload: { kind: 'romReading', testId: 'sit-and-reach', value: 4.5, unit: 'cm', ...over },
  };
}

describe('romReading flow (Body P1b)', () => {
  it('saves a reading and reads it back by kind, payload intact', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await createObservation(romReading('r1'), db);

    const rows = await listObservations({ kinds: ['romReading'] }, db);
    const readings = rows.filter((o): o is ObservationOf<'romReading'> =>
      isKind(o, 'romReading')
    );
    expect(readings).toHaveLength(1);
    expect(readings[0].payload).toEqual({
      kind: 'romReading',
      testId: 'sit-and-reach',
      value: 4.5,
      unit: 'cm',
    });
    // Sideless test: `side` stays honestly absent, never a fabricated value.
    expect('side' in readings[0].payload).toBe(false);
  });

  it('persists an optional side for a sided test', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await createObservation(
      romReading('r1', { testId: 'wall-ankle', side: 'left', value: 11, unit: 'cm' }),
      db
    );

    const [row] = await listObservations({ kinds: ['romReading'] }, db);
    expect(isKind(row, 'romReading') && row.payload.side).toBe('left');
  });

  it('a kind filter keeps readings out of weigh-in queries (and vice versa)', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await createObservation(romReading('r1'), db);

    expect(await listObservations({ kinds: ['weighIn'] }, db)).toHaveLength(0);
    expect(await listObservations({ kinds: ['romReading'] }, db)).toHaveLength(1);
  });

  it('edits in place (weigh-in edit contract) and deletes cleanly', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await createObservation(romReading('r1'), db);

    await updateObservation(romReading('r1', { value: 6 }), db);
    let rows = await listObservations({ kinds: ['romReading'] }, db);
    expect(rows).toHaveLength(1); // no extra row
    expect(isKind(rows[0], 'romReading') && rows[0].payload.value).toBe(6);

    expect(await deleteObservation('r1', db)).toBe(true);
    rows = await listObservations({ kinds: ['romReading'] }, db);
    expect(rows).toHaveLength(0);
  });
});

describe('widened subjective payloads (Body P1b)', () => {
  it('a standalone flare-up with pain 0 round-trips as a RECORDED zero', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const obs: ObservationOf<'subjective'> = {
      id: 'p1',
      kind: 'subjective',
      occurredAt: '2026-07-05T08:00:00Z',
      loggedAt: '2026-07-05T08:00:00Z',
      tz: 'America/Los_Angeles',
      tier: 1,
      fidelity: 1.0,
      source: { type: 'manual' },
      payload: { kind: 'subjective', metric: 'pain', value: 0, zoneId: 'knees', side: 'right' },
    };
    await createObservation(obs, db);

    const [row] = await listObservations({ kinds: ['subjective'] }, db);
    if (!isKind(row, 'subjective')) throw new Error('expected subjective');
    expect(row.payload.metric).toBe('pain');
    expect(row.payload.value).toBe(0); // pain-free READING — present, not absent
    expect(row.payload.zoneId).toBe('knees');
    expect(row.payload.side).toBe('right');
  });

  it('a protocolTick keeps its protocol/exercise keys and the value-1 convention', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const obs: ObservationOf<'subjective'> = {
      id: 't1',
      kind: 'subjective',
      occurredAt: '2026-07-05T08:00:00Z',
      loggedAt: '2026-07-05T08:00:00Z',
      tz: 'America/Los_Angeles',
      tier: 1,
      fidelity: 1.0,
      source: { type: 'manual' },
      payload: {
        kind: 'subjective',
        metric: 'protocolTick',
        value: 1,
        protocolId: 'proto-1',
        exerciseId: 'ex-1',
      },
    };
    await createObservation(obs, db);

    const [row] = await listObservations({ kinds: ['subjective'] }, db);
    if (!isKind(row, 'subjective')) throw new Error('expected subjective');
    expect(row.payload).toEqual(obs.payload);
  });
});
