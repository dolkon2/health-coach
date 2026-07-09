/**
 * Open-Meteo parser tests — fixture-driven (live-captured unixtime current
 * block, real hourly/archive/precip probes) plus crafted bodies for the
 * refusal edges: {error:true}, wrong units, ISO times where epochs were
 * required, null archive-tail elements.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseCurrentWind,
  pickHourlyWind,
  parsePrecipDaysSum,
} from '@core/conditions/openMeteo';

const FX = join(__dirname, '..', 'src', 'conditions', '__fixtures__');
function load<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

/** Crafted hourly body: 3 hours from a round epoch, knots units. */
function hourlyBody(overrides: Record<string, unknown> = {}) {
  return {
    hourly_units: { time: 'unixtime', wind_speed_10m: 'kn', wind_gusts_10m: 'kn', wind_direction_10m: '°' },
    hourly: {
      time: [1783036800, 1783040400, 1783044000],
      wind_speed_10m: [11.4, 11.1, 10.0],
      wind_gusts_10m: [20.0, 20.8, 20.6],
      wind_direction_10m: [290, 294, 297],
      ...(overrides.hourly as Record<string, unknown> | undefined),
    },
    ...overrides,
  };
}

describe('parseCurrentWind', () => {
  it('parses the live-captured unixtime current block', () => {
    const out = parseCurrentWind(load('om-current-unixtime.json'));
    expect(out).toEqual({
      timeEpochSec: 1783292400,
      speedKts: 10.3,
      gustKts: 14.6,
      directionDeg: 289,
    });
  });

  it('rejects an {error:true} body', () => {
    expect(parseCurrentWind({ error: true, reason: 'Invalid float' })).toBeNull();
  });

  it('rejects non-knot units — km/h read as knots is a fabricated wind', () => {
    const body = load<Record<string, unknown>>('om-current-unixtime.json');
    expect(
      parseCurrentWind({ ...body, current_units: { time: 'unixtime', wind_speed_10m: 'km/h' } })
    ).toBeNull();
  });

  it('rejects an ISO-time current block (unixtime was required)', () => {
    const body = load<{ current: Record<string, unknown> }>('om-current-unixtime.json');
    expect(
      parseCurrentWind({ ...body, current: { ...body.current, time: '2026-07-05T22:30' } })
    ).toBeNull();
  });

  it('omits gust/direction when absent instead of inventing them', () => {
    const out = parseCurrentWind({
      current_units: { wind_speed_10m: 'kn' },
      current: { time: 1783292400, wind_speed_10m: 8.1 },
    });
    expect(out).toEqual({ timeEpochSec: 1783292400, speedKts: 8.1 });
  });
});

describe('pickHourlyWind', () => {
  it('picks the nearest hour by integer math on the real fixture', () => {
    const json = load('om-hourly-unixtime.json');
    // 25 min past the second hour → rounds to index 1.
    const out = pickHourlyWind(json, 1783040400 + 1500);
    expect(out).toEqual({ timeEpochSec: 1783040400, speedKts: 11.1, gustKts: 20.8, directionDeg: 294 });
    // 35 min past → rounds up to index 2.
    expect(pickHourlyWind(json, 1783040400 + 2100)?.timeEpochSec).toBe(1783044000);
  });

  it('clamps a target outside the returned range to the ends', () => {
    const json = hourlyBody();
    expect(pickHourlyWind(json, 1783036800 - 86400)?.speedKts).toBe(11.4); // first
    expect(pickHourlyWind(json, 1783044000 + 86400)?.speedKts).toBe(10.0); // last
  });

  it('returns null when the picked hour is a null element (archive ingest tail)', () => {
    const json = hourlyBody({
      hourly: {
        time: [1783036800, 1783040400, 1783044000],
        wind_speed_10m: [11.4, null, null],
        wind_gusts_10m: [20.0, null, null],
        wind_direction_10m: [290, null, null],
      },
    });
    expect(pickHourlyWind(json, 1783044000)).toBeNull(); // never a neighbor's wind
    expect(pickHourlyWind(json, 1783036800)?.speedKts).toBe(11.4); // non-null hour still serves
  });

  it('tolerates missing gust/direction arrays (speed-only response)', () => {
    const json = {
      hourly_units: { wind_speed_10m: 'kn' },
      hourly: { time: [1783036800], wind_speed_10m: [9.9] },
    };
    expect(pickHourlyWind(json, 1783036800)).toEqual({ timeEpochSec: 1783036800, speedKts: 9.9 });
  });

  it('rejects ISO-time hourly arrays (the archive-tail probe shape without unixtime)', () => {
    // Real probe fetched without timeformat=unixtime: times are strings.
    expect(pickHourlyWind(load('om-archive-iso-times.json'), 1782950400)).toBeNull();
  });

  it('rejects {error:true}, wrong units, and empty bodies', () => {
    expect(pickHourlyWind({ error: true, reason: 'x' }, 0)).toBeNull();
    expect(pickHourlyWind(hourlyBody({ hourly_units: { wind_speed_10m: 'km/h' } }), 1783036800)).toBeNull();
    expect(pickHourlyWind({}, 0)).toBeNull();
    expect(pickHourlyWind(null, 0)).toBeNull();
  });
});

describe('parsePrecipDaysSum', () => {
  it('sums the first n days of the real fixture', () => {
    expect(parsePrecipDaysSum(load('om-precip-3day.json'), 3)).toBe(0);
  });

  it('sums crafted non-zero days', () => {
    const json = { daily: { time: ['a', 'b', 'c', 'd'], precipitation_sum: [2, 3.5, 1, 99] } };
    expect(parsePrecipDaysSum(json, 3)).toBeCloseTo(6.5);
  });

  it('returns null when a needed day is null/missing — never a partial sum', () => {
    expect(parsePrecipDaysSum({ daily: { precipitation_sum: [1.2, null, 3.3] } }, 3)).toBeNull();
    expect(parsePrecipDaysSum({ daily: { precipitation_sum: [1.2, 0.5] } }, 3)).toBeNull();
    expect(parsePrecipDaysSum({ daily: {} }, 3)).toBeNull();
    expect(parsePrecipDaysSum({ error: true }, 3)).toBeNull();
    expect(parsePrecipDaysSum({ daily: { precipitation_sum: [1, 2, 3] } }, 0)).toBeNull();
  });
});
