/**
 * Baseline-TDEE tests (expenditure build, Pass A). Proof:
 *   - known Mifflin–St Jeor BMR values reproduce by hand;
 *   - the band is always wide and the fidelity always 'LOW' — day one is never
 *     a bare confident number;
 *   - activity factors order sensibly and reference adults land in a sane range.
 */
import { describe, it, expect } from '@jest/globals';
import {
  estimateBaselineTdee,
  ACTIVITY_FACTORS,
  type ActivityLevel,
  type BodyMetrics,
} from '@core/baselineTdee';

const MALE: BodyMetrics = { heightCm: 180, age: 30, sex: 'male', weightKg: 80 };
const FEMALE: BodyMetrics = { heightCm: 165, age: 25, sex: 'female', weightKg: 60 };

describe('estimateBaselineTdee — Mifflin–St Jeor floor', () => {
  it('reproduces known BMR values by hand', () => {
    // male: 10·80 + 6.25·180 − 5·30 + 5 = 1780
    expect(estimateBaselineTdee(MALE, 'sedentary').bmrKcal).toBe(1780);
    // female: 10·60 + 6.25·165 − 5·25 − 161 = 1345.25 → 1345
    expect(estimateBaselineTdee(FEMALE, 'sedentary').bmrKcal).toBe(1345);
  });

  it('multiplies BMR by the activity factor (rounded to 10 kcal — no fake precision)', () => {
    const r = estimateBaselineTdee(MALE, 'moderate');
    // 1780 × 1.55 = 2759 → 2760 at the honest display grain.
    expect(r.tdeeKcal).toBe(2760);
    expect(r.activityFactor).toBe(ACTIVITY_FACTORS.moderate);
  });

  it('is always the weak predicted kind: fidelity LOW, tdee strictly inside a wide band', () => {
    const levels: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'veryActive'];
    for (const level of levels) {
      const r = estimateBaselineTdee(MALE, level);
      expect(r.fidelity).toBe('LOW');
      expect(r.range.low).toBeLessThan(r.tdeeKcal);
      expect(r.range.high).toBeGreaterThan(r.tdeeKcal);
      // The band is genuinely wide — population formulas run hundreds of kcal off.
      expect(r.range.high - r.range.low).toBeGreaterThanOrEqual(2 * 0.1 * r.tdeeKcal);
    }
  });

  it('orders activity levels monotonically, and the absolute band grows with the guess', () => {
    const sed = estimateBaselineTdee(MALE, 'sedentary');
    const mod = estimateBaselineTdee(MALE, 'moderate');
    const very = estimateBaselineTdee(MALE, 'veryActive');
    expect(sed.tdeeKcal).toBeLessThan(mod.tdeeKcal);
    expect(mod.tdeeKcal).toBeLessThan(very.tdeeKcal);
    expect(very.range.high - very.range.low).toBeGreaterThan(sed.range.high - sed.range.low);
  });
});

describe('estimateBaselineTdee — sanity + input guards', () => {
  it('reference adults land in a sane TDEE range at every level', () => {
    const levels: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'veryActive'];
    for (const who of [MALE, FEMALE]) {
      for (const level of levels) {
        const r = estimateBaselineTdee(who, level);
        expect(r.tdeeKcal).toBeGreaterThan(1200);
        expect(r.tdeeKcal).toBeLessThan(4500);
      }
    }
  });

  it('throws on out-of-domain inputs (programmer errors, not user states)', () => {
    expect(() => estimateBaselineTdee({ ...MALE, heightCm: 0 }, 'moderate')).toThrow();
    expect(() => estimateBaselineTdee({ ...MALE, age: -1 }, 'moderate')).toThrow();
    expect(() => estimateBaselineTdee({ ...MALE, weightKg: NaN }, 'moderate')).toThrow();
  });
});
