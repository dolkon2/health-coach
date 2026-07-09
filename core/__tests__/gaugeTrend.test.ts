/**
 * Gauge trend tests — endpoint comparison at the ±5% threshold, honest
 * null when a direction can't exist, and the real 6h fixture.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeTrend, TREND_THRESHOLD } from '@core/conditions/gaugeTrend';
import { parseSeries, type SeriesPoint } from '@core/conditions/usgs';

const FX = join(__dirname, '..', 'src', 'conditions', '__fixtures__');

function series(values: number[]): SeriesPoint[] {
  return values.map((value, i) => ({
    timeUtc: `2026-07-05T${String(10 + i).padStart(2, '0')}:00:00+00:00`,
    value,
  }));
}

describe('computeTrend', () => {
  it('needs two points for a direction — fewer is null, never a guess', () => {
    expect(computeTrend([])).toBeNull();
    expect(computeTrend(series([591]))).toBeNull();
  });

  it('calls a >5% rise rising and a >5% drop falling', () => {
    expect(computeTrend(series([100, 106]))).toBe('rising');
    expect(computeTrend(series([100, 94]))).toBe('falling');
  });

  it('calls sub-threshold wobble steady', () => {
    expect(computeTrend(series([100, 103]))).toBe('steady');
    expect(computeTrend(series([100, 97]))).toBe('steady');
    expect(computeTrend(series([591, 591]))).toBe('steady');
  });

  it('compares ENDPOINTS of the window — a spike in the middle is not a trend', () => {
    expect(computeTrend(series([100, 200, 101]))).toBe('steady');
  });

  it('handles a zero baseline without dividing by it', () => {
    expect(computeTrend(series([0, 5]))).toBe('rising');
    expect(computeTrend(series([0, 0]))).toBe('steady');
  });

  it('reads the real 6h fixture (flat 591→591 window) as steady', () => {
    const points = parseSeries(JSON.parse(readFileSync(join(FX, 'usgs-series-6h.json'), 'utf8')));
    expect(computeTrend(points)).toBe('steady');
  });

  it('documents the ⚑ tunable threshold at 5%', () => {
    expect(TREND_THRESHOLD).toBe(0.05);
  });
});
