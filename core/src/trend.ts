/**
 * trend.ts — Noisy weigh-ins (tier 1) -> smooth weight trend (tier 2).
 *
 * EWMA-smoothed weight with a confidence that climbs as data accumulates.
 * The trend is a tier-2 ACCUMULATED fact: true by repetition, derived from
 * many tier-1 weigh-ins. Confidence is a first-class output — "not enough
 * data yet" is a valid, honest answer (return an empty result), never a
 * fabricated curve.
 *
 * Status: signature only. Implemented in Pass 3 (Reflect trend chart).
 */
import type { ObservationOf, ObservationId, LocalDate } from './observation';
import { notImplemented } from './notImplemented';

export type WeightTrendPoint = {
  date: LocalDate; // user's local day
  trendKg: number; // EWMA-smoothed
  rawWeighInIds: ObservationId[]; // provenance
  confidence: number; // 0..1, climbs with more data
};

export type TrendOptions = {
  halfLifeDays?: number; // EWMA half-life. A documented, tunable guess.
};

/**
 * Returns one trend point per local day that has enough surrounding data to be
 * meaningful. Days without a meaningful trend are omitted — the caller renders
 * nothing rather than a faked number.
 */
export function computeWeightTrend(
  _weighIns: ObservationOf<'weighIn'>[],
  _opts?: TrendOptions
): WeightTrendPoint[] {
  return notImplemented('trend.computeWeightTrend', 'Pass 3');
}
