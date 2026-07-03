/**
 * Suggestion-calculator tests (expenditure build, Pass F). Proof:
 *   - suggestions come from measured inputs and are null without them —
 *     an empty field stays empty, no default person;
 *   - protein follows the 0.8 g/lb rule (1.76 g/kg), rounded to 5 g;
 *   - the calorie ceiling is TDEE − 300 (⚑ documented default), rounded to 10.
 */
import { describe, it, expect } from '@jest/globals';
import {
  suggestProteinGrams,
  suggestCalorieCeiling,
  PROTEIN_G_PER_KG,
  SUGGESTED_DEFICIT_KCAL,
} from '@/lib/benchmarkSuggest';

describe('suggestProteinGrams', () => {
  it('applies 0.8 g/lb (1.76 g/kg) and rounds to 5 g', () => {
    // 80 kg × 1.76 = 140.8 → 140
    expect(suggestProteinGrams(80)).toBe(140);
    // 62 kg × 1.76 = 109.1 → 110
    expect(suggestProteinGrams(62)).toBe(110);
    expect(PROTEIN_G_PER_KG).toBeCloseTo(0.8 / 0.4536, 1);
  });

  it('is null without a measured weight', () => {
    expect(suggestProteinGrams(null)).toBeNull();
    expect(suggestProteinGrams(0)).toBeNull();
    expect(suggestProteinGrams(NaN)).toBeNull();
  });
});

describe('suggestCalorieCeiling', () => {
  it('is the current TDEE estimate minus the documented deficit, rounded to 10', () => {
    expect(suggestCalorieCeiling(2760)).toBe(2760 - SUGGESTED_DEFICIT_KCAL);
    expect(suggestCalorieCeiling(2497)).toBe(2200); // 2197 → 2200
  });

  it('is null without a TDEE estimate', () => {
    expect(suggestCalorieCeiling(null)).toBeNull();
    expect(suggestCalorieCeiling(0)).toBeNull();
  });
});
