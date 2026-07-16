/**
 * NWS client tests — mocked fetch (no live network in CI), asserting:
 *   - the three-call chain (points → stations → observations/latest) and
 *     the User-Agent header on every request;
 *   - nearest-station selection is by haversine, not API list order (the
 *     fixture's second station, KDLS, is further from the query point);
 *   - degradation: a failure at any link in the chain → typed null, never
 *     a throw, never a fabricated reading.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fetchNwsObservation } from '@/lib/conditions/nwsClient';

const FX = join(__dirname, '..', '..', '..', 'core', 'src', 'conditions', '__fixtures__');
function load<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

const asFetch = (f: unknown) => f as unknown as typeof fetch;
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notFound = () => ({ ok: false, status: 404, json: async () => ({}) });
const FAIL = Symbol('http-fail');

/** Fetch mock dispatching on FIRST URL-substring match; records every call
 *  (url + headers). NOTE: the stations URL contains "points/" as a
 *  substring of "gridpoints/" — its route must be listed BEFORE the
 *  generic points-endpoint route (same ordering rule as usgsClient's
 *  trend-query-vs-bounded-interval collision). */
function routedFetch(routes: Array<[match: string, body: unknown]>) {
  const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
  const impl = jest.fn(async (url: unknown, init?: { headers?: Record<string, string> }) => {
    const u = String(url);
    calls.push({ url: u, headers: init?.headers });
    const hit = routes.find(([m]) => u.includes(m));
    if (!hit || hit[1] === FAIL) return notFound();
    return ok(hit[1]);
  });
  return { impl, calls };
}

// The query point sits exactly on the fixture's 4S2 station (distance 0);
// KDLS is the further of the two.
const LAT = 45.6866;
const LNG = -121.5199;

const HAPPY_ROUTES: Array<[string, unknown]> = [
  ['gridpoints/PDT/54,82/stations', load('nws-stations.json')],
  ['observations/latest', load('nws-observation-latest.json')],
  ['/points/', load('nws-points.json')],
];

describe('fetchNwsObservation', () => {
  it('chains points -> stations -> nearest station observation, attaching a User-Agent', async () => {
    const { impl, calls } = routedFetch(HAPPY_ROUTES);

    const out = await fetchNwsObservation(LAT, LNG, { fetchImpl: asFetch(impl) });

    expect(out).not.toBeNull();
    expect(out!.stationId).toBe('4S2');
    expect(out!.stationName).toBe('Hood River');
    expect(out!.distanceKm).toBeCloseTo(0, 3);
    expect(out!.observedAtUtc).toBe('2026-07-15T21:53:00+00:00');
    expect(out!.windAvgKts).toBeCloseTo(22.2 / 1.852, 5);

    expect(calls).toHaveLength(3);
    expect(calls[0].url).toContain('/points/45.6866,-121.5199');
    expect(calls[1].url).toBe('https://api.weather.gov/gridpoints/PDT/54,82/stations');
    expect(calls[2].url).toBe('https://api.weather.gov/stations/4S2/observations/latest');
    for (const c of calls) {
      expect(c.headers?.['User-Agent']).toContain('health-coach');
    }
  });

  it('picks the nearer station by haversine, not list order', async () => {
    // Query point placed near KDLS (the SECOND, further-down-the-list
    // station in the fixture) to prove distance drives the pick.
    const { impl, calls } = routedFetch(HAPPY_ROUTES);
    await fetchNwsObservation(45.6167, -121.1667, { fetchImpl: asFetch(impl) });
    expect(calls[2].url).toBe('https://api.weather.gov/stations/KDLS/observations/latest');
  });

  it('returns null when the points fetch fails, without calling further', async () => {
    const { impl, calls } = routedFetch([['/points/', FAIL]]);
    expect(await fetchNwsObservation(LAT, LNG, { fetchImpl: asFetch(impl) })).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('returns null when the stations collection is empty', async () => {
    const { impl } = routedFetch([
      ['gridpoints/PDT/54,82/stations', { type: 'FeatureCollection', features: [] }],
      ['/points/', load('nws-points.json')],
    ]);
    expect(await fetchNwsObservation(LAT, LNG, { fetchImpl: asFetch(impl) })).toBeNull();
  });

  it('returns null when the nearest station has no current observation', async () => {
    const { impl } = routedFetch([
      ['gridpoints/PDT/54,82/stations', load('nws-stations.json')],
      ['observations/latest', FAIL],
      ['/points/', load('nws-points.json')],
    ]);
    expect(await fetchNwsObservation(LAT, LNG, { fetchImpl: asFetch(impl) })).toBeNull();
  });

  it('returns null on a network error, never throws', async () => {
    const impl = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await fetchNwsObservation(LAT, LNG, { fetchImpl: asFetch(impl) })).toBeNull();
  });
});
