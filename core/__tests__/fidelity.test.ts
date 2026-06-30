/**
 * Fidelity-math tests (Ring 2 / Pass 2.1). The proof the plan asks for: fidelity
 * is read from what was extracted (not the channel), the three documented
 * extraction cases land in the right tiers, a mixed-method meal blends honestly
 * between its parts without out-ranking its best method, and the tier boundaries
 * resolve correctly at their 0.4 / 0.8 edges.
 */
import { describe, it, expect } from '@jest/globals';
import type { FoodItem } from '@core/observation';
import {
  defaultFidelity,
  fidelityCeiling,
  blendComposite,
  tierOf,
  TIER_HIGH_MIN,
  TIER_MID_MIN,
} from '@core/nutrition/fidelity';

/** A FoodItem with the macros stubbed — these tests only exercise fidelity. */
function item(fidelity: number, fidelityCeiling: number): FoodItem {
  return {
    sourceDb: 'usda',
    foodId: 'x',
    quantity: 100,
    quantityMethod: 'measured',
    kcal: 200,
    proteinG: 20,
    carbsG: 10,
    fatG: 5,
    fidelity,
    fidelityCeiling,
  };
}

describe('defaultFidelity — computed from extraction, never from channel', () => {
  it('weighed lands in the HIGH band, at or below its ceiling', () => {
    const f = defaultFidelity('weighed', { branded: false });
    expect(tierOf(f)).toBe('HIGH');
    expect(f).toBeGreaterThanOrEqual(TIER_HIGH_MIN);
    expect(f).toBeLessThanOrEqual(fidelityCeiling('weighed'));
  });

  it('"8 oz ribeye" — described food + qty + unit — is MID', () => {
    const f = defaultFidelity('described', { food: true, quantity: true, unit: true });
    expect(tierOf(f)).toBe('MID');
    expect(f).toBeGreaterThanOrEqual(TIER_MID_MIN);
    expect(f).toBeLessThan(TIER_HIGH_MIN);
  });

  it('"steak" — described food only — is LOW', () => {
    const f = defaultFidelity('described', { food: true });
    expect(tierOf(f)).toBe('LOW');
    expect(f).toBeLessThan(TIER_MID_MIN);
  });

  it('estimated macros + a stated portion → low-MID, below a DB-resolved described item', () => {
    // Both macros AND portion are LLM guesses, so it must read as less certain
    // than a food+qty+unit item that resolved against the database.
    const est = defaultFidelity('described', { macrosEstimated: true, quantity: true });
    expect(tierOf(est)).toBe('MID');
    expect(est).toBeGreaterThanOrEqual(TIER_MID_MIN);
    expect(est).toBeLessThan(defaultFidelity('described', { food: true, quantity: true, unit: true }));
    expect(est).toBeLessThan(TIER_HIGH_MIN); // an estimate never reads as measured
  });

  it('estimated macros + a vague portion → LOW', () => {
    const est = defaultFidelity('described', { macrosEstimated: true });
    expect(tierOf(est)).toBe('LOW');
    expect(est).toBeLessThan(TIER_MID_MIN);
  });

  it('never exceeds the method ceiling for any method', () => {
    const full = { food: true, quantity: true, unit: true, completeness: 1, branded: false };
    (['weighed', 'barcode', 'described', 'photo'] as const).forEach((m) => {
      expect(defaultFidelity(m, full)).toBeLessThanOrEqual(fidelityCeiling(m));
    });
  });
});

describe('blendComposite — a meal is only as solid as its parts', () => {
  it('blends a mixed-method meal between its parts, never above the top ceiling', () => {
    const weighed = item(0.95, 0.98); // scale-weighed
    const photo = item(0.35, 0.55); // eyeballed from a photo
    const blend = blendComposite([weighed, photo]);

    expect(blend).toBeGreaterThan(0.35); // above the worst part
    expect(blend).toBeLessThan(0.95); // below the best part
    expect(blend).toBeLessThanOrEqual(Math.max(weighed.fidelityCeiling, photo.fidelityCeiling));
  });

  it('clamps each part to its own ceiling first, so the blend can never exceed the top one', () => {
    // Pathological input: per-item fidelities above their ceilings must be capped.
    const blend = blendComposite([item(2.0, 0.55), item(2.0, 0.85)]);
    expect(blend).toBeLessThanOrEqual(0.85); // the max ceiling, not 2.0
  });

  it('is honest about an empty meal — 0, not a fabricated number', () => {
    expect(blendComposite([])).toBe(0);
  });
});

describe('tierOf — the boundaries are the only numbers, and they live in code', () => {
  it('maps the 0.8 / 0.4 edges to the right bands', () => {
    expect(tierOf(0.8)).toBe('HIGH'); // 0.8 is HIGH (closed lower edge)
    expect(tierOf(0.79)).toBe('MID');
    expect(tierOf(0.4)).toBe('MID'); // 0.4 is MID (closed lower edge)
    expect(tierOf(0.39)).toBe('LOW');
  });

  it('covers the range ends', () => {
    expect(tierOf(1)).toBe('HIGH');
    expect(tierOf(0)).toBe('LOW');
  });
});
