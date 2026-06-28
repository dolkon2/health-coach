/**
 * Meal-log + template persistence tests (Ring 2 / Pass 2.4). The plan's Proof:
 *   - a multi-item weighed meal round-trips through SQLite identical;
 *   - save a template, log it 3× via 2 methods → occurrencesFor returns 3 rows
 *     with the right per-method tags (occurrences are a query, not a counter);
 *   - the meal_templates table has no fidelity column;
 *   - (Item 1) focus never gates capture — a fully-resolved meal persists every
 *     macro and stores no `focus` field;
 *   - (Item 6) a protein-only `described` log stores null kcal/carbs/fat (never
 *     0, never inferred) and isPartial() reads it; a complete log is not partial.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  isPartial,
  type FoodEntryPayload,
  type FoodItem,
  type InputMethod,
  type ObservationOf,
} from '@core/observation';
import { makeTestDb } from './sqliteTestDb';
import { runMigrations, type SqlDatabase } from '../db';
import { createObservation, getObservationById } from '../observations';
import {
  createMealTemplate,
  getMealTemplateById,
  occurrencesFor,
} from '../mealTemplates';

function foodItem(over: Partial<FoodItem> = {}): FoodItem {
  return {
    sourceDb: 'usda',
    foodId: '1008',
    quantity: 100,
    quantityMethod: 'measured',
    kcal: 200,
    proteinG: 20,
    carbsG: 10,
    fatG: 5,
    fidelity: 0.95,
    fidelityCeiling: 0.98,
    ...over,
  };
}

function mealObs(o: {
  id: string;
  occurredAt: string;
  inputMethod: InputMethod;
  items: FoodItem[];
  macros: { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };
  templateId?: string;
}): ObservationOf<'foodEntry'> {
  return {
    id: o.id,
    kind: 'foodEntry',
    occurredAt: o.occurredAt,
    loggedAt: o.occurredAt,
    tz: 'America/Los_Angeles',
    tier: 1,
    fidelity: 0.9,
    source: { type: 'foodapi', provider: 'usda', itemId: '1008' },
    payload: {
      kind: 'foodEntry',
      description: 'test meal',
      servings: 1,
      kcal: o.macros.kcal,
      proteinG: o.macros.proteinG,
      carbsG: o.macros.carbsG,
      fatG: o.macros.fatG,
      items: o.items,
      inputMethod: o.inputMethod,
      fidelityCeiling: 0.98,
      ...(o.templateId ? { templateId: o.templateId } : {}),
    },
  };
}

let db: SqlDatabase;
beforeEach(async () => {
  db = makeTestDb();
  await runMigrations(db); // 001..004
});

describe('meal-log persistence', () => {
  it('round-trips a multi-item weighed meal with items + method + ceiling intact', async () => {
    const meal = mealObs({
      id: 'm1',
      occurredAt: '2026-06-01T12:00:00Z',
      inputMethod: 'weighed',
      items: [foodItem({ foodId: 'a' }), foodItem({ foodId: 'b', sourceDb: 'openfoodfacts', fidelityCeiling: 0.85 })],
      macros: { kcal: 400, proteinG: 40, carbsG: 20, fatG: 10 },
    });
    await createObservation(meal, db);

    const back = await getObservationById('m1', db);
    expect(back).toEqual(meal); // exact deep round-trip — JSON payload + source
    const pl = back!.payload as FoodEntryPayload;
    expect(pl.items).toHaveLength(2);
    expect(pl.inputMethod).toBe('weighed');
    expect(pl.fidelityCeiling).toBe(0.98);
    expect(pl.items[1].fidelityCeiling).toBe(0.85);
  });
});

describe('templates + occurrences (a query, not a counter)', () => {
  it('saves a template, then occurrencesFor returns one row per re-log with per-method tags', async () => {
    const template = {
      id: 't1',
      createdAt: '2026-06-01T00:00:00Z',
      userConfirmed: true,
      canonicalItems: [foodItem()],
    };
    await createMealTemplate(template, db);
    expect(await getMealTemplateById('t1', db)).toEqual(template);
  });

  it('persists and reads back a meal name (resolves the nameless-saved-meal quirk)', async () => {
    const named = {
      id: 'tn',
      name: 'Chicken & rice bowl',
      createdAt: '2026-06-02T00:00:00Z',
      userConfirmed: true,
      canonicalItems: [foodItem({ description: 'Chicken' }), foodItem({ description: 'Rice' })],
    };
    await createMealTemplate(named, db);
    expect(await getMealTemplateById('tn', db)).toEqual(named); // name round-trips

    // A nameless template stays nameless (no fabricated label at the storage layer).
    const bare = { id: 'tb', createdAt: '2026-06-02T00:00:00Z', userConfirmed: true, canonicalItems: [foodItem()] };
    await createMealTemplate(bare, db);
    expect(await getMealTemplateById('tb', db)).not.toHaveProperty('name');

    const m = (id: string, day: number, method: InputMethod, templateId?: string) =>
      mealObs({
        id,
        occurredAt: `2026-06-0${day}T12:00:00Z`,
        inputMethod: method,
        items: [foodItem()],
        macros: { kcal: 200, proteinG: 20, carbsG: 10, fatG: 5 },
        templateId,
      });
    await createObservation(m('o1', 1, 'weighed', 't1'), db);
    await createObservation(m('o2', 2, 'weighed', 't1'), db);
    await createObservation(m('o3', 3, 'described', 't1'), db);
    await createObservation(m('o4', 4, 'barcode'), db); // no templateId — must not count

    const occ = await occurrencesFor('t1', db);
    expect(occ).toHaveLength(3);
    expect(occ.map((o) => o.observationId)).toEqual(['o1', 'o2', 'o3']); // occurredAt ASC
    expect(occ.map((o) => o.inputMethod)).toEqual(['weighed', 'weighed', 'described']);
  });

  it('the meal_templates table has no earned-fidelity column', async () => {
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(meal_templates);');
    const names = cols.map((c) => c.name);
    expect(names).toEqual(['id', 'createdAt', 'userConfirmed', 'canonicalItems', 'name']);
    expect(names.some((n) => n.toLowerCase().includes('fidelity'))).toBe(false);
  });
});

describe('capture invariants', () => {
  it('(Item 1) focus never gates capture — a resolved meal persists every macro, stores no focus', async () => {
    const meal = mealObs({
      id: 'f1',
      occurredAt: '2026-06-05T12:00:00Z',
      inputMethod: 'weighed',
      items: [foodItem()],
      macros: { kcal: 520, proteinG: 40, carbsG: 30, fatG: 22 },
    });
    await createObservation(meal, db);

    const pl = (await getObservationById('f1', db))!.payload as FoodEntryPayload;
    expect([pl.kcal, pl.proteinG, pl.carbsG, pl.fatG]).toEqual([520, 40, 30, 22]);
    // Focus is display-only: there is no field on the row for it to gate.
    expect(pl).not.toHaveProperty('focus');
    expect(isPartial(pl)).toBe(false);
  });

  it('(Item 6) a protein-only described log stores null kcal/carbs/fat (never 0/inferred)', async () => {
    const partial = mealObs({
      id: 'p1',
      occurredAt: '2026-06-06T12:00:00Z',
      inputMethod: 'described',
      items: [foodItem({ kcal: null, carbsG: null, fatG: null, proteinG: 42, fidelity: 0.3, fidelityCeiling: 0.7 })],
      macros: { kcal: null, proteinG: 42, carbsG: null, fatG: null },
    });
    await createObservation(partial, db);

    const pl = (await getObservationById('p1', db))!.payload as FoodEntryPayload;
    expect(pl.proteinG).toBe(42);
    expect(pl.kcal).toBeNull();
    expect(pl.carbsG).toBeNull();
    expect(pl.fatG).toBeNull();
    expect(pl.kcal).not.toBe(0); // null is "not captured", never a fabricated 0
    expect(isPartial(pl)).toBe(true);
  });
});
