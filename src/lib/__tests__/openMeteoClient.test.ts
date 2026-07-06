/**
 * Open-Meteo client tests — mocked fetch (no live network in CI), asserting:
 *   - EVERY wind URL carries windspeed_unit=kn + timeformat=unixtime +
 *     timezone=UTC; the unit assertion nulls a km/h response;
 *   - age cutover: ≤2h current=, ≤90d forecast start_date/end_date,
 *     older archive-api — source tags which model served the snapshot;
 *   - snapshot coords are the REQUESTED spot, not the grid-snapped echo;
 *   - precip: the exact 72 hours preceding the session instant, hourly
 *     unixtime/UTC (never civil-day buckets, never timezone=auto); null on
 *     any missing hour — never a partial sum.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fetchWindSnapshot, fetchPrecip72hMm } from '@/lib/conditions/openMeteoClient';

const FX = join(__dirname, '..', '..', '..', 'core', 'src', 'conditions', '__fixtures__');
function load<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

const asFetch = (f: unknown) => f as unknown as typeof fetch;

function jsonFetch(body: unknown, okFlag = true) {
  const urls: string[] = [];
  const impl = jest.fn(async (url: unknown) => {
    urls.push(String(url));
    return { ok: okFlag, status: okFlag ? 200 : 500, json: async () => body };
  });
  return { impl, urls };
}

const utcDate = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

const LAT = 45.714;
const LNG = -121.505;

describe('fetchWindSnapshot — recent (≤2h) current= path', () => {
  it('fetches current wind in knots/unixtime/UTC and keeps the REQUESTED coords', async () => {
    const when = Math.floor(Date.now() / 1000) - 600;
    const { impl, urls } = jsonFetch(load('om-current-unixtime.json'));

    const snap = await fetchWindSnapshot(LAT, LNG, when, { fetchImpl: asFetch(impl) });

    expect(snap).toEqual({
      lat: LAT, // NOT the response echo 45.70327
      lng: LNG,
      speedKts: 10.3,
      gustKts: 14.6,
      directionDeg: 289,
      observedAtUtc: '2026-07-05T23:00:00Z', // epoch 1783292400 → explicit Z
      fetchedAtUtc: expect.any(String),
      source: 'open-meteo-forecast',
    });

    expect(impl).toHaveBeenCalledTimes(1);
    expect(urls[0]).toContain('api.open-meteo.com/v1/forecast');
    expect(urls[0]).toContain('current=wind_speed_10m,wind_gusts_10m,wind_direction_10m');
    expect(urls[0]).toContain('windspeed_unit=kn');
    expect(urls[0]).toContain('timeformat=unixtime');
    expect(urls[0]).toContain('timezone=UTC');
    expect(urls[0]).toContain(`latitude=${LAT}`);
    expect(urls[0]).toContain(`longitude=${LNG}`);
  });
});

describe('fetchWindSnapshot — backdated ≤90d forecast path', () => {
  it('uses start_date/end_date hourly on the forecast API, tagged open-meteo-forecast', async () => {
    const when = Math.floor(Date.now() / 1000) - 5 * 86400;
    const { impl, urls } = jsonFetch(load('om-hourly-unixtime.json'));

    const snap = await fetchWindSnapshot(LAT, LNG, when, { fetchImpl: asFetch(impl) });

    expect(snap).not.toBeNull();
    expect(snap!.source).toBe('open-meteo-forecast');
    expect(urls[0]).toContain('api.open-meteo.com/v1/forecast');
    expect(urls[0]).not.toContain('archive-api');
    expect(urls[0]).not.toContain('current=');
    expect(urls[0]).toContain(`start_date=${utcDate(when)}`);
    expect(urls[0]).toContain(`end_date=${utcDate(when + 3600)}`);
    expect(urls[0]).toContain('hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m');
    expect(urls[0]).toContain('windspeed_unit=kn');
    expect(urls[0]).toContain('timeformat=unixtime');
    expect(urls[0]).toContain('timezone=UTC');
  });
});

describe('fetchWindSnapshot — >90d archive path', () => {
  it('switches to the archive API and tags the source open-meteo-archive', async () => {
    const when = Math.floor(Date.now() / 1000) - 100 * 86400;
    const { impl, urls } = jsonFetch(load('om-archive-hourly-unixtime.json'));

    const snap = await fetchWindSnapshot(LAT, LNG, when, { fetchImpl: asFetch(impl) });

    expect(snap).not.toBeNull();
    expect(snap!.source).toBe('open-meteo-archive');
    expect(urls[0]).toContain('archive-api.open-meteo.com/v1/archive');
    expect(urls[0]).toContain('windspeed_unit=kn');
    expect(urls[0]).toContain('timeformat=unixtime');
    expect(urls[0]).toContain('timezone=UTC');
  });
});

describe('fetchWindSnapshot — failure modes', () => {
  it('nulls on a response in the wrong unit — km/h read as knots is fabricated wind', async () => {
    const body = load<Record<string, unknown>>('om-current-unixtime.json');
    const { impl } = jsonFetch({
      ...body,
      current_units: { time: 'unixtime', wind_speed_10m: 'km/h' },
    });
    const when = Math.floor(Date.now() / 1000) - 600;
    expect(await fetchWindSnapshot(LAT, LNG, when, { fetchImpl: asFetch(impl) })).toBeNull();
  });

  it('nulls on {error:true} bodies, HTTP errors, and thrown fetches', async () => {
    const when = Math.floor(Date.now() / 1000) - 600;
    const errBody = jsonFetch({ error: true, reason: 'Invalid float' });
    expect(await fetchWindSnapshot(LAT, LNG, when, { fetchImpl: asFetch(errBody.impl) })).toBeNull();

    const http = jsonFetch({}, false);
    expect(await fetchWindSnapshot(LAT, LNG, when, { fetchImpl: asFetch(http.impl) })).toBeNull();

    const thrower = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await fetchWindSnapshot(LAT, LNG, when, { fetchImpl: asFetch(thrower) })).toBeNull();
  });

  it('nulls on a timeout (AbortController ~4s), never throws', async () => {
    jest.useFakeTimers();
    try {
      const impl = jest.fn(
        (_url: unknown, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          })
      );
      const p = fetchWindSnapshot(LAT, LNG, Math.floor(Date.now() / 1000), {
        fetchImpl: asFetch(impl),
      });
      await jest.advanceTimersByTimeAsync(5000);
      expect(await p).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

/** An hourly-precip body exactly covering [when−72h, when) with `mm` per hour. */
function hourlyPrecipBody(whenSec: number, mmPerHour: number | ((i: number) => number | null)) {
  const from = whenSec - 72 * 3600;
  const firstHour = Math.floor(from / 3600) * 3600;
  const time: number[] = [];
  const precipitation: Array<number | null> = [];
  // Pad an hour each side: the sum must window on epoch, not trust the span.
  for (let t = firstHour - 3600, i = 0; t < whenSec + 3600; t += 3600, i++) {
    time.push(t);
    precipitation.push(typeof mmPerHour === 'function' ? mmPerHour(i) : mmPerHour);
  }
  return { hourly_units: { precipitation: 'mm' }, hourly: { time, precipitation } };
}

