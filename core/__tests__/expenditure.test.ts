/**
 * Expenditure-engine tests (Ring 2 / Pass 2.6). Proof:
 *   - known intake + known trend delta → the residual TDEE within its band;
 *   - no intake / too little trend → honest null, never a faked number;
 *   - (Item 2) per-window residualConfidence in 0..1, complete > partial;
 *   - (Item 6) null days are EXCLUDED from intake, not summed as 0.
 */
import { describe, it, expect } from '@jest/globals';
import type { WeightTrendPoint } from '@core/trend';
import { estimateExpenditure, KCAL_PER_KG, type DayIntake } from '@core/expenditure';

const DAY_MS = 86_400_000;
const START = Date.UTC(2026, 5, 1); // 2026-06-01
const dateAt = (i: number): string => new Date(START + i * DAY_MS).toISOString().slice(0, 10);

/** 14 days, weight trending linearly from `from` to `to` (a known delta). */
function linearTrend(days = 14, from = 80.0, to = 79.5, confidence = 1): WeightTrendPoint[] {
  return Array.from({ length: days }, (_, i) => ({
    date: dateAt(i),
    trendKg: from + (to - from) * (i / (days - 1)),
    rawWeighInIds: [`w${i}`],
    confidence,
  }));
}
const intake = (days: number, kcal: number | null): DayIntake[] =>
  Array.from({ length: days }, (_, i) => ({ date: dateAt(i), kcal }));

describe('estimateExpenditure — measured TDEE residual', () => {
  it('solves TDEE from known intake + known trend delta, within the error band', () => {
    const report = estimateExpenditure(linearTrend(), intake(14, 2200));
    expect(report.windows).toHaveLength(1);
    const w = report.windows[0];

    // TDEE = meanIntake − (ΔW·KCAL_PER_KG)/spanDays = 2200 − (−0.5·7700)/13 ≈ 2496.
    const hand = 2200 - (-0.5 * KCAL_PER_KG) / 13;
    expect(w.meanIntakeKcal).toBe(2200);
    expect(w.trendDeltaKg).toBeCloseTo(-0.5, 5);
    expect(w.inferredTdeeKcal).not.toBeNull();
    expect(Math.abs(w.inferredTdeeKcal! - hand)).toBeLessThan(2); // within rounding
    expect(w.inferredTdeeKcal!).toBeGreaterThan(w.errorBandKcal.low);
    expect(w.inferredTdeeKcal!).toBeLessThan(w.errorBandKcal.high);
    expect(report.latest).toBe(w);
  });

  it('returns null TDEE with no intake (honest, not faked)', () => {
    const report = estimateExpenditure(linearTrend(), intake(14, null));
    expect(report.windows[0].meanIntakeKcal).toBeNull();
    expect(report.windows[0].inferredTdeeKcal).toBeNull();
    expect(report.latest).toBeNull();
  });

  it('returns an empty report below the minimum trend data', () => {
    expect(estimateExpenditure([], intake(14, 2200))).toEqual({ windows: [], latest: null });
    expect(estimateExpenditure(linearTrend(1), intake(1, 2200)).windows).toHaveLength(0);
  });
});

describe('per-window confidence (Item 2) + null is missing (Item 6)', () => {
  it('a complete-log window scores higher residualConfidence than an identical partial one', () => {
    const complete = estimateExpenditure(linearTrend(), intake(14, 2200)).windows[0];
    // Same trend, but 5 of 14 days are partial (null intake).
    const partialIntake = intake(14, 2200).map((d, i) => (i < 5 ? { ...d, kcal: null } : d));
    const partial = estimateExpenditure(linearTrend(), partialIntake).windows[0];

    expect(complete.logCompleteness).toBe(1);
    expect(partial.logCompleteness).toBeLessThan(1);
    expect(complete.residualConfidence).toBeGreaterThan(partial.residualConfidence);
    expect(complete.residualConfidence).toBeGreaterThanOrEqual(0);
    expect(complete.residualConfidence).toBeLessThanOrEqual(1);
  });

  it('excludes null days from intake rather than summing them as 0', () => {
    // 9 days at 2000, 5 days null → the mean is 2000 (over the 9), never 18000/14.
    const mixed = intake(14, 2000).map((d, i) => (i < 5 ? { ...d, kcal: null } : d));
    const w = estimateExpenditure(linearTrend(), mixed).windows[0];
    expect(w.meanIntakeKcal).toBe(2000);
    expect(w.meanIntakeKcal).not.toBe(Math.round((9 * 2000) / 14)); // not zero-filled (1286)
    expect(w.logCompleteness).toBeCloseTo(9 / 14, 2);
  });
});
