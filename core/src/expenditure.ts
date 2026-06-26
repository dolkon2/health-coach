/**
 * expenditure.ts — Trend + intake -> measured TDEE (the residual).
 *
 * Expenditure is *measured*, never predicted (north star rule 2). Calories in +
 * weight trend delta -> infer total expenditure as the residual. "Out" is never
 * measured from a watch's motion guess; it is solved for from outcome.
 *
 * Phase 1 cannot run this: there is no food data yet, so intake is unknown.
 * Reflect shows "needs intake data" honestly rather than a fabricated number.
 * Fully wired in Phase 2 (food via API).
 *
 * Status: signature only.
 */
import type { LocalDate } from './observation';
import type { WeightTrendPoint } from './trend';
import { notImplemented } from './notImplemented';

export type ExpenditureEstimate = {
  windowStart: LocalDate;
  windowEnd: LocalDate;
  meanIntakeKcal: number;
  trendDeltaKg: number;
  inferredTdeeKcal: number; // residual computation
  confidence: number;
  errorBandKcal: { low: number; high: number };
};

/** KCAL_PER_KG = 7700 is a documented, tunable guess (constitution conventions). */
export const KCAL_PER_KG = 7700;

/**
 * Returns null when there isn't enough intake + trend data to infer a
 * meaningful TDEE. Null is the honest answer the UI renders as "needs more
 * data" — it must never be replaced with a guess.
 */
export function estimateExpenditure(
  _trend: WeightTrendPoint[],
  _meanIntakeKcal: number | null
): ExpenditureEstimate | null {
  return notImplemented('expenditure.estimateExpenditure', 'Phase 2');
}