describe('fetchPrecip72hMm — exact 72h window, hourly UTC epoch math', () => {
  it('requests hourly precipitation in unixtime/UTC spanning the window (never timezone=auto)', async () => {
    const when = Math.floor(Date.now() / 1000) - 2 * 86400;
    const { impl, urls } = jsonFetch(hourlyPrecipBody(when, 0.5));

    const mm = await fetchPrecip72hMm(LAT, LNG, when, { fetchImpl: asFetch(impl) });

    // 72 in-window hours × 0.5 mm — post-session hours in the body are EXCLUDED
    // (an evening paddle must not count that night's storm).
    expect(mm).toBeCloseTo(36);
    expect(urls[0]).toContain('api.open-meteo.com/v1/forecast');
    expect(urls[0]).toContain(`start_date=${utcDate(when - 72 * 3600)}`);
    expect(urls[0]).toContain(`end_date=${utcDate(when)}`);
    expect(urls[0]).toContain('hourly=precipitation');
    expect(urls[0]).toContain('timeformat=unixtime');
    expect(urls[0]).toContain('timezone=UTC');
    expect(urls[0]).not.toContain('timezone=auto'); // local civil-day buckets miscount evening sessions
    expect(urls[0]).not.toContain('daily=');
    expect(urls[0]).not.toContain('windspeed_unit'); // no wind vars on this call
  });

  it('cuts over to the archive API when the WINDOW START crosses 90 days', async () => {
    // Session 89 days ago: the window start (89d + 72h) is past the cutover.
    const when = Math.floor(Date.now() / 1000) - 89 * 86400;
    const { impl, urls } = jsonFetch(hourlyPrecipBody(when, 0.1));
    expect(await fetchPrecip72hMm(LAT, LNG, when, { fetchImpl: asFetch(impl) })).toBeCloseTo(7.2);
    expect(urls[0]).toContain('archive-api.open-meteo.com/v1/archive');
  });

  it('nulls when an in-window hour is missing — never a partial sum — and on fetch failure', async () => {
    const when = Math.floor(Date.now() / 1000);
    const gap = jsonFetch(hourlyPrecipBody(when, (i) => (i === 30 ? null : 0.2)));
    expect(await fetchPrecip72hMm(LAT, LNG, when, { fetchImpl: asFetch(gap.impl) })).toBeNull();

    const http = jsonFetch({}, false);
    expect(await fetchPrecip72hMm(LAT, LNG, when, { fetchImpl: asFetch(http.impl) })).toBeNull();
  });
});
