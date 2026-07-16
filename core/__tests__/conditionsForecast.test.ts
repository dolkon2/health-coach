/**
 * Forecast parser tests — the real hourly wind fixture (om-hourly-unixtime,
 * confirmed knots) plus crafted bodies carrying precip/temp/daily fields,
 * and the refusal edges: {error:true}, wrong wind units, empty response.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseForecastResponse } from '@core/conditions/forecast';

const FX = join(__dirname, '..', 'src', 'conditions', '__fixtures__');
function load<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

describe('parseForecastResponse', () => {
  it('parses the real hourly wind fixture (knots-verified)', () => {
    const out = parseForecastResponse(load('om-hourly-unixtime.json'));
    expect(out).not.toBeNull();
    expect(out!.hourly.length).toBe(12);
    expect(out!.hourly[0]).toMatchObject({
      timeEpochSec: 1783036800,
      windSpeedKts: expect.any(Number),
    });
    expect(out!.daily).toEqual([]);
  });

  it('parses hourly wind + precip/temp and daily fields together', () => {
    const json = {
      hourly_units: { time: 'unixtime', wind_speed_10m: 'kn' },
      hourly: {
        time: [1783036800, 1783040400],
        wind_speed_10m: [11.4, 11.1],
        wind_gusts_10m: [20.0, 20.8],
        wind_direction_10m: [290, 294],
        precipitation_probability: [10, 40],
        precipitation: [0, 0.2],
        temperature_2m: [18.2, 17.9],
        apparent_temperature: [16.9, 16.5],
      },
      daily: {
        time: [1783036800, 1783123200],
        precipitation_probability_max: [40, 60],
        precipitation_sum: [0.2, 1.5],
        temperature_2m_max: [22.1, 20.4],
        temperature_2m_min: [12.0, 11.2],
      },
    };
    const out = parseForecastResponse(json);
    expect(out).toEqual({
      hourly: [
        {
          timeEpochSec: 1783036800,
          windSpeedKts: 11.4,
          windGustKts: 20.0,
          windDirectionDeg: 290,
          precipProbabilityPct: 10,
          precipMm: 0,
          tempC: 18.2,
          apparentTempC: 16.9,
        },
        {
          timeEpochSec: 1783040400,
          windSpeedKts: 11.1,
          windGustKts: 20.8,
          windDirectionDeg: 294,
          precipProbabilityPct: 40,
          precipMm: 0.2,
          tempC: 17.9,
          apparentTempC: 16.5,
        },
      ],
      daily: [
        {
          dateEpochSec: 1783036800,
          precipProbabilityMaxPct: 40,
          precipSumMm: 0.2,
          tempMaxC: 22.1,
          tempMinC: 12.0,
        },
        {
          dateEpochSec: 1783123200,
          precipProbabilityMaxPct: 60,
          precipSumMm: 1.5,
          tempMaxC: 20.4,
          tempMinC: 11.2,
        },
      ],
    });
  });

  it('omits wind fields (never fabricates) when units are not knots, but keeps non-wind fields', () => {
    const json = {
      hourly_units: { wind_speed_10m: 'km/h' },
      hourly: {
        time: [1783036800],
        wind_speed_10m: [20.6],
        precipitation_probability: [5],
        temperature_2m: [19.0],
      },
    };
    const out = parseForecastResponse(json);
    expect(out).toEqual({
      hourly: [{ timeEpochSec: 1783036800, precipProbabilityPct: 5, tempC: 19.0 }],
      daily: [],
    });
  });

  it('drops a null hourly slot into an absent field, never a fabricated 0', () => {
    const json = {
      hourly_units: { wind_speed_10m: 'kn' },
      hourly: {
        time: [1783036800, 1783040400],
        wind_speed_10m: [11.4, null],
        precipitation: [0, null],
      },
    };
    const out = parseForecastResponse(json);
    expect(out!.hourly[1]).toEqual({ timeEpochSec: 1783040400 });
  });

  it('rejects {error:true}, non-object, and null bodies', () => {
    expect(parseForecastResponse({ error: true, reason: 'x' })).toBeNull();
    expect(parseForecastResponse(null)).toBeNull();
    expect(parseForecastResponse('nope')).toBeNull();
  });

  it('returns null when hourly and daily are both empty/absent', () => {
    expect(parseForecastResponse({})).toBeNull();
    expect(parseForecastResponse({ hourly: { time: [] }, daily: { time: [] } })).toBeNull();
  });
});
