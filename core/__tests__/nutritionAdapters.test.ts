/**
 * Nutrition-adapter tests (Ring 2 / Pass 2.2). The Proof the plan asks for, run
 * against REAL captured API responses (no live network in CI):
 *   - a USDA Branded fixture scales its per-serving label to the requested grams;
 *   - a USDA SR Legacy fixture scales its per-100g nutrients — same internal shape
 *     despite the different unit base;
 *   - an OFF fixture with missing fields drops fidelity (and reports null, not 0);
 *   - provenance on each emitted item matches ObservationSource.foodapi.
 *
 * Fixtures live in core/src/nutrition/__fixtures__ and are loaded from disk. The
 * sparse OFF fixture is derived from a real OFF capture with macro keys removed —
 * see dev-log/ring2-pass-2.2.md.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ObservationSource } from '@core/observation';
import { adaptUsdaFood, type UsdaFoodResponse } from '@core/nutrition/usda';
import { adaptOpenFoodFactsProduct, type OffProductResponse } from '@core/nutrition/openfoodfacts';
import { tierOf } from '@core/nutrition/fidelity';

const FX = join(__dirname, '..', 'src', 'nutrition', '__fixtures__');
function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

describe('adaptUsdaFood — Branded (labelNutrients per serving)', () => {
  const raw = load<UsdaFoodResponse>('usda-branded-peanut-butter.json');
  const weighed30 = { method: 'weighed', quantityG: 30, quantityMethod: 'measured' } as const;

  it('scales the per-serving label to the requested grams (30 g = one serving)', () => {
    const item = adaptUsdaFood(raw, weighed30);
    expect(item.kcal).toBe(180);
    expect(item.proteinG).toBe(6);
    expect(item.carbsG).toBe(6);
    expect(item.fatG).toBe(15);
    expect(item.fiberG).toBeCloseTo(2.0, 5);
    expect(item.quantity).toBe(30);
    expect(item.quantityMethod).toBe('measured');
  });

  it('scales linearly to a non-serving quantity (45 g = 1.5 servings)', () => {
    const item = adaptUsdaFood(raw, { method: 'weighed', quantityG: 45, quantityMethod: 'measured' });
    expect(item.kcal).toBe(270);
    expect(item.proteinG).toBe(9);
    expect(item.carbsG).toBe(9);
    expect(item.fatG).toBe(22.5);
  });

  it('weighed + Branded → HIGH fidelity (~0.90), capped by the weighed ceiling', () => {
    const item = adaptUsdaFood(raw, weighed30);
    expect(item.fidelity).toBeCloseTo(0.9, 5);
    expect(item.fidelityCeiling).toBe(0.98);
    expect(tierOf(item.fidelity)).toBe('HIGH');
  });

  it('provenance matches ObservationSource.foodapi', () => {
    const item = adaptUsdaFood(raw, weighed30);
    const source: ObservationSource = { type: 'foodapi', provider: item.sourceDb, itemId: item.foodId };
    expect(source).toEqual({ type: 'foodapi', provider: 'usda', itemId: '2031766' });
  });
});

describe('adaptUsdaFood — SR Legacy (foodNutrients per 100 g)', () => {
  const raw = load<UsdaFoodResponse>('usda-sr-legacy-cheddar.json');
  const weighed100 = { method: 'weighed', quantityG: 100, quantityMethod: 'measured' } as const;

  it('flattens per-100g nutrients (from 138 noisy nutrients) and scales correctly', () => {
    const item = adaptUsdaFood(raw, weighed100);
    expect(item.kcal).toBe(403);
    expect(item.proteinG).toBeCloseTo(22.9, 5);
    expect(item.carbsG).toBeCloseTo(3.4, 5);
    expect(item.fatG).toBeCloseTo(33.3, 5);
    // fiber is present-and-zero for cheddar → a captured 0, not a missing null.
    expect(item.fiberG).toBe(0);
  });

  it('weighed + Foundation/SR → HIGH fidelity (~0.95)', () => {
    const item = adaptUsdaFood(raw, weighed100);
    expect(item.fidelity).toBeCloseTo(0.95, 5);
    expect(tierOf(item.fidelity)).toBe('HIGH');
    expect(item.foodId).toBe('173414');
  });
});

describe('adaptOpenFoodFactsProduct — completeness drives fidelity', () => {
  const complete = load<OffProductResponse>('off-complete-thai-sauce.json');
  const sparse = load<OffProductResponse>('off-sparse-derived.json');
  const barcode100 = { method: 'barcode', quantityG: 100, quantityMethod: 'package' } as const;

  it('parses a complete per-100g record and scales it', () => {
    const item = adaptOpenFoodFactsProduct(complete, barcode100);
    expect(item.kcal).toBe(385);
    expect(item.proteinG).toBeCloseTo(9.6, 5);
    expect(item.carbsG).toBeCloseTo(71.2, 5);
    expect(item.fatG).toBeCloseTo(7.7, 5);
    expect(item.sourceDb).toBe('openfoodfacts');
  });

  it('a complete record sits at the barcode default (~0.80)', () => {
    const item = adaptOpenFoodFactsProduct(complete, barcode100);
    expect(item.fidelity).toBeCloseTo(0.8, 5);
  });

  it('missing fields → null (never 0) AND lower fidelity than the complete record', () => {
    const completeItem = adaptOpenFoodFactsProduct(complete, barcode100);
    const sparseItem = adaptOpenFoodFactsProduct(sparse, barcode100);

    // Absent carbs/fat are null, not a fabricated 0.
    expect(sparseItem.carbsG).toBeNull();
    expect(sparseItem.fatG).toBeNull();
    expect(sparseItem.carbsG).not.toBe(0);
    // Present fields still come through.
    expect(sparseItem.kcal).toBe(385);
    expect(sparseItem.proteinG).toBeCloseTo(9.6, 5);
    // The half-empty record is less trustworthy → lower fidelity.
    expect(sparseItem.fidelity).toBeLessThan(completeItem.fidelity);
    expect(tierOf(sparseItem.fidelity)).toBe('MID');
  });

  it('provenance matches ObservationSource.foodapi', () => {
    const item = adaptOpenFoodFactsProduct(complete, barcode100);
    const source: ObservationSource = { type: 'foodapi', provider: item.sourceDb, itemId: item.foodId };
    expect(source).toEqual({ type: 'foodapi', provider: 'openfoodfacts', itemId: '0737628064502' });
  });
});

describe('both adapters emit the identical internal shape', () => {
  it('a USDA item and an OFF item share the same required FoodItem keys', () => {
    const usda = adaptUsdaFood(load<UsdaFoodResponse>('usda-branded-peanut-butter.json'), {
      method: 'weighed',
      quantityG: 30,
      quantityMethod: 'measured',
    });
    const off = adaptOpenFoodFactsProduct(load<OffProductResponse>('off-complete-thai-sauce.json'), {
      method: 'barcode',
      quantityG: 100,
      quantityMethod: 'package',
    });
    const required = [
      'sourceDb',
      'foodId',
      'quantity',
      'quantityMethod',
      'kcal',
      'proteinG',
      'carbsG',
      'fatG',
      'fidelity',
      'fidelityCeiling',
    ];
    for (const key of required) {
      expect(usda).toHaveProperty(key);
      expect(off).toHaveProperty(key);
    }
  });
});
