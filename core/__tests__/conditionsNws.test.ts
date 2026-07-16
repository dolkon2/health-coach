/**
 * NWS parser tests — fixture-driven against trimmed real-shape responses
 * (points → stations → observations/latest), plus crafted bodies for the
 * honest-miss edges: unrecognized wind unitCode, non-degC temperature,
 * null windGust (a station that never gusts), missing timestamp.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseNwsPointsStationsUrl,
  parseNwsStations,
  parseNwsObservation,
} from '@core/conditions/nws';

const FX = join(__dirname, '..', 'src', 'conditions', '__fixtures__');
function load<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

describe('parseNwsPointsStationsUrl', () => {
  it('extracts the observationStations collection URL', () => {
    expect(parseNwsPointsStationsUrl(load('nws-points.json'))).toBe(
      'https://api.weather.gov/gridpoints/PDT/54,82/stations'
    );
  });

  it('returns null when the shape does not match', () => {
    expect(parseNwsPointsStationsUrl(null)).toBeNull();
    expect(parseNwsPointsStationsUrl({})).toBeNull();
    expect(parseNwsPointsStationsUrl({ properties: {} })).toBeNull();
  });
});

describe('parseNwsStations', () => {
  it('parses stations, flipping GeoJSON [lng,lat] to {lat,lng}', () => {
    const out = parseNwsStations(load('nws-stations.json'));
    expect(out).toEqual([
      { stationId: '4S2', name: 'Hood River', lat: 45.6866, lng: -121.5199 },
      { stationId: 'KDLS', name: 'The Dalles Municipal Airport', lat: 45.6167, lng: -121.1667 },
    ]);
  });

  it('drops a feature missing an identifier or real Point geometry', () => {
    const out = parseNwsStations({
      features: [
        { properties: { name: 'no id' }, geometry: { coordinates: [-121, 45] } },
        { properties: { stationIdentifier: 'X1' }, geometry: null },
        { properties: { stationIdentifier: 'X2' }, geometry: { coordinates: [-121, 45] } },
      ],
    });
    expect(out).toEqual([{ stationId: 'X2', name: 'X2', lat: 45, lng: -121 }]);
  });

  it('returns [] for a non-collection body', () => {
    expect(parseNwsStations(null)).toEqual([]);
    expect(parseNwsStations({})).toEqual([]);
  });
});

describe('parseNwsObservation', () => {
  it('parses temp/wind from the real-shape fixture, converting km/h to knots', () => {
    const out = parseNwsObservation(load('nws-observation-latest.json'));
    expect(out).not.toBeNull();
    expect(out!.observedAtUtc).toBe('2026-07-15T21:53:00+00:00');
    expect(out!.tempC).toBe(24.4);
    expect(out!.windDirectionDeg).toBe(300);
    expect(out!.windAvgKts).toBeCloseTo(22.2 / 1.852, 5);
    expect(out!.windGustKts).toBeCloseTo(35.6 / 1.852, 5);
  });

  it('converts m/s wind readings to knots too', () => {
    const out = parseNwsObservation({
      properties: {
        timestamp: '2026-07-15T21:53:00+00:00',
        windSpeed: { unitCode: 'wmoUnit:m_s-1', value: 10 },
      },
    });
    expect(out!.windAvgKts).toBeCloseTo(10 / 0.514444, 5);
  });

  it('drops wind fields (never fabricates) on an unrecognized unitCode', () => {
    const out = parseNwsObservation({
      properties: {
        timestamp: '2026-07-15T21:53:00+00:00',
        windSpeed: { unitCode: 'wmoUnit:kn', value: 12 },
        temperature: { unitCode: 'wmoUnit:degF', value: 75 },
      },
    });
    expect(out).toEqual({ observedAtUtc: '2026-07-15T21:53:00+00:00' });
  });

  it('drops a null windGust (a station that never gusts) rather than zeroing it', () => {
    const out = parseNwsObservation({
      properties: {
        timestamp: '2026-07-15T21:53:00+00:00',
        windSpeed: { unitCode: 'wmoUnit:km_h-1', value: 10 },
        windGust: { unitCode: 'wmoUnit:km_h-1', value: null },
      },
    });
    expect(out!.windGustKts).toBeUndefined();
    expect('windGustKts' in out!).toBe(false);
  });

  it('returns null when there is no timestamp', () => {
    expect(parseNwsObservation({ properties: {} })).toBeNull();
    expect(parseNwsObservation(null)).toBeNull();
  });
});
