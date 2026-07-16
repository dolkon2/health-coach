/**
 * fetchWindgram tests — URL construction per CONUS branch (models param,
 * every pressure-level var, kn/unixtime/UTC/forecast_days=4, daily
 * sunrise/sunset), the best-effort HRRR run stamp (present, failed, and
 * never fetched outside CONUS), and the null fold on a failed forecast.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { WINDGRAM_LEVELS } from '@core/conditions/windgram';
import {
  fetchWindgram,
  WINDGRAM_MODEL_LABEL_CONUS,
  WINDGRAM_MODEL_LABEL_GLOBAL,
} from '../conditions/openMeteoWindgram';

const GORGE = { lat: 45.7, lng: -121.28 };
const ANNECY = { lat: 45.9, lng: 6.13 };

/** Minimal parseable single-model body (bare names, knots-declared). */
function gfsBody() {
  return {
    elevation: 500,
    hourly_units: { time: 'unixtime', wind_speed_850hPa: 'kn' },
    hourly: {
      time: [1784376000, 1784379600],
      geopotential_height_850hPa: [1500, 1500],
      wind_speed_850hPa: [10, 12],
    },
    daily: { time: [1784332800], sunrise: [1784361000], sunset: [1784416200] },
  };
}

/** A fetch stub routing by URL substring, recording every URL asked for. */
function stubFetch(routes: Array<{ match: string; body: unknown; ok?: boolean }>) {
  const urls: string[] = [];
  const fn = jest.fn(async (url: unknown) => {
    const u = String(url);
    urls.push(u);
    const route = routes.find((r) => u.includes(r.match));
    const ok = route?.ok ?? route !== undefined;
    return { ok, status: ok ? 200 : 404, json: async () => route?.body ?? null };
  });
  return { fetchImpl: fn as unknown as typeof fetch, urls };
}

describe('fetchWindgram — CONUS branch', () => {
  it('requests both models, every level var, and the HRRR run meta', async () => {
    const { fetchImpl, urls } = stubFetch([
      { match: '/v1/forecast', body: gfsBody() },
      { match: '/static/meta.json', body: { last_run_initialisation_time: 1784235600 } },
    ]);
    const out = await fetchWindgram(GORGE.lat, GORGE.lng, { fetchImpl });

    expect(out).not.toBeNull();
    expect(out!.model).toBe(WINDGRAM_MODEL_LABEL_CONUS);
    expect(out!.runEpochSec).toBe(1784235600);

    expect(urls).toHaveLength(2);
    const forecastUrl = urls.find((u) => u.includes('/v1/forecast'))!;
    const metaUrl = urls.find((u) => u.includes('meta.json'))!;
    expect(metaUrl).toBe('https://api.open-meteo.com/data/ncep_hrrr_conus/static/meta.json');

    expect(forecastUrl).toContain('models=ncep_hrrr_conus,gfs_seamless');
    expect(forecastUrl).toContain('windspeed_unit=kn');
    expect(forecastUrl).toContain('timeformat=unixtime');
    // timezone=auto: epochs stay absolute; the response carries the spot's
    // utc_offset_seconds for spot-local axis labels.
    expect(forecastUrl).toContain('timezone=auto');
    expect(forecastUrl).toContain('forecast_days=4');
    expect(forecastUrl).toContain('daily=sunrise,sunset');
    for (const p of WINDGRAM_LEVELS) {
      for (const v of [
        'wind_speed',
        'wind_direction',
        'temperature',
        'relative_humidity',
        'cloud_cover',
        'geopotential_height',
      ]) {
        expect(forecastUrl).toContain(`${v}_${p}hPa`);
      }
    }
    for (const s of [
      'boundary_layer_height',
      'cape',
      'freezing_level_height',
      'wind_speed_10m',
      'wind_direction_10m',
    ]) {
      expect(forecastUrl).toContain(s);
    }
  });

  it('still returns the windgram when the run-meta fetch fails', async () => {
    const { fetchImpl } = stubFetch([
      { match: '/v1/forecast', body: gfsBody() },
      { match: '/static/meta.json', body: null, ok: false },
    ]);
    const out = await fetchWindgram(GORGE.lat, GORGE.lng, { fetchImpl });
    expect(out).not.toBeNull();
    expect(out!.runEpochSec).toBeUndefined();
    expect(out!.series.gridElevationM).toBe(500);
  });
});

describe('fetchWindgram — global branch', () => {
  it('requests GFS only and never touches the meta endpoint', async () => {
    const { fetchImpl, urls } = stubFetch([{ match: '/v1/forecast', body: gfsBody() }]);
    const out = await fetchWindgram(ANNECY.lat, ANNECY.lng, { fetchImpl });

    expect(out).not.toBeNull();
    expect(out!.model).toBe(WINDGRAM_MODEL_LABEL_GLOBAL);
    expect(out!.runEpochSec).toBeUndefined();
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('models=gfs_seamless');
    expect(urls[0]).not.toContain('ncep_hrrr_conus');
  });
});

describe('fetchWindgram — failure folds', () => {
  it('returns null when the forecast fetch fails, even with good meta', async () => {
    const { fetchImpl } = stubFetch([
      { match: '/v1/forecast', body: null, ok: false },
      { match: '/static/meta.json', body: { last_run_initialisation_time: 1784235600 } },
    ]);
    expect(await fetchWindgram(GORGE.lat, GORGE.lng, { fetchImpl })).toBeNull();
  });

  it('returns null on an Open-Meteo error body', async () => {
    const { fetchImpl } = stubFetch([
      { match: '/v1/forecast', body: { error: true, reason: 'bad' } },
      { match: '/static/meta.json', body: {} },
    ]);
    expect(await fetchWindgram(GORGE.lat, GORGE.lng, { fetchImpl })).toBeNull();
  });
});
