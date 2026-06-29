/**
 * Food-log model tests (Ring 2 / Pass 2.5). The plan's Proof, at the logic layer
 * (the repo has no RN render-test setup — same pure-builder convention as Pass 4):
 *   - a weighed meal blends to HIGH; a vague described meal to LOW;
 *   - switching nutrition focus changes only the displayed hero, not the stored row;
 *   - fidelity surfaces only as a visual treatment — never a number;
 *   - a partial (protein-only) log is valid (no nag) and stores null, not 0.
 */
import { describe, it, expect } from '@jest/globals';
import { isPartial, type FoodEntryPayload, type FoodItem } from '@core/observation';
import { defaultFidelity, tierOf } from '@core/nutrition/fidelity';
import {
  parseDescribed,
  describedExtraction,
  describedQuantityG,
  rollupMacros,
  dailyTotals,
  validateFoodLog,
  buildMealLog,
  mealTemplateFrom,
  mealItemsLabel,
  itemMacroSummary,
  scaleMacros,
  heroNumber,
  fidelityTreatment,
  type FoodLogInput,
} from '@/lib/foodLog';

function foodItem(over: Partial<FoodItem> = {}): FoodItem {
  return {
    sourceDb: 'usda',
    foodId: '173414',
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
const CTX = { id: 'meal-1', now: '2026-06-10T12:00:00Z', tz: 'America/Los_Angeles' };

describe('parseDescribed + described fidelity (parse, not channel)', () => {
  it('"8 oz ribeye" → food + quantity + unit → MID', () => {
    const parsed = parseDescribed('8 oz ribeye');
    expect(parsed.foodText).toBe('ribeye');
    expect(parsed.quantity).toBe(8);
    expect(parsed.unit).toBe('oz');
    expect(parsed.grams).toBeCloseTo(226.8, 1);
    expect(describedQuantityG(parsed)).toBeCloseTo(226.8, 1);

    const f = defaultFidelity('described', describedExtraction(parsed));
    expect(f).toBeCloseTo(0.6, 5);
    expect(tierOf(f)).toBe('MID');
  });

  it('"steak" → food only, no portion → LOW (nominal portion carries the uncertainty)', () => {
    const parsed = parseDescribed('steak');
    expect(parsed.foodText).toBe('steak');
    expect(parsed.quantity).toBeUndefined();
    expect(describedQuantityG(parsed)).toBe(100); // DEFAULT_PORTION_G

    const f = defaultFidelity('described', describedExtraction(parsed));
    expect(tierOf(f)).toBe('LOW');
  });
});

describe('rollupMacros', () => {
  it('sums complete items', () => {
    const r = rollupMacros([foodItem({ kcal: 200 }), foodItem({ kcal: 300, proteinG: 25 })]);
    expect(r.kcal).toBe(500);
    expect(r.proteinG).toBe(45);
  });

  it('rolls a macro to null when ANY item is missing it (never an undercount)', () => {
    const r = rollupMacros([foodItem({ kcal: 200 }), foodItem({ kcal: null })]);
    expect(r.kcal).toBeNull();
    expect(r.kcal).not.toBe(0);
  });
});

describe('dailyTotals — honest cross-meal sum (null≠0, one partial ≠ whole day null)', () => {
  type DM = Pick<FoodEntryPayload, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>;
  const meal = (over: Partial<DM> = {}): DM => ({ kcal: 200, proteinG: 20, carbsG: 10, fatG: 5, ...over });

  it('sums the day across complete meals', () => {
    const t = dailyTotals([meal(), meal({ kcal: 300, proteinG: 25 })]);
    expect(t.kcal.value).toBe(500);
    expect(t.proteinG.value).toBe(45);
    expect(t.kcal.missing).toBe(0);
    expect(t.entryCount).toBe(2);
    expect(t.partialCount).toBe(0);
  });

  it("excludes a missing macro from the sum (never 0) but keeps the meal's other macros", () => {
    const t = dailyTotals([meal({ kcal: 200 }), meal({ kcal: null, proteinG: 30 })]);
    expect(t.kcal.value).toBe(200); // only the meal that had kcal — the null is NOT summed as 0
    expect(t.kcal.missing).toBe(1);
    expect(t.proteinG.value).toBe(50); // 20 + 30 — the partial meal's protein still counts
    expect(t.partialCount).toBe(1);
  });

  it('totals a macro to null only when NOT ONE entry captured it', () => {
    const t = dailyTotals([meal({ kcal: null }), meal({ kcal: null })]);
    expect(t.kcal.value).toBeNull();
    expect(t.kcal.value).not.toBe(0);
    expect(t.kcal.missing).toBe(2);
  });

  it('an empty day is all-null with zero counts (nothing known, nothing fabricated)', () => {
    const t = dailyTotals([]);
    expect(t.kcal.value).toBeNull();
    expect(t.proteinG.value).toBeNull();
    expect(t.entryCount).toBe(0);
    expect(t.partialCount).toBe(0);
  });
});

describe('buildMealLog — composite fidelity → tier', () => {
  it('a weighed meal blends to HIGH and stores the rollup macros', () => {
    const obs = buildMealLog(
      { description: 'ribeye', items: [foodItem()], inputMethod: 'weighed' },
      CTX
    );
    expect(tierOf(obs.fidelity)).toBe('HIGH');
    expect(obs.payload.kcal).toBe(200);
    expect(obs.payload.inputMethod).toBe('weighed');
    expect(obs.payload.fidelityCeiling).toBe(0.98);
    expect(obs.source).toEqual({ type: 'foodapi', provider: 'usda', itemId: '173414' });
    expect(obs.tier).toBe(1);
  });

  it('a vague described meal blends to LOW', () => {
    const described = foodItem({ fidelity: 0.3, fidelityCeiling: 0.7, quantityMethod: 'estimated' });
    const obs = buildMealLog(
      { description: 'steak', items: [described], inputMethod: 'described' },
      CTX
    );
    expect(tierOf(obs.fidelity)).toBe('LOW');
  });

  it('stamps templateId when re-logging a saved meal, omits it otherwise', () => {
    const plain = buildMealLog({ description: 'm', items: [foodItem()], inputMethod: 'weighed' }, CTX);
    expect(plain.payload).not.toHaveProperty('templateId');

    const relog = buildMealLog(
      { description: 'm', items: [foodItem()], inputMethod: 'weighed', templateId: 'tpl-1' },
      CTX
    );
    expect(relog.payload.templateId).toBe('tpl-1');
  });
});

describe('focus is display-only', () => {
  it('switching focus changes the hero number, never the stored row', () => {
    const obs = buildMealLog({ description: 'meal', items: [foodItem()], inputMethod: 'weighed' }, CTX);
    const snapshot = JSON.parse(JSON.stringify(obs.payload));

    const cals = heroNumber(obs.payload, 'calories');
    const prot = heroNumber(obs.payload, 'protein');
    expect(cals).toEqual({ label: 'Calories', value: 200, unit: 'kcal' });
    expect(prot).toEqual({ label: 'Protein', value: 20, unit: 'g' });

    expect(obs.payload).toEqual(snapshot); // reading the hero mutated nothing
    expect(obs.payload).not.toHaveProperty('focus'); // there is no focus field to gate capture
  });
});

describe('fidelityTreatment — visual only, never a number', () => {
  it('maps each band to its brand-kit treatment with no fidelity value leaking', () => {
    expect(fidelityTreatment(0.95)).toEqual({ tier: 'HIGH', opacity: 1.0, stroke: 'solid', dot: 'filled' });
    expect(fidelityTreatment(0.6)).toEqual({ tier: 'MID', opacity: 0.7, stroke: 'solid', dot: 'hollow' });
    expect(fidelityTreatment(0.3)).toEqual({ tier: 'LOW', opacity: 0.45, stroke: 'dashed', dot: 'dotted' });

    const t = fidelityTreatment(0.95);
    expect(t).not.toHaveProperty('fidelity');
    expect(Object.values(t)).not.toContain(0.95); // the raw 0..1 value never escapes
  });
});

describe('partial logs are a first-class valid state (no nag)', () => {
  it('a protein-only described log validates, stores null kcal/carbs/fat, and reads as partial', () => {
    const proteinOnly = foodItem({ kcal: null, carbsG: null, fatG: null, proteinG: 42, fidelity: 0.3, fidelityCeiling: 0.7 });
    const input: FoodLogInput = { description: '42g protein', items: [proteinOnly], inputMethod: 'described' };

    expect(validateFoodLog(input)).toBeNull(); // valid — no "complete this log" gate

    const pl = buildMealLog(input, CTX).payload as FoodEntryPayload;
    expect(pl.proteinG).toBe(42);
    expect(pl.kcal).toBeNull();
    expect(pl.carbsG).toBeNull();
    expect(pl.kcal).not.toBe(0);
    expect(isPartial(pl)).toBe(true);
  });

  it('an empty meal is the only thing that blocks saving', () => {
    expect(validateFoodLog({ description: '', items: [], inputMethod: 'weighed' })).toBe('Add a food.');
  });
});

describe('mealTemplateFrom (save this meal)', () => {
  it('builds a user-confirmed template with no earned-fidelity field', () => {
    const t = mealTemplateFrom([foodItem()], { id: 'tpl-1', now: CTX.now });
    expect(t).toEqual({
      id: 'tpl-1',
      createdAt: CTX.now,
      userConfirmed: true,
      canonicalItems: [foodItem()],
    });
    expect(t).not.toHaveProperty('earnedFidelity');
  });
});

describe('scaleMacros (live portion preview)', () => {
  const basis = { kcal: 400, proteinG: 20, carbsG: 10, fatG: 30, quantity: 100 };

  it('scales a per-100g basis to the typed grams', () => {
    expect(scaleMacros(basis, 50)).toEqual({ kcal: 200, proteinG: 10, carbsG: 5, fatG: 15 });
    expect(scaleMacros(basis, 20)).toEqual({ kcal: 80, proteinG: 4, carbsG: 2, fatG: 6 });
  });

  it('preserves a null macro (never fabricates one)', () => {
    expect(scaleMacros({ ...basis, kcal: null }, 50).kcal).toBeNull();
  });
});

describe('itemMacroSummary (per-item breakdown line)', () => {
  it('formats the four macros, "—" for a missing one (never 0)', () => {
    expect(itemMacroSummary({ kcal: 513, proteinG: 96, carbsG: 0, fatG: 12 })).toBe(
      '513 cal · 96 P · 0 C · 12 F'
    );
    expect(itemMacroSummary({ kcal: null, proteinG: 30, carbsG: null, fatG: null })).toBe(
      '— cal · 30 P · — C · — F'
    );
  });
});

describe('mealItemsLabel + named templates (readable saved meals)', () => {
  it('joins the unique item names', () => {
    expect(
      mealItemsLabel([foodItem({ description: 'Cheddar cheese' }), foodItem({ description: 'Crackers' })])
    ).toBe('Cheddar cheese, Crackers');
  });

  it('dedupes repeats and skips unnamed items', () => {
    expect(
      mealItemsLabel([foodItem({ description: 'Rice' }), foodItem({ description: 'Rice' }), foodItem()])
    ).toBe('Rice');
  });

  it('is empty when no item carries a name', () => {
    expect(mealItemsLabel([foodItem(), foodItem()])).toBe('');
  });

  it('names a template from ctx.name, else from the items, else omits it', () => {
    const explicit = mealTemplateFrom([foodItem({ description: 'Cheddar cheese' })], {
      id: 't1',
      now: CTX.now,
      name: 'Snack plate',
    });
    expect(explicit.name).toBe('Snack plate');

    const derived = mealTemplateFrom([foodItem({ description: 'Cheddar cheese' })], { id: 't2', now: CTX.now });
    expect(derived.name).toBe('Cheddar cheese');

    const unnamed = mealTemplateFrom([foodItem()], { id: 't3', now: CTX.now });
    expect(unnamed).not.toHaveProperty('name');
  });
});
