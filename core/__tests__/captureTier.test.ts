/**
 * Capture-tier tests (expenditure build, Pass C). Proof of Dylan's revision:
 *   - T1 = incomplete log (a bare macro) — lowest, regardless of method;
 *   - T2 = describe OR photo (complete);
 *   - T3 = weighed / scanned (complete);
 *   - the tier is a distinct legible unit, never the continuous fidelity, and
 *     never the Observation evidence tier (1/2/3) — hence the string codes.
 */
import { describe, it, expect } from '@jest/globals';
import type { FoodEntryPayload, InputMethod } from '@core/observation';
import {
  captureTier,
  captureTierRank,
  captureLabel,
  type CaptureTier,
} from '@core/nutrition/captureTier';

type MealBits = Pick<FoodEntryPayload, 'inputMethod' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>;

function meal(inputMethod: InputMethod, over: Partial<MealBits> = {}): MealBits {
  return { inputMethod, kcal: 500, proteinG: 40, carbsG: 30, fatG: 20, ...over };
}

describe('captureTier — the legible capture unit', () => {
  it('T1: a bare macro ("42g protein") is incomplete — lowest', () => {
    const bare = meal('described', { kcal: null, carbsG: null, fatG: null });
    expect(captureTier(bare)).toBe('T1');
  });

  it('T1 trumps method: even a weighed log missing a macro is incomplete', () => {
    expect(captureTier(meal('weighed', { carbsG: null }))).toBe('T1');
    expect(captureTier(meal('barcode', { kcal: null }))).toBe('T1');
  });

  it('T2: describe or photo, complete', () => {
    expect(captureTier(meal('described'))).toBe('T2');
    expect(captureTier(meal('photo'))).toBe('T2');
  });

  it('T3: weighed or scanned, complete', () => {
    expect(captureTier(meal('weighed'))).toBe('T3');
    expect(captureTier(meal('barcode'))).toBe('T3');
  });

  it('ranks order T1 < T2 < T3 (for "80% at T2+"-style comparisons)', () => {
    const tiers: CaptureTier[] = ['T1', 'T2', 'T3'];
    const ranks = tiers.map(captureTierRank);
    expect(ranks).toEqual([1, 2, 3]);
  });
});

describe('captureLabel — the on-entry method label', () => {
  it('shows tier + method word, "scanned" for barcode', () => {
    expect(captureLabel(meal('weighed'))).toBe('T3 · weighed');
    expect(captureLabel(meal('barcode'))).toBe('T3 · scanned');
    expect(captureLabel(meal('described'))).toBe('T2 · described');
    expect(captureLabel(meal('photo'))).toBe('T2 · photo');
  });

  it('an incomplete entry reads partial, whatever the method', () => {
    expect(captureLabel(meal('described', { fatG: null }))).toBe('T1 · partial');
    expect(captureLabel(meal('weighed', { fatG: null }))).toBe('T1 · partial');
  });
});
