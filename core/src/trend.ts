/**
 * trend.ts — Noisy weigh-ins (tier 1) -> smooth weight trend (tier 2).
 *
 * A gap-aware EWMA (exponentially weighted moving average). Each day's smoothed
 * value moves toward that day's reading by an amount set by how long it's been
 * since the last reading — so a long gap lets the trend catch up, a daily cadence
 * smooths hard. This is the same family of estimator MacroFactor/TrendWeight use.
 *
 * Confidence is a first-class output and "not enough data yet" is a valid, honest
 * answer: weightTrendDelta() returns null rather than inventing a number.
 *
 * Heuristics (constitution: document tunable guesses with their meaning):
 *   - HALF_LIFE_DAYS = 10: a reading's influence halves every ~10 days.
 *   - delta needs >= 2 days of data spanning >= MIN_DELTA_DAYS to render.
 */
import type { ObservationOf, ObservationId, LocalDate } from './observation';
import { dayKey } from './timeline';

export type WeightTrendPoint = {
  date: LocalDate;
  trendKg: number; // EWMA-smoothed
  rawWeighInIds: ObservationId[]; // provenance for this day
  confidence: number; // 0..1, climbs with more data
};

export type TrendOptions = {
  halfLifeDays?: number;
};

export const HALF_LIFE_DAYS = 10;
const CONFIDENCE_FULL_AT_DAYS = 14; // confidence reaches 1.0 after ~2 weeks of data

function daysBetween(a: LocalDate, b: LocalDate): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

/** One smoothed point per day that has a weigh-in, oldest first. */
export function computeWeightTrend(
  weighIns: ObservationOf<'weighIn'>[],
  opts?: TrendOptions
): WeightTrendPoint[] {
  const halfLife = opts?.halfLifeDays ?? HALF_LIFE_DAYS;

  // Average multiple weigh-ins on the same day into one daily reading.
  const byDay = new Map<LocalDate, { sum: number; count: number; ids: ObservationId[] }>();
  for (const o of weighIns) {
    const day = dayKey(o.occurredAt);
    const entry = byDay.get(day) ?? { sum: 0, count: 0, ids: [] };
    entry.sum += o.payload.weightKg;
    entry.count += 1;
    entry.ids.push(o.id);
    byDay.set(day, entry);
  }

  const days = [...byDay.entries()]
    .map(([date, e]) => ({ date, avg: e.sum / e.count, ids: e.ids }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (days.length === 0) return [];

  const points: WeightTrendPoint[] = [];
  let trend = days[0].avg;
  for (let i = 0; i < days.length; i++) {
    if (i > 0) {
      const gap = Math.max(1, daysBetween(days[i - 1].date, days[i].date));
      const alpha = 1 - Math.pow(0.5, gap / halfLife);
      trend = trend + alpha * (days[i].avg - trend);
    }
    points.push({
      date: days[i].date,
      trendKg: trend,
      rawWeighInIds: days[i].ids,
      confidence: Math.min(1, (i + 1) / CONFIDENCE_FULL_AT_DAYS),
    });
  }
  return points;
}

export type WeightTrendDelta = {
  trendKg: number; // latest smoothed weight
  deltaKg: number; // change over the window (negative = down)
  days: number; // actual span compared
};

export const MIN_DELTA_DAYS = 3;

/**
 * The change in the smoothed trend over roughly `windowDays`, compared against
 * the point closest to that far back. Returns null when there isn't enough data
 * for an honest answer (the UI then renders no delta line).
 */
export function weightTrendDelta(
  points: WeightTrendPoint[],
  windowDays = 14,
  minDays = MIN_DELTA_DAYS
): WeightTrendDelta | null {
  if (points.length < 2) return null;

  const latest = points[points.length - 1];
  const targetMs = Date.parse(latest.date) - windowDays * 86_400_000;

  // Baseline = the point whose date is closest to `windowDays` ago.
  let baseline = points[0];
  let bestDist = Math.abs(Date.parse(points[0].date) - targetMs);
  for (const p of points) {
    const dist = Math.abs(Date.parse(p.date) - targetMs);
    if (dist < bestDist) {
      bestDist = dist;
      baseline = p;
    }
  }

  const days = daysBetween(baseline.date, latest.date);
  if (days < minDays) return null;

  return {
    trendKg: latest.trendKg,
    deltaKg: latest.trendKg - baseline.trendKg,
    days: Math.round(days),
  };
}
