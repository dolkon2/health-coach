/**
 * USGS client tests — mocked fetch (no live network in CI), asserting:
 *   - URL construction: latest-continuous with limit=100 for recent
 *     sessions, bounded continuous intervals for BACKDATED sessions (never
 *     a now-reading), the 6h trend query with sortby/skipGeometry/limit=100,
 *     USGS- prefixing of bare-digit site ids;
 *   - degradation: trend failure → snapshot without trend; total failure /
 *     timeout → typed null, never a throw.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  fetchGaugeSnapshot,
  searchGaugeSitesByName,
  searchGaugeSitesByBbox,
} from '@/lib/conditions/usgsClient';

const FX = join(__dirname, '..', '..', '..', 'core', 'src', 'conditions', '__fixtures__');
function load<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

const asFetch = (f: unknown) => f as unknown as typeof fetch;
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notFound = () => ({ ok: false, status: 404, json: async () => ({}) });
const EMPTY = { type: 'FeatureCollection', features: [], numberReturned: 0 };
/** Route body marking an HTTP failure for that URL. */
const FAIL = Symbol('http-fail');

/** Fetch mock dispatching on FIRST URL-substring match; records every URL.
 *  NOTE: the trend query contains `parameter_code=...&time=` too, so a
 *  `sortby=-time` route must be listed BEFORE any bounded-interval route. */
function routedFetch(routes: Array<[match: string, body: unknown]>) {
  const urls: string[] = [];
  const impl = jest.fn(async (url: unknown) => {
    const u = String(url);
    urls.push(u);
    const hit = routes.find(([m]) => u.includes(m));
    if (!hit || hit[1] === FAIL) return notFound();
    return ok(hit[1]);
  });
  return { impl, urls };
}

/** Mirror of the client's interval formatting, for URL assertions. */
function rfc3339(sec: number): string {
  return new Date(Math.round(sec) * 1000).toISOString().replace('.000Z', 'Z');
}

describe('fetchGaugeSnapshot — recent path (≤2h)', () => {
  it('reads latest-continuous with limit=100 and computes trend from a 6h window ending at when', async () => {
    const when = Math.floor(Date.now() / 1000) - 600;
    const { impl, urls } = routedFetch([
      ['latest-continuous', load('usgs-latest-discharge.json')],
      ['sortby=-time', load('usgs-series-6h.json')],
    ]);

    const snap = await fetchGaugeSnapshot('USGS-14123500', when, { fetchImpl: asFetch(impl) });

    expect(snap).not.toBeNull();
    expect(snap!.siteId).toBe('USGS-14123500');
    expect(snap!.source).toBe('usgs');
    expect(snap!.readings).toEqual([
      { parameter: 'discharge', value: 591, unit: 'ft^3/s', timeUtc: '2026-07-05T22:00:00+00:00' },
    ]);
    expect(snap!.observedAtUtc).toBe('2026-07-05T22:00:00+00:00');
    expect(snap!.trend).toBe('steady');
    expect(snap!.approvalStatus).toBe('Provisional');

    const latestUrl = urls.find((u) => u.includes('latest-continuous'))!;
    expect(latestUrl).toContain('/collections/latest-continuous/items');
    expect(latestUrl).toContain('monitoring_location_id=USGS-14123500');
    expect(latestUrl).toContain('limit=100');

    const trendUrl = urls.find((u) => u.includes('sortby=-time'))!;
    expect(trendUrl).toContain('/collections/continuous/items');
    expect(trendUrl).toContain(`time=${rfc3339(when - 6 * 3600)}/${rfc3339(when)}`);
    expect(trendUrl).toContain('limit=100'); // default 10 truncates the window
    expect(trendUrl).toContain('skipGeometry=true');
    expect(trendUrl).toContain('properties=time,value');
  });

  it('prefixes a bare-digit site id with USGS-', async () => {
    const { impl, urls } = routedFetch([
      ['latest-continuous', load('usgs-latest-discharge.json')],
      ['sortby=-time', EMPTY],
    ]);
    await fetchGaugeSnapshot('14123500', Math.floor(Date.now() / 1000), {
      fetchImpl: asFetch(impl),
    });
    expect(urls[0]).toContain('monitoring_location_id=USGS-14123500');
  });
});

