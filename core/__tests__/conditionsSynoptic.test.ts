/**
 * Synoptic parser tests — fixture-driven against a best-effort real-shape
 * body (see synoptic.ts's ⚑ live-verification flag), plus the honest-miss
 * edges: a UNITS block that isn't knots/Celsius, a station with no
 * timestamped observation at all, missing coordinates.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseSynopticLatest } from '@core/conditions/synoptic';

const FX = join(__dirname, '..', 'src', 'conditions', '__fixtures__');
function load<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

describe('parseSynopticLatest', () => {
  it('parses the fixture station with knots/Celsius asserted', () => {
    const out = parseSynopticLatest(load('synoptic-latest.json'));
    expect(out).toEqual([
      {
        stationId: 'ODOT123',
        name: 'Rowena Summit',
        lat: 45.6512,
        lng: -121.2814,
        observedAtUtc: '2026-07-15T21:50:00Z',
        windAvgKts: 14.0,
        windGustKts: 21.0,
        windDirectionDeg: 285,
        tempC: 23.1,
      },
    ]);
  });

  it('drops wind and temp (never fabricates) when UNITS is not knots/Celsius', () => {
    const out = parseSynopticLatest({
      UNITS: { wind_speed: 'MPH', air_temp: 'Fahrenheit' },
      STATION: [
        {
          STID: 'X1',
          NAME: 'Some Station',
          LATITUDE: '45.0',
          LONGITUDE: '-121.0',
          OBSERVATIONS: {
            wind_speed_value_1: { value: 10, date_time: '2026-07-15T21:50:00Z' },
            air_temp_value_1: { value: 70, date_time: '2026-07-15T21:50:00Z' },
          },
        },
      ],
    });
    expect(out).toEqual([
      {
        stationId: 'X1',
        name: 'Some Station',
        lat: 45.0,
        lng: -121.0,
        observedAtUtc: '2026-07-15T21:50:00Z',
      },
    ]);
  });

  it('picks the truly latest reading by parsed time, not lexicographic string order', () => {
    // Whole-second 'Z' timestamp vs. a fractional-second one at the same
    // second — lexicographically the fractional one sorts BEFORE the
    // whole-second one ('.' < 'Z'), even though it is chronologically
    // LATER. A naive .sort().pop() would pick the wrong (older) reading.
    const out = parseSynopticLatest({
      UNITS: { wind_speed: 'Knots', air_temp: 'Celsius' },
      STATION: [
        {
          STID: 'X1',
          NAME: 'Mixed Precision',
          LATITUDE: '45.0',
          LONGITUDE: '-121.0',
          OBSERVATIONS: {
            air_temp_value_1: { value: 20, date_time: '2026-07-15T21:50:00Z' },
            wind_speed_value_1: { value: 10, date_time: '2026-07-15T21:50:00.500Z' },
          },
        },
      ],
    });
    expect(out[0].observedAtUtc).toBe('2026-07-15T21:50:00.500Z');
  });

  it('drops a station with no timestamped observation at all', () => {
    const out = parseSynopticLatest({
      UNITS: { wind_speed: 'Knots', air_temp: 'Celsius' },
      STATION: [{ STID: 'X1', LATITUDE: '45.0', LONGITUDE: '-121.0', OBSERVATIONS: {} }],
    });
    expect(out).toEqual([]);
  });

  it('drops a station missing coordinates or an id', () => {
    const out = parseSynopticLatest({
      UNITS: { wind_speed: 'Knots', air_temp: 'Celsius' },
      STATION: [
        { NAME: 'no id', LATITUDE: '45.0', LONGITUDE: '-121.0', OBSERVATIONS: {} },
        { STID: 'X2', LATITUDE: 'not-a-number', LONGITUDE: '-121.0', OBSERVATIONS: {} },
      ],
    });
    expect(out).toEqual([]);
  });

  it('returns [] for a non-object body or a missing STATION array', () => {
    expect(parseSynopticLatest(null)).toEqual([]);
    expect(parseSynopticLatest({})).toEqual([]);
  });
});
