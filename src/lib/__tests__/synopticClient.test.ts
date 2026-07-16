/**
 * Synoptic client tests (token configured) — mocked fetch (no live network
 * in CI), asserting: URL construction (radius/limit/recent/units/vars/
 * token), nearest-station selection by haversine, and null-on-any-failure.
 * See the no-token variant (synopticClientNoToken.test.ts) for the
 * missing-token short-circuit — that needs a separate module mock, hence
 * the separate file.
 */
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/lib/config', () => ({ SYNOPTIC_TOKEN: 'test-token-123' }));

import { fetchSynopticObservation } from '@/lib/conditions/synopticClient';

const asFetch = (f: unknown) => f as unknown as typeof fetch;

function jsonFetch(body: unknown, okFlag = true) {
  const urls: string[] = [];
  const impl = jest.fn(async (url: unknown) => {
    urls.push(String(url));
    return { ok: okFlag, status: okFlag ? 200 : 500, json: async () => body };
  });
  return { impl, urls };
}

const LAT = 45.6512;
const LNG = -121.2814;

const FIXTURE_BODY = {
  UNITS: { wind_speed: 'Knots', air_temp: 'Celsius' },
  STATION: [
    {
      STID: 'ODOT123',
      NAME: 'Rowena Summit',
      LATITUDE: '45.6512',
      LONGITUDE: '-121.2814',
      OBSERVATIONS: {
        air_temp_value_1: { value: 23.1, date_time: '2026-07-15T21:50:00Z' },
        wind_speed_value_1: { value: 14.0, date_time: '2026-07-15T21:50:00Z' },
        wind_gust_value_1: { value: 21.0, date_time: '2026-07-15T21:50:00Z' },
        wind_direction_value_1: { value: 285, date_time: '2026-07-15T21:50:00Z' },
      },
    },
    {
      STID: 'FAR1',
      NAME: 'Far Away',
      LATITUDE: '46.5',
      LONGITUDE: '-122.5',
      OBSERVATIONS: {
        wind_speed_value_1: { value: 8, date_time: '2026-07-15T21:50:00Z' },
      },
    },
  ],
};

describe('fetchSynopticObservation', () => {
  it('builds the radius/limit/recent/units/vars/token query and parses the nearest station', async () => {
    const { impl, urls } = jsonFetch(FIXTURE_BODY);

    const out = await fetchSynopticObservation(LAT, LNG, { fetchImpl: asFetch(impl) });

    expect(out).not.toBeNull();
    expect(out!.stationId).toBe('ODOT123');
    expect(out!.distanceKm).toBeCloseTo(0, 3);

    expect(urls[0]).toContain('api.synopticdata.com/v2/stations/latest');
    // Radius/recency are derived from the shared MAX_STATION_RADIUS_KM (50)
    // / STALE_READING_CUTOFF_MIN (90) thresholds, not hardcoded — assert
    // the derived values rather than a magic number that would silently
    // drift from those constants.
    expect(urls[0]).toContain(`radius=${LAT},${LNG},32`);
    expect(urls[0]).toContain('limit=10');
    expect(urls[0]).toContain('recent=120');
    expect(urls[0]).toContain('units=speed|kts,temp|C');
    expect(urls[0]).toContain('token=test-token-123');
  });

  it('picks the nearer of two returned stations by haversine', async () => {
    const { impl } = jsonFetch(FIXTURE_BODY);
    const out = await fetchSynopticObservation(LAT, LNG, { fetchImpl: asFetch(impl) });
    expect(out!.stationId).toBe('ODOT123'); // not FAR1
  });

  it('returns null when no station is returned', async () => {
    const { impl } = jsonFetch({ UNITS: {}, STATION: [] });
    expect(await fetchSynopticObservation(LAT, LNG, { fetchImpl: asFetch(impl) })).toBeNull();
  });

  it('returns null on a non-2xx response or a thrown fetch, never fabricates', async () => {
    const { impl: failImpl } = jsonFetch({}, false);
    expect(await fetchSynopticObservation(LAT, LNG, { fetchImpl: asFetch(failImpl) })).toBeNull();

    const throwImpl = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await fetchSynopticObservation(LAT, LNG, { fetchImpl: asFetch(throwImpl) })).toBeNull();
  });
});