describe('fetchGaugeSnapshot — backdated path', () => {
  // The trimmed live fixture covers 2026-07-04T10:00Z..16:00Z hourly.
  const WHEN = Date.parse('2026-07-04T12:40:00Z') / 1000;

  it('reads bounded ±3h intervals per parameter, picks the reading nearest the session — never latest', async () => {
    const { impl, urls } = routedFetch([
      ['sortby=-time', load('usgs-series-6h.json')], // trend first: it also matches &time=
      ['parameter_code=00060&time=', load('usgs-continuous-bounded.json')],
      ['parameter_code=00065&time=', EMPTY],
    ]);

    const snap = await fetchGaugeSnapshot('USGS-14123500', WHEN, { fetchImpl: asFetch(impl) });

    expect(snap).not.toBeNull();
    expect(snap!.readings).toHaveLength(1);
    expect(snap!.readings[0].parameter).toBe('discharge');
    // 12:40 is nearest the 13:00 reading.
    expect(snap!.observedAtUtc).toBe('2026-07-04T13:00:00+00:00');

    expect(urls.some((u) => u.includes('latest-continuous'))).toBe(false);
    const boundedUrl = urls.find((u) => u.includes('parameter_code=00060&time='))!;
    expect(boundedUrl).toContain('/collections/continuous/items');
    expect(boundedUrl).toContain(`time=${rfc3339(WHEN - 3 * 3600)}/${rfc3339(WHEN + 3 * 3600)}`);
    expect(boundedUrl).toContain('limit=100');
    // Both parameters probed.
    expect(urls.some((u) => u.includes('parameter_code=00065&time='))).toBe(true);
  });

  it('degrades to a snapshot WITHOUT trend when the trend fetch fails', async () => {
    const { impl } = routedFetch([
      ['sortby=-time', FAIL], // the trend query 404s
      ['parameter_code=00060&time=', load('usgs-continuous-bounded.json')],
      // 00065 also 404s (no route).
    ]);
    const snap = await fetchGaugeSnapshot('USGS-14123500', WHEN, { fetchImpl: asFetch(impl) });
    expect(snap).not.toBeNull();
    expect(snap!.trend).toBeUndefined();
    expect('trend' in snap!).toBe(false); // omit-when-absent, not trend: undefined
  });

  it('returns null when no parameter yields a reading (degrade to manual entry)', async () => {
    const { impl } = routedFetch([['continuous/items', EMPTY]]);
    expect(await fetchGaugeSnapshot('USGS-14123500', WHEN, { fetchImpl: asFetch(impl) })).toBeNull();
  });
});

describe('fetchGaugeSnapshot — failure modes', () => {
  it('returns null on network error, never throws', async () => {
    const impl = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(
      await fetchGaugeSnapshot('USGS-14123500', Math.floor(Date.now() / 1000), {
        fetchImpl: asFetch(impl),
      })
    ).toBeNull();
  });

  it('returns null on a timeout (AbortController ~4s)', async () => {
    jest.useFakeTimers();
    try {
      const impl = jest.fn(
        (_url: unknown, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          })
      );
      const p = fetchGaugeSnapshot('USGS-14123500', Math.floor(Date.now() / 1000), {
        fetchImpl: asFetch(impl),
      });
      await jest.advanceTimersByTimeAsync(5000);
      expect(await p).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('searchGaugeSitesByName', () => {
  it('builds an uppercased CQL2 LIKE filter with limit=100', async () => {
    const { impl, urls } = routedFetch([['monitoring-locations', load('usgs-site-search-name.json')]]);
    const out = await searchGaugeSitesByName('white salmon', { fetchImpl: asFetch(impl) });
    expect(out).toHaveLength(10);
    expect(urls[0]).toContain('/collections/monitoring-locations/items');
    expect(urls[0]).toContain(
      `filter=${encodeURIComponent("monitoring_location_name LIKE '%WHITE SALMON%'")}`
    );
    expect(urls[0]).toContain('limit=100');
  });

  it('returns [] for blank input without fetching, and [] on failure', async () => {
    const impl = jest.fn(async () => notFound());
    expect(await searchGaugeSitesByName('  ', { fetchImpl: asFetch(impl) })).toEqual([]);
    expect(impl).not.toHaveBeenCalled();
    expect(await searchGaugeSitesByName('gone', { fetchImpl: asFetch(impl) })).toEqual([]);
  });
});

describe('searchGaugeSitesByBbox', () => {
  it('builds bbox + site_type_code=ST + limit=100 and filters cooperator sites', async () => {
    const { impl, urls } = routedFetch([['monitoring-locations', load('usgs-site-search-bbox.json')]]);
    const out = await searchGaugeSitesByBbox([-121.9, 45.6, -121.1, 46.1], {
      fetchImpl: asFetch(impl),
    });
    expect(urls[0]).toContain('bbox=-121.9,45.6,-121.1,46.1');
    expect(urls[0]).toContain('site_type_code=ST');
    expect(urls[0]).toContain('limit=100');
    // Fixture holds 8 features, one OR004 cooperator → filtered by the parser.
    expect(out).toHaveLength(7);
    expect(out.every((s) => s.siteId.startsWith('USGS-'))).toBe(true);
  });
});
