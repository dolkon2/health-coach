/**
 * The Proof — SNOTEL freeze is nearest-neighbor client-side and honest about
 * gaps (E3), run against the REAL captured AWDB responses:
 *   1. The stations endpoint has no radius param — we fetch the candidate
 *      states' `*:XX:SNTL` networks and haversine: from the Mt Hood trailhead
 *      the nearest of Oregon's 82 stations is 651:OR:SNTL at ~5.6 km.
 *   2. A point in no SNOTEL state (the east coast) → null with ZERO fetches —
 *      honest absence, not a wasted round trip.
 *   3. Daily values map by exact date; the July fixture's real skipped days
 *      (PRCPSA absent 07-02/07-03 — absent, not null) → those keys absent,
 *      while the same day's reported 0 depth lands as 0 (null ≠ 0).
 *   4. Composed SnowConditions carry tier 1 + source 'snotel:<triplet>' +
 *      distanceKm (staleness-by-distance stays visible forever); a day the
 *      station reported nothing at all → null, never an empty husk.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  fetchSnotelConditions,
  fetchSnowAt,
  findNearestSnotelStation,
  snotelCandidateStates,
} from '../snotel';

const FX = join(__dirname, '..', '__fixtures__');
const load = <T,>(name: string): T =>
  JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;

const MT_HOOD = { lat: 45.37, lng: -121.7 };

/** A fetch stub that routes /stations and /data to their fixtures. */
function awdbFetch(dataFixture: string) {
  const urls: string[] = [];
  const fn = jest.fn(async (url: unknown) => {
    const u = String(url);
    urls.push(u);
    const body = u.includes('/stations')
      ? load('snotel-stations-or-sntl.json')
      : load(dataFixture);
    return { ok: true, status: 200, json: async () => body };
  });
  return { fetchImpl: fn as unknown as typeof fetch, urls };
}

describe('snotelCandidateStates', () => {
  it('maps Mt Hood into SNOTEL country and Manhattan out of it', () => {
    expect(snotelCandidateStates(MT_HOOD.lat, MT_HOOD.lng)).toContain('OR');
    expect(snotelCandidateStates(40.71, -74.0)).toEqual([]);
  });
});

describe('findNearestSnotelStation', () => {
  it('finds 651:OR:SNTL (Mt Hood Test Site) at ~5.6 km via client-side haversine', async () => {
    const { fetchImpl, urls } = awdbFetch('snotel-data-651-march-week.json');
    const hit = await findNearestSnotelStation(MT_HOOD, { fetchImpl });
    expect(urls[0]).toContain('*:OR:SNTL');
    expect(urls[0]).toContain('activeOnly=true');
    expect(hit?.stationTriplet).toBe('651:OR:SNTL');
    expect(hit?.name).toBe('Mt Hood Test Site');
    expect(hit?.elevationFt).toBe(5380);
    expect(hit?.distanceKm).toBeGreaterThan(5.4);
    expect(hit?.distanceKm).toBeLessThan(5.8);
  });

  it('east-coast point → null WITHOUT any fetch (honest absence)', async () => {
    const { fetchImpl, urls } = awdbFetch('snotel-data-651-march-week.json');
    expect(await findNearestSnotelStation({ lat: 40.71, lng: -74.0 }, { fetchImpl })).toBeNull();
    expect(urls).toHaveLength(0);
  });
});

describe('fetchSnowAt', () => {
  it('maps a mid-winter day: WTEQ/SNWD/PRCPSA by exact date', async () => {
    const { fetchImpl } = awdbFetch('snotel-data-651-march-week.json');
    const v = await fetchSnowAt('651:OR:SNTL', '2026-03-04', { fetchImpl });
    expect(v).toEqual({ sweIn: 17.1, depthIn: 53, precipSnowAdjIn: 0.9 });
  });

  it('a skipped day is absent, a reported 0 is 0 (real July melt-out fixture)', async () => {
    const { fetchImpl } = awdbFetch('snotel-data-651-recent-week.json');
    // 2026-07-02: PRCPSA's values array skips the day entirely; WTEQ/SNWD say 0.
    const v = await fetchSnowAt('651:OR:SNTL', '2026-07-02', { fetchImpl });
    expect(v).toEqual({ sweIn: 0, depthIn: 0 });
    expect(v && 'precipSnowAdjIn' in v).toBe(false);
  });

  it('never throws on a failed fetch — null', async () => {
    const fetchImpl = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchSnowAt('651:OR:SNTL', '2026-03-04', { fetchImpl })).toBeNull();
  });
});

describe('fetchSnotelConditions (composed)', () => {
  it('freezes tier-1 SnowConditions with station provenance + distance', async () => {
    const { fetchImpl } = awdbFetch('snotel-data-651-march-week.json');
    const snow = await fetchSnotelConditions(
      { ...MT_HOOD, dateLocal: '2026-03-04' },
      { fetchImpl, now: () => new Date('2026-07-05T12:00:00Z') }
    );
    expect(snow).toEqual({
      tier: 1,
      source: 'snotel:651:OR:SNTL',
      fetchedAt: '2026-07-05T12:00:00.000Z',
      stationTriplet: '651:OR:SNTL',
      stationName: 'Mt Hood Test Site',
      distanceKm: 5.6,
      stationElevationFt: 5380,
      sweIn: 17.1,
      depthIn: 53,
      precipSnowAdjIn: 0.9,
      date: '2026-03-04',
    });
  });

  it('a day the station reported nothing at all → null, not an empty husk', async () => {
    const { fetchImpl } = awdbFetch('snotel-data-651-recent-week.json');
    // 2026-07-05 is absent from every element's values in the fixture.
    expect(
      await fetchSnotelConditions({ ...MT_HOOD, dateLocal: '2026-07-05' }, { fetchImpl })
    ).toBeNull();
  });

  it('no candidate state → null', async () => {
    const { fetchImpl, urls } = awdbFetch('snotel-data-651-march-week.json');
    expect(
      await fetchSnotelConditions({ lat: 40.71, lng: -74.0, dateLocal: '2026-03-04' }, { fetchImpl })
    ).toBeNull();
    expect(urls).toHaveLength(0);
  });
});
