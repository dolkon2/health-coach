/**
 * queries.test.ts — civil-day windowing and macro totals.
 */
import { describe, it, expect } from '@jest/globals';
import type { Observation } from '@core/observation';
import { runMigrations } from '../db';
import { createObservation } from '../observations';
import { listFoodEntriesForDay, totalsFromEntries } from '../queries';
import { makeTestDb } from './sqliteTestDb';

function fakeFood(
  id: string,
  occurredAt: string,
  payload: { kcal: number; proteinG: number; carbsG: number; fatG: number; description?: string },
  fidelity = 0.7
): Observation {
  return {
    id,
    kind: 'foodEntry',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'America/Los_Angeles',
    tier: 1,
    fidelity,
    source: { type: 'foodapi', provider: 'usda', itemId: '1' },
    payload: {
      kind: 'foodEntry',
      description: payload.description ?? 'test food',
      servings: 1,
      kcal: payload.kcal,
      proteinG: payload.proteinG,
      carbsG: payload.carbsG,
      fatG: payload.fatG,
    },
  };
}

describe('listFoodEntriesForDay', () => {
  it('returns only entries within the local civil day', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    // Pick a fixed local date for the test. Convert to ISO at local midnight ±.
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await createObservation(
      fakeFood('a', yesterday.toISOString(), { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 }),
      db
    );
    await createObservation(
      fakeFood('b', today.toISOString(), { kcal: 200, proteinG: 10, carbsG: 20, fatG: 4 }),
      db
    );

    const todayEntries = await listFoodEntriesForDay(today, db);
    expect(todayEntries.map((o) => o.id)).toEqual(['b']);
  });
});

describe('totalsFromEntries', () => {
  it('sums macros and weights fidelity by kcal', () => {
    const t = new Date().toISOString();
    const entries = [
      fakeFood('1', t, { kcal: 500, proteinG: 40, carbsG: 50, fatG: 10 }, 1.0),
      fakeFood('2', t, { kcal: 100, proteinG: 5, carbsG: 15, fatG: 2 }, 0.4),
    ] as never[];

    const totals = totalsFromEntries(entries);
    expect(totals.kcal).toBe(600);
    expect(totals.proteinG).toBe(45);
    expect(totals.entryCount).toBe(2);
    // Weighted by kcal: (1.0*500 + 0.4*100) / 600 = 540/600 = 0.9
    expect(totals.fidelity).toBeCloseTo(0.9, 2);
  });

  it('returns zeros for empty list', () => {
    const totals = totalsFromEntries([]);
    expect(totals).toEqual({
      kcal: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      fidelity: 0,
      entryCount: 0,
    });
  });
});
