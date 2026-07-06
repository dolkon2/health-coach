/**
 * The Proof — fetchWeatherAt freezes honest Open-Meteo values (E3), run
 * against the REAL captured responses (2026-07-05 recon), never live network:
 *   1. A recent instant → the FORECAST host with a computed past_days (capped
 *      92) + freezing_level_height, mapped from the hour nearest the session's
 *      start, units as declared (snowfall cm).
 *   2. An instant older than 92 days → the ARCHIVE host with
 *      start_date/end_date and freezing_level_height NEVER requested — and
 *      even when the archive smuggles in an all-null freezing series (its
 *      real HTTP-200 behavior), the key stays absent.
 *   3. A null in one hourly slot → that key absent, the rest mapped
 *      (null ≠ 0; absence honest).
 *   4. A declared snowfall unit of mm converts honestly; an unknown unit
 *      drops the reading rather than mislabel it.
 *   5. An HTTP 400 (the API's bogus-variable error body) → null, never a
 *      half-invented snapshot.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fetchWeatherAt } from '../openMeteo';

const FX = join(__dirname, '..', '__fixtures__');
const load = <T,>(name: string): T =>
  JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;

/** A fetch stub serving `body`, recording every URL it was asked for. */
function stubFetch(body: unknown, ok = true) {
  const urls: string[] = [];
  const fn = jest.fn(async (url: unknown) => {
    urls.push(String(url));
    return { ok, status: ok ? 200 : 400, json: async () => body };
  });
  return { fetchImpl: fn as unknown as typeof fetch, urls };
}

const MT_HOOD = { lat: 45.37, lng: -121.7 };
// Fixture forecast axis: 2026-07-02T00:00 … 2026-07-05T23:00 (96 h, UTC).
const RECENT = { ...MT_HOOD, atIso: '2026-07-03T14:20:00Z' };
const NOW_RECENT = () => new Date('2026-07-05T12:00:00Z');
// 118 days after the archive fixture's day — past the 92-day forecast window.
const OLD = { ...MT_HOOD, atIso: '2026-06-05T14:10:00Z' };
const NOW_OLD = () => new Date('2026-10-01T00:00:00Z');

describe('fetchWeatherAt — forecast host (recent instant)', () => {
  it('maps the nearest hour with full provenance and asks the right host', async () => {
    const { fetchImpl, urls } = stubFetch(load('openmeteo-forecast-past3.json'));
    const w = await fetchWeatherAt(RECENT, { fetchImpl, now: NOW_RECENT });

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('api.open-meteo.com/v1/forecast');
    expect(urls[0]).toContain('past_days=2'); // 2026-07-05 minus 2026-07-03
    expect(urls[0]).toContain('forecast_days=1');
    expect(urls[0]).toContain('freezing_level_height');
    expect(urls[0]).toContain('timezone=UTC');

    // 14:20 → nearest hour 14:00 (fixture index 38), every unit as declared.
    expect(w).toEqual({
      tier: 3,
      source: 'open-meteo',
      fetchedAt: '2026-07-05T12:00:00.000Z',
      tempC: 18.3,
      apparentTempC: 18.2,
      precipMm: 0,
      snowfallCm: 0,
      windSpeedKmh: 8.8,
      windDirDeg: 282,
      cloudCoverPct: 12,
      freezingLevelM: 3940,
      modelHourUtc: '2026-07-03T14:00:00Z',
    });
  });

  it('a null in one hourly slot → that key absent, the rest mapped', async () => {
    const body = load<{ hourly: Record<string, unknown[]> }>('openmeteo-forecast-past3.json');
    body.hourly.snowfall[38] = null;
    const { fetchImpl } = stubFetch(body);
    const w = await fetchWeatherAt(RECENT, { fetchImpl, now: NOW_RECENT });
    expect(w?.tempC).toBe(18.3);
    expect(w && 'snowfallCm' in w).toBe(false);
  });

  it('converts a declared mm snowfall honestly; drops an unknown unit', async () => {
    const mm = load<{ hourly_units: Record<string, string>; hourly: Record<string, unknown[]> }>(
      'openmeteo-forecast-past3.json'
    );
    mm.hourly_units.snowfall = 'mm';
    mm.hourly.snowfall[38] = 5;
    const a = await fetchWeatherAt(RECENT, { fetchImpl: stubFetch(mm).fetchImpl, now: NOW_RECENT });
    expect(a?.snowfallCm).toBe(0.5);

    const weird = load<{ hourly_units: Record<string, string> }>('openmeteo-forecast-past3.json');
    weird.hourly_units.snowfall = 'undefined';
    const b = await fetchWeatherAt(RECENT, {
      fetchImpl: stubFetch(weird).fetchImpl,
      now: NOW_RECENT,
    });
    expect(b && 'snowfallCm' in b).toBe(false);
    expect(b?.tempC).toBe(18.3);
  });
});

describe('fetchWeatherAt — archive host (older than 92 days)', () => {
  it('asks the archive with start/end dates and WITHOUT freezing_level_height', async () => {
    const { fetchImpl, urls } = stubFetch(load('openmeteo-archive-2026-06-05.json'));
    const w = await fetchWeatherAt(OLD, { fetchImpl, now: NOW_OLD });

    expect(urls[0]).toContain('archive-api.open-meteo.com/v1/archive');
    expect(urls[0]).toContain('start_date=2026-06-05');
    expect(urls[0]).toContain('end_date=2026-06-05');
    expect(urls[0]).not.toContain('freezing_level_height');

    expect(w?.tempC).toBe(12.2);
    expect(w?.windSpeedKmh).toBe(9.2);
    expect(w?.cloudCoverPct).toBe(45);
    expect(w && 'freezingLevelM' in w).toBe(false);
    expect(w?.modelHourUtc).toBe('2026-06-05T14:00:00Z');
  });

  it('the archive’s real all-null freezing series (HTTP 200!) never lands a value', async () => {
    // Captured live: unit "undefined", every slot null — the archive does not 400.
    const { fetchImpl } = stubFetch(load('openmeteo-archive-freezing-all-null.json'));
    const w = await fetchWeatherAt(OLD, { fetchImpl, now: NOW_OLD });
    expect(w?.tempC).toBe(12.2);
    expect(w && 'freezingLevelM' in w).toBe(false);
  });
});

describe('fetchWeatherAt — failure honesty', () => {
  it('an HTTP 400 error body → null', async () => {
    const { fetchImpl } = stubFetch(load('openmeteo-error-bogus-variable.json'), false);
    expect(await fetchWeatherAt(RECENT, { fetchImpl, now: NOW_RECENT })).toBeNull();
  });

  it('a thrown fetch → null, never a throw', async () => {
    const fetchImpl = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchWeatherAt(RECENT, { fetchImpl, now: NOW_RECENT })).toBeNull();
  });

  it('an unparsable atIso → null without fetching', async () => {
    const { fetchImpl, urls } = stubFetch({});
    expect(
      await fetchWeatherAt({ ...MT_HOOD, atIso: 'garbage' }, { fetchImpl, now: NOW_RECENT })
    ).toBeNull();
    expect(urls).toHaveLength(0);
  });
});
