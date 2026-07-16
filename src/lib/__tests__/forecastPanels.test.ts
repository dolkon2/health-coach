import { describe, it, expect } from '@jest/globals';
import {
  windHeader,
  windHeaderLabel,
  gustStep,
  precipWindowHeadline,
  dailyRainShineRows,
  isBeyondFadeHorizon,
} from '@/lib/forecastPanels';
import type { HourlyForecastPoint, DailyForecastPoint } from '@core/conditions/forecast';

describe('windHeader', () => {
  it('reads the first hour carrying a wind speed', () => {
    const hourly: HourlyForecastPoint[] = [
      { timeEpochSec: 100 },
      { timeEpochSec: 200, windSpeedKts: 12.4, windGustKts: 19.6, windDirectionDeg: 288.5 },
    ];
    expect(windHeader(hourly)).toEqual({
      avgKts: 12.4,
      gustKts: 19.6,
      directionDeg: 288.5,
      atEpochSec: 200,
    });
  });

  it('returns null when no hour has a wind reading', () => {
    expect(windHeader([{ timeEpochSec: 100, precipMm: 0 }])).toBeNull();
  });

  it('omits gust/direction when absent, never inventing them', () => {
    expect(windHeader([{ timeEpochSec: 100, windSpeedKts: 8.0 }])).toEqual({
      avgKts: 8.0,
      atEpochSec: 100,
    });
  });
});

describe('windHeaderLabel', () => {
  it('formats avg + gust + from-direction', () => {
    expect(windHeaderLabel({ avgKts: 12.4, gustKts: 19.6, directionDeg: 288.5, atEpochSec: 0 })).toBe(
      '12 avg, gusting 20 kt from 289°'
    );
  });

  it('formats speed-only (no gust) without the "gusting" phrasing', () => {
    expect(windHeaderLabel({ avgKts: 8.0, atEpochSec: 0 })).toBe('8 kt');
  });

  it('omits the direction clause when absent', () => {
    expect(windHeaderLabel({ avgKts: 8.0, gustKts: 10.0, atEpochSec: 0 })).toBe('8 avg, gusting 10 kt');
  });
});

describe('gustStep', () => {
  it('calm below 13 kt, or when gust is absent', () => {
    expect(gustStep(undefined)).toBe('calm');
    expect(gustStep(5)).toBe('calm');
    expect(gustStep(12.9)).toBe('calm');
  });

  it('building from 13 to just under 21 kt', () => {
    expect(gustStep(13)).toBe('building');
    expect(gustStep(20.9)).toBe('building');
  });

  it('elevated at 21+ kt', () => {
    expect(gustStep(21)).toBe('elevated');
    expect(gustStep(40)).toBe('elevated');
  });
});

describe('precipWindowHeadline', () => {
  it('sums the window and labels it in inches', () => {
    const hourly: HourlyForecastPoint[] = Array.from({ length: 24 }, (_, i) => ({
      timeEpochSec: i,
      precipMm: i === 5 ? 15.24 : 0, // 15.24mm = 0.6in
    }));
    expect(precipWindowHeadline(hourly, 24)).toBe('0.6 in in the next 24 h');
  });

  it('returns null when the window is shorter than requested — never a partial sum', () => {
    const hourly: HourlyForecastPoint[] = Array.from({ length: 10 }, (_, i) => ({
      timeEpochSec: i,
      precipMm: 0,
    }));
    expect(precipWindowHeadline(hourly, 24)).toBeNull();
  });

  it('returns null when any hour in the window is missing precip', () => {
    const hourly: HourlyForecastPoint[] = Array.from({ length: 24 }, (_, i) => ({
      timeEpochSec: i,
      ...(i === 3 ? {} : { precipMm: 0 }),
    }));
    expect(precipWindowHeadline(hourly, 24)).toBeNull();
  });
});

describe('dailyRainShineRows', () => {
  it('maps probability + accumulation together, and temps when present', () => {
    const daily: DailyForecastPoint[] = [
      {
        dateEpochSec: 1000,
        precipProbabilityMaxPct: 40,
        precipSumMm: 5.08, // 0.2in
        tempMaxC: 22,
        tempMinC: 12,
      },
    ];
    expect(dailyRainShineRows(daily)).toEqual([
      {
        dateEpochSec: 1000,
        probabilityPct: 40,
        accumulationLabel: '0.20 in',
        tempMaxC: 22,
        tempMinC: 12,
      },
    ]);
  });

  it('omits fields that were never present, never fabricating a 0', () => {
    expect(dailyRainShineRows([{ dateEpochSec: 1000 }])).toEqual([{ dateEpochSec: 1000 }]);
  });
});

describe('isBeyondFadeHorizon', () => {
  it('is false at and before 72h out', () => {
    expect(isBeyondFadeHorizon(72 * 3600, 0)).toBe(false);
    expect(isBeyondFadeHorizon(0, 0)).toBe(false);
  });

  it('is true past 72h out', () => {
    expect(isBeyondFadeHorizon(72 * 3600 + 1, 0)).toBe(true);
  });
});
