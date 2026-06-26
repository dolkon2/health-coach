/**
 * Trend engine tests. The headline check: the EWMA recovers a known underlying
 * trend from noisy daily weigh-ins (the constitution's "recover a hidden truth
 * from noise" proof, in miniature). Plus the honest "not enough data" gating.
 */
import { describe, it, expect } from '@jest/globals';
import type { ObservationOf } from '@core/observation';
import { computeWeightTrend, weightTrendDelta } from '@core/trend';

const DAY_MS = 86_400_000;
const START = Date.UTC(2026, 0, 1);

function weighIn(dayIndex: number, weightKg: number): ObservationOf<'weighIn'> {
  const occurredAt = new Date(START + dayIndex * DAY_MS).toISOString();
  return {
    id: `w${dayIndex}`,
    kind: 'weighIn',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'UTC',
    tier: 1,
    fidelity: 1.0,
    source: { type: 'manual' },
    payload: { kind: 'weighIn', weightKg },
  };
}

// Deterministic noise so the test is stable run-to-run.
function noise(i: number): number {
  return (((i * 37) % 7) - 3) * 0.1; // range -0.3..+0.3
}

describe('computeWeightTrend', () => {
  it('recovers a declining trend from noisy weigh-ins', () => {
    const trueWeight = (i: number) => 80 - 0.05 * i; // ~0.05 kg/day down
    const weighIns = Array.from({ length: 60 }, (_, i) =>
      weighIn(i, trueWeight(i) + noise(i))
    );

    const points = computeWeightTrend(weighIns);
    expect(points).toHaveLength(60);

    // An EWMA necessarily *lags* a steadily-moving signal by ~rate * timeConstant
    // (here ~0.05 kg/day * ~14 days ≈ 0.7 kg), so the smoothed end value tracks
    // the true line closely but trails it slightly. That lag is correct behavior.
    const last = points[points.length - 1];
    expect(Math.abs(last.trendKg - trueWeight(59))).toBeLessThan(1.0);

    // The point of smoothing: day-to-day steps in the trend are far smaller than
    // the raw noise swings (~0.6) — the noise has been averaged out.
    const maxStep = Math.max(
      ...points.slice(1).map((p, i) => Math.abs(p.trendKg - points[i].trendKg))
    );
    expect(maxStep).toBeLessThan(0.2);

    // Confidence saturates with plenty of data.
    expect(last.confidence).toBe(1);
  });

  it('averages multiple weigh-ins on the same day', () => {
    const points = computeWeightTrend([weighIn(0, 80), weighIn(0, 82)]);
    expect(points).toHaveLength(1);
    expect(points[0].trendKg).toBe(81);
    expect(points[0].rawWeighInIds).toHaveLength(2);
  });

  it('returns nothing for no data', () => {
    expect(computeWeightTrend([])).toEqual([]);
  });
});

describe('weightTrendDelta', () => {
  it('reports a downward delta over the window', () => {
    const trueWeight = (i: number) => 80 - 0.05 * i;
    const points = computeWeightTrend(
      Array.from({ length: 60 }, (_, i) => weighIn(i, trueWeight(i) + noise(i)))
    );
    const delta = weightTrendDelta(points, 14);
    expect(delta).not.toBeNull();
    expect(delta!.deltaKg).toBeLessThan(0); // trending down
    expect(delta!.deltaKg).toBeGreaterThan(-1.2);
    expect(delta!.days).toBeGreaterThanOrEqual(12);
    expect(delta!.days).toBeLessThanOrEqual(15);
  });

  it('returns null with too little data (honest, not faked)', () => {
    expect(weightTrendDelta([], 14)).toBeNull();
    expect(weightTrendDelta(computeWeightTrend([weighIn(0, 80)]), 14)).toBeNull();
    // Two readings only one day apart — span below the minimum.
    expect(
      weightTrendDelta(computeWeightTrend([weighIn(0, 80), weighIn(1, 80)]), 14)
    ).toBeNull();
  });
});
