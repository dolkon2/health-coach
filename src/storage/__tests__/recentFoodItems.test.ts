import { describe, it, expect } from '@jest/globals';
import type { Observation } from '@core/observation';
import { runMigrations } from '../db';
import { createObservation } from '../observations';
import { getRecentFoodItems } from '../observations';
import { makeTestDb } from './sqliteTestDb';

function fakeFoodEntry(
  id: string,
  occurredAt: string,
  items: Array<{ foodId: string; description: string; quantity: number }>
): Observation {
  const foodItems = items.map((i) => ({
    sourceDb: 'usda' as const,
    foodId: i.foodId,
    description: i.description,
    quantity: i.quantity,
    quantityMethod: 'measured' as const,
    kcal: 200,
    proteinG: 20,
    carbsG: 5,
    fatG: 10,
    fidelity: 0.9,
    fidelityCeiling: 0.95,
  }));
  return {
    id,
    kind: 'foodEntry',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'America/Los_Angeles',
    tier: 1,
    fidelity: 0.85,
    source: { type: 'manual' },
    payload: {
      kind: 'foodEntry',
      description: 'Meal',
      servings: 1,
      kcal: foodItems.reduce((s, i) => s + (i.kcal ?? 0), 0),
      proteinG: foodItems.reduce((s, i) => s + (i.proteinG ?? 0), 0),
      carbsG: foodItems.reduce((s, i) => s + (i.carbsG ?? 0), 0),
      fatG: foodItems.reduce((s, i) => s + (i.fatG ?? 0), 0),
      inputMethod: 'weighed',
      fidelityCeiling: 0.95,
      items: foodItems,
    },
  };
}

describe('getRecentFoodItems', () => {
  it('returns items matching a search term', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(
      fakeFoodEntry('m1', '2026-06-28T12:00:00Z', [
        { foodId: 'f1', description: 'Chicken breast', quantity: 150 },
        { foodId: 'f2', description: 'Brown rice', quantity: 200 },
      ]),
      db
    );

    const results = await getRecentFoodItems('chicken', db);
    expect(results).toHaveLength(1);
    expect(results[0].item.foodId).toBe('f1');
    expect(results[0].item.quantity).toBe(150);
    expect(results[0].lastLoggedAt).toBe('2026-06-28T12:00:00Z');
  });

  it('deduplicates by foodId, keeping the most recent', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(
      fakeFoodEntry('m1', '2026-06-27T12:00:00Z', [
        { foodId: 'f1', description: 'Cheddar cheese', quantity: 30 },
      ]),
      db
    );
    await createObservation(
      fakeFoodEntry('m2', '2026-06-28T18:00:00Z', [
        { foodId: 'f1', description: 'Cheddar cheese', quantity: 45 },
      ]),
      db
    );

    const results = await getRecentFoodItems('cheddar', db);
    expect(results).toHaveLength(1);
    expect(results[0].item.quantity).toBe(45);
    expect(results[0].lastLoggedAt).toBe('2026-06-28T18:00:00Z');
  });

  it('is case-insensitive', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(
      fakeFoodEntry('m1', '2026-06-28T12:00:00Z', [
        { foodId: 'f1', description: 'Greek Yogurt', quantity: 170 },
      ]),
      db
    );

    const results = await getRecentFoodItems('greek', db);
    expect(results).toHaveLength(1);
    expect(results[0].item.foodId).toBe('f1');
  });

  it('returns empty when no items match', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(
      fakeFoodEntry('m1', '2026-06-28T12:00:00Z', [
        { foodId: 'f1', description: 'Chicken breast', quantity: 150 },
      ]),
      db
    );

    const results = await getRecentFoodItems('salmon', db);
    expect(results).toHaveLength(0);
  });

  it('excludes superseded observations', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createObservation(
      fakeFoodEntry('m1', '2026-06-28T12:00:00Z', [
        { foodId: 'f1', description: 'Chicken breast', quantity: 150 },
      ]),
      db
    );
    // Supersede m1 with m2 (different items)
    await createObservation(
      {
        ...fakeFoodEntry('m2', '2026-06-28T12:00:00Z', [
          { foodId: 'f2', description: 'Turkey breast', quantity: 180 },
        ]),
        supersedes: 'm1',
      } as Observation,
      db
    );

    const results = await getRecentFoodItems('chicken', db);
    expect(results).toHaveLength(0);

    const turkey = await getRecentFoodItems('turkey', db);
    expect(turkey).toHaveLength(1);
  });

  it('skips keyless LLM estimates — no catalog id to recur by (save-as-meal handles reuse)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const estimate: Observation = {
      id: 'e1',
      kind: 'foodEntry',
      occurredAt: '2026-06-29T12:00:00Z',
      loggedAt: '2026-06-29T12:00:00Z',
      tz: 'America/Los_Angeles',
      tier: 1,
      fidelity: 0.45,
      source: { type: 'estimate', modelVersion: 'claude-haiku-4-5' },
      payload: {
        kind: 'foodEntry',
        description: 'Chicken curry',
        servings: 1,
        kcal: 520,
        proteinG: 35,
        carbsG: 40,
        fatG: 22,
        inputMethod: 'described',
        fidelityCeiling: 0.7,
        items: [
          {
            description: 'Chicken curry',
            quantity: 350,
            quantityMethod: 'estimated',
            kcal: 520,
            proteinG: 35,
            carbsG: 40,
            fatG: 22,
            fidelity: 0.45,
            fidelityCeiling: 0.7,
          },
        ],
      },
    };
    await createObservation(estimate, db);

    // The name matches, but a keyless estimate is not a recents catalog entry.
    expect(await getRecentFoodItems('chicken', db)).toHaveLength(0);
  });
});
