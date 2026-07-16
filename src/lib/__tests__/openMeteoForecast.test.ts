/**
 * Forecast client tests — mocked fetch (no live network in CI), asserting:
 *   - the URL carries windspeed_unit=kn + timeformat=unixtime + timezone=UTC
 *     + both hourly= and daily= variable lists;
 *   - a successful body parses into hourly/daily points, stamped with the
 *     requested model label and a fetch timestamp;
 *   - any failure (non-2xx, thrown, empty body) folds to null, never a
 *     fabricated forecast.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { fetchForecast, FORECAST_MODEL_LABEL } from '@/lib/conditions/openMeteoForecast';

const asFetch = (f: unknown) => f as unknown as typeof fetch;

function jsonFetch(body: unknown, okFlag = true) {
  const urls: string[] = [];
  const impl = jest.fn(async (url: unknown) => {
    urls.push(String(url));
    return { ok: okFlag, status: okFlag ? 200 : 500, json: async () => body };
  });
  return { impl, urls };
}

const LAT = 45.714;
const LNG = -121.505;

describe('fetchForecast', () => {
  it('requests knots/unixtime/UTC and both hourly+daily variable lists', async () => {
    const { impl, urls } = jsonFetch({
      hourly_units: { wind_speed_10m: 'kn' },
      hourly: { time: [1783036800], wind_speed_10m: [11.4] },
      daily: { time: [1783036800], precipitation_sum: [0.2] },
    });

    await fetchForecast(LAT, LNG, { fetchImpl: asFetch(impl) });

    expect(impl).toHaveBeenCalledTimes(1);
    expect(urls[0]).toContain('api.open-meteo.com/v1/forecast');
    expect(urls[0]).toContain(`latitude=${LAT}`);
    expect(urls[0]).toContain(`longitude=${LNG}`);
    expect(urls[0]).toContain('windspeed_unit=kn');
    expect(urls[0]).toContain('timeformat=unixtime');
    expect(urls[0]).toContain('timezone=UTC');
    expect(urls[0]).toContain('hourly=wind_speed_10m');
    expect(urls[0]).toContain('daily=precipitation_probability_max');
  });

  it('parses a real body into hourly/daily points stamped with the model label', async () => {
    const { impl } = jsonFetch({
      hourly_units: { wind_speed_10m: 'kn' },
      hourly: {
        time: [1783036800],
        wind_speed_10m: [11.4],
        wind_gusts_10m: [20.0],
        precipitation_probability: [40],
      },
      daily: { time: [1783036800], precipitation_sum: [0.2] },
    });

    const out = await fetchForecast(LAT, LNG, { fetchImpl: asFetch(impl) });

    expect(out).toEqual({
      hourly: [
        {
          timeEpochSec: 1783036800,
          windSpeedKts: 11.4,
          windGustKts: 20.0,
          precipProbabilityPct: 40,
        },
      ],
      daily: [{ dateEpochSec: 1783036800, precipSumMm: 0.2 }],
      model: FORECAST_MODEL_LABEL,
      fetchedAtUtc: expect.any(String),
    });
  });

  it('returns null on a non-2xx response, never a fabricated forecast', async () => {
    const { impl } = jsonFetch({}, false);
    expect(await fetchForecast(LAT, LNG, { fetchImpl: asFetch(impl) })).toBeNull();
  });

  it('returns null when the fetch throws', async () => {
    const impl = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await fetchForecast(LAT, LNG, { fetchImpl: asFetch(impl) })).toBeNull();
  });

  it('returns null on an {error:true} body', async () => {
    const { impl } = jsonFetch({ error: true, reason: 'Invalid float' });
    expect(await fetchForecast(LAT, LNG, { fetchImpl: asFetch(impl) })).toBeNull();
  });
});
