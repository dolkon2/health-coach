/**
 * liveObservation.ts tests — the NWS-first/Synoptic-fallback combinator,
 * radius+staleness filtering, the 10-minute TTL cache (current.ts's own
 * shape), and the age-label formatter. Both source clients are jest-mocked
 * so this suite never depends on nwsClient/synopticClient's own network
 * behavior (covered in their own test files).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// liveObservation.ts reaches nwsClient/synopticClient through a static
// import chain (this file -> liveObservation.ts -> ./nwsClient), so the
// mock factory must not close over an outer `const mockX = jest.fn()` —
// under this project's babel/jest-hoist setup that variable is still
// `undefined` at the moment the factory runs (the factory executes when
// the FIRST static import pulls the module in, before this file's own
// top-level `const` statements have run). Mocking inline, then recovering
// the jest.fn() via jest.mocked() on the (now-mocked) real export, sidesteps
// the ordering issue entirely.
jest.mock('@/lib/conditions/nwsClient', () => ({ fetchNwsObservation: jest.fn() }));
jest.mock('@/lib/conditions/synopticClient', () => ({ fetchSynopticObservation: jest.fn() }));

import {
  fetchLiveObservationForSpot,
  observationAgeLabel,
  __clearLiveObservationCache,
  MAX_STATION_RADIUS_KM,
  STALE_READING_CUTOFF_MIN,
} from '@/lib/conditions/liveObservation';
import { fetchNwsObservation } from '@/lib/conditions/nwsClient';
import { fetchSynopticObservation } from '@/lib/conditions/synopticClient';
import type { Spot } from '@core/spot';

const mockFetchNws = jest.mocked(fetchNwsObservation);
const mockFetchSynoptic = jest.mocked(fetchSynopticObservation);

const NOW = Date.parse('2026-07-15T22:00:00Z');
const now = () => new Date(NOW);

function spot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'spot-1',
    name: 'Test Spot',
    kind: 'launch',
    lat: 45.7,
    lng: -121.5,
    ...overrides,
  };
}

function freshNws(overrides: Record<string, unknown> = {}) {
  return {
    stationId: '4S2',
    stationName: 'Hood River',
    distanceKm: 5,
    observedAtUtc: new Date(NOW - 3 * 60_000).toISOString(), // 3 min old
    windAvgKts: 12,
    windGustKts: 18,
    windDirectionDeg: 290,
    tempC: 22,
    ...overrides,
  };
}

beforeEach(() => {
  mockFetchNws.mockReset();
  mockFetchSynoptic.mockReset();
  __clearLiveObservationCache();
});

describe('fetchLiveObservationForSpot', () => {
  it('returns the NWS reading when it is within radius and fresh, never calling Synoptic', async () => {
    mockFetchNws.mockResolvedValue(freshNws());

    const out = await fetchLiveObservationForSpot(spot(), { now });

    expect(out).toEqual({
      source: 'nws',
      stationName: 'Hood River',
      distanceKm: 5,
      observedAtUtc: freshNws().observedAtUtc,
      windAvgKts: 12,
      windGustKts: 18,
      windDirectionDeg: 290,
      tempC: 22,
    });
    expect(mockFetchSynoptic).not.toHaveBeenCalled();
  });

  it('falls back to Synoptic when NWS is out of radius', async () => {
    mockFetchNws.mockResolvedValue(freshNws({ distanceKm: MAX_STATION_RADIUS_KM + 1 }));
    mockFetchSynoptic.mockResolvedValue({
      stationId: 'ODOT1',
      name: 'Rowena Summit',
      lat: 45.65,
      lng: -121.28,
      distanceKm: 10,
      observedAtUtc: new Date(NOW - 5 * 60_000).toISOString(),
      windAvgKts: 14,
    });

    const out = await fetchLiveObservationForSpot(spot(), { now });

    expect(out?.source).toBe('synoptic');
    expect(out?.stationName).toBe('Rowena Summit');
    expect(mockFetchSynoptic).toHaveBeenCalledTimes(1);
  });

  it('treats a slightly-future timestamp (device clock skew) as usable, not stale', async () => {
    // The device clock can run a few minutes behind true time; a station's
    // real-time-accurate timestamp then appears to be "in the future"
    // relative to now(). That must read as fresh, not get rejected.
    mockFetchNws.mockResolvedValue(freshNws({ observedAtUtc: new Date(NOW + 2 * 60_000).toISOString() }));

    const out = await fetchLiveObservationForSpot(spot(), { now });

    expect(out?.source).toBe('nws');
    expect(mockFetchSynoptic).not.toHaveBeenCalled();
  });

  it('falls back to Synoptic when the NWS reading is stale', async () => {
    mockFetchNws.mockResolvedValue(
      freshNws({ observedAtUtc: new Date(NOW - (STALE_READING_CUTOFF_MIN + 5) * 60_000).toISOString() })
    );
    mockFetchSynoptic.mockResolvedValue(null);

    const out = await fetchLiveObservationForSpot(spot(), { now });

    expect(out).toBeNull();
    expect(mockFetchSynoptic).toHaveBeenCalledTimes(1);
  });

  it('returns null when neither source has a usable station', async () => {
    mockFetchNws.mockResolvedValue(null);
    mockFetchSynoptic.mockResolvedValue(null);
    expect(await fetchLiveObservationForSpot(spot(), { now })).toBeNull();
  });

  it('never fetches for a spot with no coordinates', async () => {
    const out = await fetchLiveObservationForSpot(spot({ lat: undefined, lng: undefined }), { now });
    expect(out).toBeNull();
    expect(mockFetchNws).not.toHaveBeenCalled();
    expect(mockFetchSynoptic).not.toHaveBeenCalled();
  });

  it('caches for the TTL window — a second call within 10 min does not refetch', async () => {
    mockFetchNws.mockResolvedValue(freshNws());
    const s = spot();

    await fetchLiveObservationForSpot(s, { now });
    const laterButWithinTtl = () => new Date(NOW + 5 * 60_000);
    await fetchLiveObservationForSpot(s, { now: laterButWithinTtl });

    expect(mockFetchNws).toHaveBeenCalledTimes(1);
  });

  it('bypassCache forces a refetch even within the TTL window', async () => {
    mockFetchNws.mockResolvedValue(freshNws());
    const s = spot();

    await fetchLiveObservationForSpot(s, { now });
    await fetchLiveObservationForSpot(s, { now, bypassCache: true });

    expect(mockFetchNws).toHaveBeenCalledTimes(2);
  });

  it('refetches once the TTL window has passed', async () => {
    mockFetchNws.mockResolvedValue(freshNws());
    const s = spot();

    await fetchLiveObservationForSpot(s, { now });
    const afterTtl = () => new Date(NOW + 11 * 60_000);
    await fetchLiveObservationForSpot(s, { now: afterTtl });

    expect(mockFetchNws).toHaveBeenCalledTimes(2);
  });
});

describe('observationAgeLabel', () => {
  it('reads "just now" under a minute, "N min ago" under an hour, "Nh ago" beyond', () => {
    const t = Date.parse('2026-07-15T22:00:00Z');
    expect(observationAgeLabel(new Date(t - 20_000).toISOString(), t)).toBe('just now');
    expect(observationAgeLabel(new Date(t - 3 * 60_000).toISOString(), t)).toBe('3 min ago');
    expect(observationAgeLabel(new Date(t - 130 * 60_000).toISOString(), t)).toBe('2h ago');
  });
});
