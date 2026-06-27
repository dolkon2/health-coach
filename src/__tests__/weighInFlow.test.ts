/**
 * Pass 3 end-to-end data path — the slice the UI drives, against real SQL.
 *
 * Mirrors what the Log Weigh-In modal + the Today hooks do, minus React:
 *   lb input -> displayToKg -> createObservation -> listObservations(today)
 *   -> filter weighIns -> computeWeightTrend -> weightTrendDelta.
 * Proves persistence, the local-day query, unit conversion, and the honest
 * "not enough data -> null delta" behavior all line up before we trust the UI.
 */
import { describe, it, expect } from '@jest/globals';
import type { Observation } from '@core/observation';
import { computeWeightTrend, weightTrendDelta } from '@core/trend';
import { isKind, type ObservationOf } from '@core/observation';
import { runMigrations } from '../storage/db';
import {
  createObservation,
  deleteObservation,
  listObservations,
  updateObservation,
} from '../storage/observations';
import { makeTestDb } from '../storage/__tests__/sqliteTestDb';
import { displayToKg } from '../lib/units';

// What the modal builds from a pounds entry (storage stays kg).
function weighInFromLb(id: string, lb: number, occurredAt: string): ObservationOf<'weighIn'> {
  return {
    id,
    kind: 'weighIn',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'America/Los_Angeles',
    tier: 1,
    fidelity: 1.0,
    source: { type: 'manual' },
    payload: { kind: 'weighIn', weightKg: displayToKg(lb, 'lb') },
  };
}

describe('weigh-in flow (Pass 3)', () => {
  it("saves a pounds weigh-in and reads it back in today's window as kg", async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(weighInFromLb('w1', 180, '2026-06-26T15:00:00Z'), db);

    const today = await listObservations(
      { from: '2026-06-26T00:00:00Z', to: '2026-06-26T23:59:59Z' },
      db
    );
    const weighIns = today.filter((o): o is ObservationOf<'weighIn'> =>
      isKind(o, 'weighIn')
    );
    expect(weighIns).toHaveLength(1);
    expect(weighIns[0].payload.weightKg).toBeCloseTo(81.6466, 3); // 180 lb in kg
  });

  it('persists an optional body-fat % in the payload (captured even if not yet shown)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const obs = weighInFromLb('w1', 180, '2026-06-26T15:00:00Z');
    obs.payload = { ...obs.payload, bodyFatPct: 18.5 };
    await createObservation(obs, db);

    const rows = await listObservations({ kinds: ['weighIn'] }, db);
    const weighIns = rows.filter((o): o is ObservationOf<'weighIn'> => isKind(o, 'weighIn'));
    expect(weighIns[0].payload.bodyFatPct).toBe(18.5);
  });

  it('one weigh-in yields no trend delta (honest: not enough data)', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await createObservation(weighInFromLb('w1', 180, '2026-06-26T15:00:00Z'), db);

    const rows = await listObservations({ kinds: ['weighIn'] }, db);
    const weighIns = rows.filter((o): o is ObservationOf<'weighIn'> => isKind(o, 'weighIn'));
    expect(weightTrendDelta(computeWeightTrend(weighIns))).toBeNull();
  });

  it('deleting a weigh-in recalculates the trend honestly (drops below threshold)', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const lbs = [180, 179.6, 179.2, 178.9, 178.5, 178.2, 178];
    for (let i = 0; i < lbs.length; i++) {
      const day = String(20 + i).padStart(2, '0');
      await createObservation(weighInFromLb(`w${i}`, lbs[i], `2026-06-${day}T15:00:00Z`), db);
    }

    // Sanity: with a full week we have a delta.
    let rows = await listObservations({ kinds: ['weighIn'] }, db);
    expect(weightTrendDelta(computeWeightTrend(
      rows.filter((o): o is ObservationOf<'weighIn'> => isKind(o, 'weighIn'))
    ))).not.toBeNull();

    // Delete all but one. The engine has to return null — the felt sense is
    // "not enough data," not a fabricated single-point trend.
    for (let i = 1; i < lbs.length; i++) await deleteObservation(`w${i}`, db);

    rows = await listObservations({ kinds: ['weighIn'] }, db);
    const survivors = rows.filter((o): o is ObservationOf<'weighIn'> =>
      isKind(o, 'weighIn')
    );
    expect(survivors).toHaveLength(1);
    expect(weightTrendDelta(computeWeightTrend(survivors))).toBeNull();
  });

  it('editing a weigh-in changes the trend without changing the row count', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const lbs = [180, 179.6, 179.2, 178.9, 178.5, 178.2, 178];
    for (let i = 0; i < lbs.length; i++) {
      const day = String(20 + i).padStart(2, '0');
      await createObservation(weighInFromLb(`w${i}`, lbs[i], `2026-06-${day}T15:00:00Z`), db);
    }

    // Original trend, last day = ~178 lb.
    let rows = await listObservations({ kinds: ['weighIn'] }, db);
    const original = computeWeightTrend(
      rows.filter((o): o is ObservationOf<'weighIn'> => isKind(o, 'weighIn'))
    );

    // Edit the last weigh-in down to 170 lb. Same id, same occurredAt.
    await updateObservation(weighInFromLb('w6', 170, '2026-06-26T15:00:00Z'), db);

    rows = await listObservations({ kinds: ['weighIn'] }, db);
    expect(rows).toHaveLength(lbs.length); // no extra row created
    const edited = computeWeightTrend(
      rows.filter((o): o is ObservationOf<'weighIn'> => isKind(o, 'weighIn'))
    );
    // Latest trend point should now be meaningfully below the original.
    expect(edited[edited.length - 1].trendKg).toBeLessThan(
      original[original.length - 1].trendKg
    );
  });

  it('a week of weigh-ins produces a real downward delta', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    // 180 -> 178 lb over 7 days.
    const lbs = [180, 179.6, 179.2, 178.9, 178.5, 178.2, 178];
    for (let i = 0; i < lbs.length; i++) {
      const day = String(20 + i).padStart(2, '0');
      await createObservation(weighInFromLb(`w${i}`, lbs[i], `2026-06-${day}T15:00:00Z`), db);
    }

    const rows = await listObservations({ kinds: ['weighIn'] }, db);
    const weighIns = rows.filter((o): o is ObservationOf<'weighIn'> => isKind(o, 'weighIn'));
    const delta = weightTrendDelta(computeWeightTrend(weighIns));

    expect(delta).not.toBeNull();
    expect(delta!.deltaKg).toBeLessThan(0); // trending down
    expect(delta!.days).toBeGreaterThanOrEqual(3);
  });
});
