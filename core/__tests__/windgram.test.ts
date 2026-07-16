/**
 * Windgram parser + physics tests — real dual-model (HRRR+GFS, Cliffside
 * grid point, boundary inside the trimmed window) and single-model (GFS
 * bare-name) fixtures, a crafted never-mix-models body, the refusal edges,
 * and the pure lapse-rate / bucketing / CONUS-box functions.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  WINDGRAM_LEVELS,
  parseWindgramResponse,
  lapseRateCPerKm,
  lapseBucket,
  isWithinConus,
} from '@core/conditions/windgram';

const FX = join(__dirname, '..', 'src', 'conditions', '__fixtures__');
function load<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

describe('parseWindgramResponse — dual-model fixture', () => {
  const out = parseWindgramResponse(load('om-windgram-hrrr-gfs.json'));

  it('parses hours, grid elevation, and day windows', () => {
    expect(out).not.toBeNull();
    expect(out!.hours.length).toBe(12);
    expect(out!.gridElevationM).toBe(167);
    expect(out!.days.length).toBe(4);
    expect(out!.days[0].sunriseEpochSec).toBeLessThan(out!.days[0].sunsetEpochSec);
  });

  it('attributes hours per model and marks the HRRR end', () => {
    const models = out!.hours.map((h) => h.model);
    // Trimmed window: HRRR carries full heights for the first 7 hours.
    expect(models.slice(0, 7)).toEqual(Array(7).fill('hrrr'));
    expect(models.slice(7)).toEqual(Array(5).fill('gfs'));
    expect(out!.hrrrEndEpochSec).toBe(out!.hours[6].timeEpochSec);
  });

  it('builds every requested level, ground up, with knots-verified wind', () => {
    const first = out!.hours[0];
    expect(first.levels.map((l) => l.pressureHpa)).toEqual([...WINDGRAM_LEVELS]);
    const l850 = first.levels.find((l) => l.pressureHpa === 850)!;
    expect(l850.heightM).toEqual(expect.any(Number));
    expect(l850.windSpeedKts).toEqual(expect.any(Number));
    expect(l850.windDirectionDeg).toEqual(expect.any(Number));
    expect(l850.tempC).toEqual(expect.any(Number));
    expect(l850.rhPct).toEqual(expect.any(Number));
    expect(l850.cloudCoverPct).toEqual(expect.any(Number));
    // Heights rise as pressure falls.
    const heights = first.levels.map((l) => l.heightM!);
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1]);
  });

  it('carries the per-hour scalars', () => {
    const first = out!.hours[0];
    expect(first.blHeightM).toEqual(expect.any(Number));
    expect(first.freezingLevelM).toEqual(expect.any(Number));
    expect(first.capeJkg).toEqual(expect.any(Number));
    expect(first.surfaceWindKts).toEqual(expect.any(Number));
    expect(first.surfaceWindDirDeg).toEqual(expect.any(Number));
  });
});

describe('parseWindgramResponse — single-model fixture (bare names)', () => {
  const out = parseWindgramResponse(load('om-windgram-gfs-only.json'));

  it('parses bare field names and attributes everything to GFS', () => {
    expect(out).not.toBeNull();
    expect(out!.hours.length).toBe(8);
    expect(out!.hours.every((h) => h.model === 'gfs')).toBe(true);
    expect(out!.hrrrEndEpochSec).toBeUndefined();
    expect(out!.days.length).toBe(4);
    const l700 = out!.hours[0].levels.find((l) => l.pressureHpa === 700)!;
    expect(l700.windSpeedKts).toEqual(expect.any(Number));
  });
});

describe('parseWindgramResponse — model purity and refusals', () => {
  function craftedDual() {
    const hourly: Record<string, unknown> = { time: [1784376000, 1784379600] };
    const units: Record<string, unknown> = { time: 'unixtime' };
    for (const p of WINDGRAM_LEVELS) {
      // HRRR has hour 0 only; 600 hPa is missing at hour 1 → hour 1 must be
      // built wholly from GFS even though the other HRRR levels are present.
      const hrrrGap = p === 600 ? [3000, null] : [p, p];
      hourly[`geopotential_height_${p}hPa_ncep_hrrr_conus`] = hrrrGap;
      hourly[`geopotential_height_${p}hPa_gfs_seamless`] = [p + 1, p + 1];
      hourly[`temperature_${p}hPa_ncep_hrrr_conus`] = [10, 10];
      hourly[`temperature_${p}hPa_gfs_seamless`] = [20, 20];
      hourly[`wind_speed_${p}hPa_ncep_hrrr_conus`] = [5, 5];
      hourly[`wind_speed_${p}hPa_gfs_seamless`] = [15, 15];
      units[`wind_speed_${p}hPa_ncep_hrrr_conus`] = 'kn';
      units[`wind_speed_${p}hPa_gfs_seamless`] = 'kn';
    }
    return { hourly_units: units, hourly };
  }

  it('never mixes models within one hour', () => {
    const out = parseWindgramResponse(craftedDual());
    expect(out).not.toBeNull();
    expect(out!.hours[0].model).toBe('hrrr');
    expect(out!.hours[1].model).toBe('gfs');
    // Hour 1 reads GFS everywhere — including levels HRRR did carry.
    const h1l850 = out!.hours[1].levels.find((l) => l.pressureHpa === 850)!;
    expect(h1l850.tempC).toBe(20);
    expect(h1l850.windSpeedKts).toBe(15);
    expect(out!.hrrrEndEpochSec).toBe(1784376000);
  });

  it('refuses wind when any wind_speed unit is not knots', () => {
    const body = craftedDual() as { hourly_units: Record<string, unknown> };
    body.hourly_units.wind_speed_850hPa_gfs_seamless = 'km/h';
    const out = parseWindgramResponse(body);
    expect(out).not.toBeNull();
    const l850 = out!.hours[0].levels.find((l) => l.pressureHpa === 850)!;
    expect(l850.windSpeedKts).toBeUndefined();
    expect(l850.tempC).toBe(10); // non-wind fields still read
  });

  it('returns null on error bodies, non-objects, and missing hours', () => {
    expect(parseWindgramResponse({ error: true, reason: 'bad' })).toBeNull();
    expect(parseWindgramResponse(null)).toBeNull();
    expect(parseWindgramResponse('nope')).toBeNull();
    expect(parseWindgramResponse({})).toBeNull();
    expect(parseWindgramResponse({ hourly: { time: [] } })).toBeNull();
  });
});

describe('lapseRateCPerKm', () => {
  it('computes cooling with height as a positive rate', () => {
    expect(lapseRateCPerKm({ tempC: 20, heightM: 0 }, { tempC: 13.5, heightM: 1000 })).toBe(6.5);
  });

  it('computes an inversion as a negative rate', () => {
    expect(lapseRateCPerKm({ tempC: 10, heightM: 500 }, { tempC: 12, heightM: 1500 })).toBe(-2);
  });

  it('returns null for zero or inverted layer thickness', () => {
    expect(lapseRateCPerKm({ tempC: 10, heightM: 1000 }, { tempC: 5, heightM: 1000 })).toBeNull();
    expect(lapseRateCPerKm({ tempC: 10, heightM: 1500 }, { tempC: 5, heightM: 1000 })).toBeNull();
  });
});

describe('lapseBucket', () => {
  it('classifies the four buckets at the documented cutoffs', () => {
    expect(lapseBucket(10.5)).toBe('unstable');
    expect(lapseBucket(9.5)).toBe('unstable');
    expect(lapseBucket(9.49)).toBe('conditional');
    expect(lapseBucket(6.0)).toBe('conditional');
    expect(lapseBucket(5.99)).toBe('stable');
    expect(lapseBucket(0)).toBe('stable');
    expect(lapseBucket(-0.1)).toBe('inverted');
    expect(lapseBucket(-5)).toBe('inverted');
  });
});

describe('isWithinConus', () => {
  it('accepts CONUS points and rejects the rest of the world', () => {
    expect(isWithinConus(45.7, -121.28)).toBe(true); // Columbia Gorge
    expect(isWithinConus(45.9, 6.13)).toBe(false); // Annecy
    expect(isWithinConus(64.8, -147.7)).toBe(false); // Fairbanks (HRRR CONUS grid excludes AK)
  });

  it('includes the box edges', () => {
    expect(isWithinConus(21, -100)).toBe(true);
    expect(isWithinConus(53, -100)).toBe(true);
    expect(isWithinConus(40, -134)).toBe(true);
    expect(isWithinConus(40, -60)).toBe(true);
    expect(isWithinConus(20.9, -100)).toBe(false);
    expect(isWithinConus(40, -59.9)).toBe(false);
  });
});
