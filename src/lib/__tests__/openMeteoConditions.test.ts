/**
 * fetchConditionsSnapshot tests — MOCKED fetch, no live network. The wrapper
 * is thin by design (all logic is fixture-tested in core/conditions.test.ts):
 * here we prove the wiring — the built URL is what gets fetched, the snapshot
 * carries a minted id + the spot's id + a spot-local dateLocal, and a failed
 * request is a typed null, never an invented snapshot.
 */
import { describe, it, expect, jest } from '@jest/globals';
import type { Spot } from '@core/spot';
import type { OpenMeteoResponse } from '@core/conditions';
import { fetchConditionsSnapshot } from '@/lib/conditions/openMeteo';

const SPOT: Spot = {
  id: 'spot-1',
  name: 'Cliffside',
  lat: 45.6612,
  lng: -121.5498,
  kind: 'flying-site',
};

const RESPONSE: OpenMeteoResponse = {
  utc_offset_seconds: -25200, // PDT
  current: {
    time: '2026-07-05T14:15',
    temperature_2m: 23.9,
    wind_speed_10m: 4.4,
    wind_direction_10m: 282,
    wind_gusts_10m: 6.1,
    precipitation: 0,
  },
  hourly: {
    time: ['2026-07-05T14:00', '2026-07-05T15:00'],
    wind_speed_850hPa: [7.2, 7.9],
    wind_direction_850hPa: [305, 308],
    temperature_850hPa: [12.8, 13.1],
    wind_speed_700hPa: [11.4, null],
    wind_direction_700hPa: [320, null],
    temperature_700hPa: [4.1, null],
  },
};

function jsonFetch(body: unknown, ok = true) {
  return jest.fn(async (_url: unknown) => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  }));
}
const asFetch = (f: unknown) => f as unknown as typeof fetch;

describe('fetchConditionsSnapshot', () => {
  it('fetches the built Open-Meteo URL and returns a normalized snapshot', async () => {
    const fetchImpl = jsonFetch(RESPONSE);
    const at = new Date('2026-07-05T21:20:00Z');
    const snap = await fetchConditionsSnapshot(SPOT, at, { fetchImpl: asFetch(fetchImpl) });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain('latitude=45.6612');
    expect(url).toContain('longitude=-121.5498');
    expect(url).toContain('wind_speed_unit=ms');
    expect(url).toContain('timezone=auto');

    expect(snap).not.toBeNull();
    expect(snap!.spotId).toBe('spot-1');
    expect(snap!.capturedAt).toBe(at.toISOString());
    expect(snap!.source).toBe('open-meteo');
    expect(snap!.surface?.windSpeedMS).toBe(4.4);
    expect(snap!.aloft?.p850?.windDirDeg).toBe(305);
    expect(snap!.aloft?.p700?.tempC).toBe(4.1);
  });

  it('mints a uuid id per freeze', async () => {
    const deps = { fetchImpl: asFetch(jsonFetch(RESPONSE)) };
    const at = new Date('2026-07-05T21:20:00Z');
    const a = await fetchConditionsSnapshot(SPOT, at, deps);
    const b = await fetchConditionsSnapshot(SPOT, at, deps);
    expect(a!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(b!.id).not.toBe(a!.id);
  });

  it('dateLocal is the civil day at the SPOT, from the response offset', async () => {
    // 05:30Z on the 6th is 22:30 on the 5th in PDT — the freeze belongs to the 5th.
    const snap = await fetchConditionsSnapshot(SPOT, new Date('2026-07-06T05:30:00Z'), {
      fetchImpl: asFetch(jsonFetch(RESPONSE)),
    });
    expect(snap!.dateLocal).toBe('2026-07-05');
  });

  it('returns a typed null on a non-OK response — no snapshot is invented', async () => {
    const snap = await fetchConditionsSnapshot(SPOT, undefined, {
      fetchImpl: asFetch(jsonFetch({}, false)),
    });
    expect(snap).toBeNull();
  });
});
