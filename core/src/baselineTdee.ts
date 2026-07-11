/**
 * baselineTdee.ts — the cold-start TDEE prediction (the weak kind, on purpose).
 *
 * This is the ONE spot the app knowingly uses a population formula
 * (benchmarks-spec.md § TDEE cold-start). Day one has no weight trend, so
 * expenditure can't be measured yet; this module produces the familiar
 * calculator number as a transparent, low-fidelity placeholder — always with a
 * WIDE range, always `fidelity: 'LOW'`, never a bare confident figure. The
 * measured residual (expenditure.ts) overwrites it the moment the trend clears
 * the noise floor.
 *
 * Firewall note (spine rule 1): `activityLevel` here is the user's own
 * self-reported "how active are you, typically?" — the Route-1 placeholder that
 * graduates away. It is NOT derived from logged training sessions, and never
 * will be: training data is correlated against the measured burn, never fed
 * forward to predict it.
 *
 * Formula: Mifflin–St Jeor — BMR = 10·kg + 6.25·cm − 5·age + (M +5 / F −161).
 * (Bodyfat-based Katch–McArdle was cut: bodyfat% isn't captured anywhere in
 * the app, so there was never a real second formula to reach.)
 *
 * Heuristics (constitution: documented, tunable guesses):
 *   - ACTIVITY_FACTORS: the standard 1.2–1.9 multiplier table.
 *   - MIFFLIN_BAND_PCT = 0.20: population TDEE predictions run 300–500 kcal
 *     off real expenditure; the band says so out loud.
 *   - Output rounds to 10 kcal — unit-kcal precision on a prediction is fake.
 */
import type { FidelityTier } from './nutrition/fidelity';

export type Sex = 'male' | 'female';

/** Route-1 cold-start activity: self-described, transparent, graduates away. */
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

export interface BodyMetrics {
  heightCm: number;
  age: number;
  sex: Sex;
  weightKg: number;
}

export interface BaselineTdee {
  /** The predicted TDEE, rounded to 10 kcal. Read WITH the range, never alone. */
  tdeeKcal: number;
  range: { low: number; high: number };
  /** Always LOW — a population prediction is the weak kind by definition. */
  fidelity: Extract<FidelityTier, 'LOW'>;
  bmrKcal: number;
  activityFactor: number;
}

/** The standard activity-multiplier table (documented, tunable). */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

/** ± band as a fraction of TDEE. */
export const MIFFLIN_BAND_PCT = 0.2;

const round0 = (x: number): number => Math.round(x);
const round10 = (x: number): number => Math.round(x / 10) * 10;

function assertInDomain(m: BodyMetrics): void {
  const positive: Array<[string, number]> = [
    ['heightCm', m.heightCm],
    ['age', m.age],
    ['weightKg', m.weightKg],
  ];
  for (const [name, v] of positive) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(`estimateBaselineTdee: ${name} must be a positive number, got ${v}`);
    }
  }
}

/**
 * The cold-start prediction: BMR × self-reported activity factor, with the band
 * that admits what a population formula doesn't know. Pure and synchronous; the
 * caller decides when the measured residual has earned the right to replace it.
 */
export function estimateBaselineTdee(metrics: BodyMetrics, activityLevel: ActivityLevel): BaselineTdee {
  assertInDomain(metrics);

  const bmr =
    10 * metrics.weightKg +
    6.25 * metrics.heightCm -
    5 * metrics.age +
    (metrics.sex === 'male' ? 5 : -161);

  const activityFactor = ACTIVITY_FACTORS[activityLevel];
  const tdee = bmr * activityFactor;
  const margin = tdee * MIFFLIN_BAND_PCT;

  return {
    tdeeKcal: round10(tdee),
    range: { low: round10(tdee - margin), high: round10(tdee + margin) },
    fidelity: 'LOW',
    bmrKcal: round0(bmr),
    activityFactor,
  };
}
