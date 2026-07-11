/**
 * current.ts tests — TTL caching (no refetch inside the window, bypass
 * forces one), which fetches fire for which spot shape (coords-only,
 * gauge-only, neither), and null-honesty on a total fetch failure (never
 * throws, never fabricates a reading).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { fetchCurrentForSpot, cachedCurrentForSpot, __clearCurrentConditionsCache } from '../current';
import type { Spot } from '@core/spot';

function failingFetch() {
  const fn = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
  return fn as unknown as typeof fetch;
}

const RIVER_SPOT: Spot = {
  id: 'spot-1',
  name: 'Green Truss',
  kind: 'river-section',
  sport: 'kayak',
  lat: 45.7,
  lng: -121.5,
  gaugeSiteId: 'USGS-14123500',
};

const WEATHER_ONLY_SPOT: Spot = {
  id: 'spot-2',
  name: 'Trailhead',
  kind: 'launch',
  lat: 45.5,
  lng: -121.7,
};

const COORDLESS_SPOT: Spot = {
  id: 'spot-3',
  name: 'Legacy river run',
  kind: 'river-section',
  gaugeSiteId: 'USGS-14123500',
};

const NOW = () => new Date('2026-07-11T12:00:00Z');

beforeEach(() => {
  __clearCurrentConditionsCache();
});

describe('fetchCurrentForSpot', () => {
  it('a total fetch failure degrades to an honest all-null reading, never throws', async () => {
    const fetchImpl = failingFetch();
    const result = await fetchCurrentForSpot(RIVER_SPOT, { now: NOW, fetchImpl });
    expect(result.weather).toBeNull();
    expect(result.gauge).toBeNull();
    expect(result.fetchedAt).toBe(NOW().toISOString());
  });

  it('attempts both weather and gauge fetches when a spot has coords + a gauge site', async () => {
    const fetchImpl = failingFetch();
    await fetchCurrentForSpot(RIVER_SPOT, { now: NOW, fetchImpl });
    expect(fetchImpl).toHaveBeenCalled();
    const urls = (fetchImpl as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('open-meteo'))).toBe(true);
    expect(urls.some((u) => u.includes('waterdata.usgs.gov'))).toBe(true);
  });

  it('a coordless spot skips the weather fetch entirely (gauge still attempted)', async () => {
    const fetchImpl = failingFetch();
    const result = await fetchCurrentForSpot(COORDLESS_SPOT, { now: NOW, fetchImpl });
    expect(result.weather).toBeNull();
    const urls = (fetchImpl as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('open-meteo'))).toBe(false);
    expect(urls.some((u) => u.includes('waterdata.usgs.gov'))).toBe(true);
  });

  it('a spot with no gaugeSiteId skips the gauge fetch entirely', async () => {
    const fetchImpl = failingFetch();
    const result = await fetchCurrentForSpot(WEATHER_ONLY_SPOT, { now: NOW, fetchImpl });
    expect(result.gauge).toBeNull();
    const urls = (fetchImpl as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('waterdata.usgs.gov'))).toBe(false);
  });

  it('a second call within the TTL is served from cache — no new fetch', async () => {
    const fetchImpl = failingFetch();
    await fetchCurrentForSpot(RIVER_SPOT, { now: NOW, fetchImpl });
    const callsAfterFirst = (fetchImpl as jest.Mock).mock.calls.length;
    const fiveMinutesLater = () => new Date(NOW().getTime() + 5 * 60 * 1000);
    await fetchCurrentForSpot(RIVER_SPOT, { now: fiveMinutesLater, fetchImpl });
    expect((fetchImpl as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
  });

  it('a call past the TTL refetches', async () => {
    const fetchImpl = failingFetch();
    await fetchCurrentForSpot(RIVER_SPOT, { now: NOW, fetchImpl });
    const callsAfterFirst = (fetchImpl as jest.Mock).mock.calls.length;
    const elevenMinutesLater = () => new Date(NOW().getTime() + 11 * 60 * 1000);
    await fetchCurrentForSpot(RIVER_SPOT, { now: elevenMinutesLater, fetchImpl });
    expect((fetchImpl as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('bypassCache forces a refetch even inside the TTL window', async () => {
    const fetchImpl = failingFetch();
    await fetchCurrentForSpot(RIVER_SPOT, { now: NOW, fetchImpl });
    const callsAfterFirst = (fetchImpl as jest.Mock).mock.calls.length;
    await fetchCurrentForSpot(RIVER_SPOT, { now: NOW, fetchImpl, bypassCache: true });
    expect((fetchImpl as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('cachedCurrentForSpot reads the last fetch without triggering a new one', async () => {
    expect(cachedCurrentForSpot(RIVER_SPOT.id)).toBeUndefined();
    const fetchImpl = failingFetch();
    await fetchCurrentForSpot(RIVER_SPOT, { now: NOW, fetchImpl });
    expect(cachedCurrentForSpot(RIVER_SPOT.id)).toBeDefined();
    expect((fetchImpl as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  });
});
