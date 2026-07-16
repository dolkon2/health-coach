/**
 * Pure path-builder tests for the Wind/Rain-Shine hourly charts — same
 * "exported for tests" convention as ElevationProfile's elevationPaths.
 */
import { describe, it, expect } from '@jest/globals';
import { windDualLinePaths, tempDualLinePaths } from '@/components/ForecastPanelCard';
import type { HourlyForecastPoint } from '@core/conditions/forecast';

describe('windDualLinePaths', () => {
  it('builds two paths from hours carrying both avg and gust', () => {
    const hourly: HourlyForecastPoint[] = [
      { timeEpochSec: 0, windSpeedKts: 10, windGustKts: 15 },
      { timeEpochSec: 3600, windSpeedKts: 12, windGustKts: 20 },
      { timeEpochSec: 7200, windSpeedKts: 8, windGustKts: 14 },
    ];
    const out = windDualLinePaths(hourly);
    expect(out).not.toBeNull();
    expect(out!.lineAvg.startsWith('M')).toBe(true);
    expect(out!.lineGust.startsWith('M')).toBe(true);
    expect(out!.minKts).toBe(8);
    expect(out!.maxKts).toBe(20);
  });

  it('skips hours missing either field — never fabricates a joining value', () => {
    const hourly: HourlyForecastPoint[] = [
      { timeEpochSec: 0, windSpeedKts: 10, windGustKts: 15 },
      { timeEpochSec: 3600, windSpeedKts: 12 }, // no gust
      { timeEpochSec: 7200, windSpeedKts: 8, windGustKts: 14 },
    ];
    const out = windDualLinePaths(hourly);
    expect(out).not.toBeNull();
    // Only 2 usable points -> exactly one "M" and one "L" per line.
    expect(out!.lineAvg.match(/M|L/g)?.length).toBe(2);
  });

  it('returns null with fewer than 2 usable hours', () => {
    expect(windDualLinePaths([{ timeEpochSec: 0, windSpeedKts: 10, windGustKts: 15 }])).toBeNull();
    expect(windDualLinePaths([{ timeEpochSec: 0 }])).toBeNull();
    expect(windDualLinePaths([])).toBeNull();
  });

  it('respects the hoursAhead window', () => {
    const hourly: HourlyForecastPoint[] = Array.from({ length: 10 }, (_, i) => ({
      timeEpochSec: i * 3600,
      windSpeedKts: i,
      windGustKts: i + 5,
    }));
    const out = windDualLinePaths(hourly, 3);
    expect(out!.maxKts).toBe(2 + 5); // only first 3 hours considered
  });
});

describe('tempDualLinePaths', () => {
  it('builds two paths from hours carrying both temp and feels-like', () => {
    const hourly: HourlyForecastPoint[] = [
      { timeEpochSec: 0, tempC: 18, apparentTempC: 16 },
      { timeEpochSec: 3600, tempC: 20, apparentTempC: 19 },
    ];
    const out = tempDualLinePaths(hourly);
    expect(out).not.toBeNull();
    expect(out!.minC).toBe(16);
    expect(out!.maxC).toBe(20);
  });

  it('returns null with fewer than 2 usable hours', () => {
    expect(tempDualLinePaths([{ timeEpochSec: 0, tempC: 18, apparentTempC: 16 }])).toBeNull();
  });
});
