/**
 * Pure path-builder tests for the Wind/Rain-Shine hourly charts — same
 * "exported for tests" convention as ElevationProfile's elevationPaths.
 * Positions are by real time offset, not array index, so a gap in one
 * series (the secondary field missing for an hour) must break that
 * series' line rather than silently compress the timeline.
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

  it('keeps the avg line continuous but breaks the gust line at a missing hour, never bridging it', () => {
    const hourly: HourlyForecastPoint[] = [
      { timeEpochSec: 0, windSpeedKts: 10, windGustKts: 15 },
      { timeEpochSec: 3600, windSpeedKts: 12 }, // no gust this hour
      { timeEpochSec: 7200, windSpeedKts: 8, windGustKts: 14 },
    ];
    const out = windDualLinePaths(hourly);
    expect(out).not.toBeNull();
    // avg: one continuous path, all 3 points -> 1 M + 2 L.
    expect(out!.lineAvg.match(/M/g)?.length).toBe(1);
    expect(out!.lineAvg.match(/L/g)?.length).toBe(2);
    // gust: the middle hour is missing -> two separate single-point "M"
    // moves, no "L" connecting across the gap.
    expect(out!.lineGust.match(/M/g)?.length).toBe(2);
    expect(out!.lineGust.match(/L/g)).toBeNull();
  });

  it('positions points by real time offset, not index — a 2h gap reads as 2h wide, not 1h', () => {
    const hourly: HourlyForecastPoint[] = [
      { timeEpochSec: 0, windSpeedKts: 10, windGustKts: 15 },
      { timeEpochSec: 3600, windSpeedKts: 11 }, // dropped from the gust line, but still on the time axis
      { timeEpochSec: 7200, windSpeedKts: 12, windGustKts: 20 },
    ];
    const out = windDualLinePaths(hourly);
    // The avg line spans the full 0-7200s range across VIEW_W (300) -> the
    // middle point (a fully present hour) sits at x=150, not compressed.
    expect(out!.lineAvg).toContain('L150.0');
  });

  it('returns null with fewer than 2 hours carrying a wind speed', () => {
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

  it('returns null with fewer than 2 hours carrying a temp reading', () => {
    expect(tempDualLinePaths([{ timeEpochSec: 0, tempC: 18, apparentTempC: 16 }])).toBeNull();
  });
});
