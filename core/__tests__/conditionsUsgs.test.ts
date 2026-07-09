/**
 * USGS OGC parser tests — fixture-driven against real (trimmed) API
 * responses in `core/src/conditions/__fixtures__/`, plus crafted bodies for
 * the honest-miss edges: string values that don't parse, non-instantaneous
 * statistics, empty collections, cooperator-agency sites, null geometry.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseLatestReadings, parseSeries, parseSiteSearch } from '@core/conditions/usgs';

const FX = join(__dirname, '..', 'src', 'conditions', '__fixtures__');
function load<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

/** A minimal continuous-collection feature with overridable properties. */
function feature(props: Record<string, unknown>) {
  return {
    type: 'Feature',
    properties: {
      monitoring_location_id: 'USGS-14123500',
      parameter_code: '00060',
      statistic_id: '00011',
      time: '2026-07-05T22:00:00+00:00',
      value: '591',
      unit_of_measure: 'ft^3/s',
      approval_status: 'Provisional',
      qualifier: null,
      ...props,
    },
    id: 'x',
    geometry: null,
  };
}
const collection = (features: unknown[]) => ({
  type: 'FeatureCollection',
  features,
  numberReturned: features.length,
});

describe('parseLatestReadings', () => {
  it('parses a discharge reading: STRING value → number, provenance carried', () => {
    const out = parseLatestReadings(load('usgs-latest-discharge.json'));
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      parameter: 'discharge',
      value: 591, // '591' string in the response
      unit: 'ft^3/s',
      timeUtc: '2026-07-05T22:00:00+00:00',
      approvalStatus: 'Provisional',
    });
    // qualifier is null in the response → key absent, not null (null ≠ 0 rule).
    expect('qualifier' in out[0]).toBe(false);
  });

  it('parses gauge height (00065) with its decimal string value', () => {
    const out = parseLatestReadings(load('usgs-latest-gage-height.json'));
    expect(out).toHaveLength(1);
    expect(out[0].parameter).toBe('gaugeHeight');
    expect(out[0].value).toBe(3.56);
    expect(out[0].unit).toBe('ft');
  });

  it('keeps only discharge/gauge-height from a parameter-rich site', () => {
    // Real fixture: turbidity (63680) + temperature (00010) + 00060 + 00065.
    const out = parseLatestReadings(load('usgs-latest-multi-param.json'));
    expect(out.map((r) => r.parameter).sort()).toEqual(['discharge', 'gaugeHeight']);
  });

  it('parses the bounded historical interval response (backdated-gauge path)', () => {
    const out = parseLatestReadings(load('usgs-continuous-bounded.json'));
    expect(out.length).toBeGreaterThanOrEqual(7);
    expect(out.every((r) => r.parameter === 'discharge')).toBe(true);
    expect(out.every((r) => typeof r.value === 'number')).toBe(true);
  });

  it('drops a value that does not parse as a number (never coerced to 0)', () => {
    const out = parseLatestReadings(collection([feature({ value: 'Ice' }), feature({})]));
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(591);
  });

  it('drops non-instantaneous statistics (daily means are not conditions)', () => {
    const out = parseLatestReadings(collection([feature({ statistic_id: '00003' })]));
    expect(out).toEqual([]);
  });

  it('carries string and array qualifiers', () => {
    const out = parseLatestReadings(
      collection([feature({ qualifier: 'e' }), feature({ qualifier: ['e', 'A'] })])
    );
    expect(out[0].qualifier).toBe('e');
    expect(out[1].qualifier).toBe('e,A');
  });

  it('returns [] for numberReturned: 0 and malformed bodies', () => {
    expect(parseLatestReadings(collection([]))).toEqual([]);
    expect(parseLatestReadings({ numberReturned: 0 })).toEqual([]);
    expect(parseLatestReadings(null)).toEqual([]);
    expect(parseLatestReadings('nope')).toEqual([]);
  });
});

describe('parseSeries', () => {
  it('sorts the newest-first 6h series oldest-first, values parsed', () => {
    const out = parseSeries(load('usgs-series-6h.json'));
    expect(out).toHaveLength(10);
    expect(out[0].timeUtc).toBe('2026-07-05T19:45:00+00:00'); // API sent 22:00 first
    expect(out[9].timeUtc).toBe('2026-07-05T22:00:00+00:00');
    expect(out.every((p) => typeof p.value === 'number')).toBe(true);
  });

  it('works on the trimmed trend-query shape (properties=time,value only)', () => {
    const out = parseSeries(
      collection([
        { properties: { time: '2026-07-05T21:00:00+00:00', value: '600' } },
        { properties: { time: '2026-07-05T20:00:00+00:00', value: '500' } },
      ])
    );
    expect(out).toEqual([
      { timeUtc: '2026-07-05T20:00:00+00:00', value: 500 },
      { timeUtc: '2026-07-05T21:00:00+00:00', value: 600 },
    ]);
  });

  it('drops unparseable values and returns [] on empty', () => {
    expect(
      parseSeries(collection([{ properties: { time: '2026-07-05T20:00:00+00:00', value: '--' } }]))
    ).toEqual([]);
    expect(parseSeries({ numberReturned: 0 })).toEqual([]);
  });
});

describe('parseSiteSearch', () => {
  it('maps a name search to sites with GeoJSON [lng, lat] unswapped', () => {
    const out = parseSiteSearch(load('usgs-site-search-name.json'));
    expect(out).toHaveLength(10);
    expect(out[0].siteId).toBe('USGS-14121300');
    expect(out[0].name).toContain('WHITE SALMON');
    expect(out[0].lat).toBeCloseTo(46.1037, 3);
    expect(out[0].lng).toBeCloseTo(-121.6087, 3);
  });

  it('filters cooperator agencies out of bbox results (OR004-* is a dead-end pick)', () => {
    const out = parseSiteSearch(load('usgs-site-search-bbox.json'));
    expect(out).toHaveLength(7); // fixture has 8 features, one OR004
    expect(out.every((s) => s.siteId.startsWith('USGS-'))).toBe(true);
  });

  it('keeps a site with missing/null geometry, coords absent (absent ≠ 0,0)', () => {
    const out = parseSiteSearch(
      collection([
        {
          id: 'USGS-00000001',
          properties: { agency_code: 'USGS', monitoring_location_name: 'NOWHERE CREEK' },
          geometry: null,
        },
      ])
    );
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBeUndefined();
    expect(out[0].lng).toBeUndefined();
  });

  it('returns [] for empty and malformed bodies', () => {
    expect(parseSiteSearch({ numberReturned: 0 })).toEqual([]);
    expect(parseSiteSearch(undefined)).toEqual([]);
  });
});
