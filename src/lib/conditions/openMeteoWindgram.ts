/**
 * openMeteoWindgram.ts — the F3 pressure-level fetch behind the Meteo panel's
 * windgram (forecast-tab.md §2a/§6). Takes a bare {lat, lng} like
 * openMeteoForecast.ts — a spot is just one caller that knows its own
 * coordinates.
 *
 * Model strategy: inside CONUS one call requests
 * `models=ncep_hrrr_conus,gfs_seamless` — every field comes back suffixed
 * per model, HRRR goes all-null past its run horizon, and the parser
 * attributes each hour to exactly one model (the chart draws the downgrade
 * boundary at `hrrrEndEpochSec`). Outside CONUS only `gfs_seamless` is
 * requested (bare field names). ECMWF is out of scope for v1 — GFS is
 * global, and a second fallback family would double the honesty surface
 * (per-hour attribution, run stamps) for no coverage gain.
 *
 * Model run time: the /v1/forecast body carries no init time, so a second
 * best-effort fetch reads `last_run_initialisation_time` from HRRR's static
 * meta endpoint. `gfs_seamless` is a virtual model with no meta.json, so a
 * GFS-only windgram has no run stamp — the chart shows "run n/a" rather
 * than a guessed time (absence over invention).
 *
 * forecast_days=4 (wxtofly's outlook). ⚑ The dual-model payload is already
 * ~120–180 KB; do not raise the horizon without re-checking size.
 *
 * Same contract as every conditions client: `windspeed_unit=kn` asserted by
 * the parser, `timeformat=unixtime&timezone=UTC`, any failure is a typed
 * null, never a throw, never a fabricated reading.
 */
import {
  WINDGRAM_LEVELS,
  isWithinConus,
  parseWindgramResponse,
  type WindgramSeries,
} from '@core/conditions/windgram';
import { fetchJson, type FetchJsonDeps } from './fetchJson';

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const HRRR_META_URL = 'https://api.open-meteo.com/data/ncep_hrrr_conus/static/meta.json';

const LEVEL_VARS = [
  'wind_speed',
  'wind_direction',
  'temperature',
  'relative_humidity',
  'cloud_cover',
  'geopotential_height',
] as const;

const SCALAR_VARS =
  'boundary_layer_height,cape,freezing_level_height,wind_speed_10m,wind_direction_10m';

const HOURLY_VARS =
  WINDGRAM_LEVELS.flatMap((p) => LEVEL_VARS.map((v) => `${v}_${p}hPa`)).join(',') +
  `,${SCALAR_VARS}`;

const PARAMS = 'windspeed_unit=kn&timeformat=unixtime&timezone=UTC&forecast_days=4';

/** Dual-model payloads are ~120–180 KB — the 4 s fetchJson default is too
 *  tight on a slow cell link. */
const WINDGRAM_TIMEOUT_MS = 8000;

/** What each branch actually requested — never a guess at what served it.
 *  HRRR's 3 km resolution is the model's published grid, stamped so the
 *  chart wears its resolution (forecast-tab.md honest-gap labeling). */
export const WINDGRAM_MODEL_LABEL_CONUS = 'HRRR 3 km + GFS';
export const WINDGRAM_MODEL_LABEL_GLOBAL = 'GFS';

export interface WindgramResult {
  series: WindgramSeries;
  model: string;
  /** HRRR run initialisation time; undefined when GFS-only or the meta
   *  fetch failed — the chart stamps "run n/a", never a guessed time. */
  runEpochSec?: number;
  fetchedAtUtc: string;
}

export type WindgramFetchDeps = FetchJsonDeps;

function runTimeFrom(meta: unknown): number | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const t = (meta as { last_run_initialisation_time?: unknown }).last_run_initialisation_time;
  return typeof t === 'number' && Number.isFinite(t) ? t : undefined;
}

/** Pressure-level windgram series at (lat, lng), 4 days out. Null on any
 *  failure — never a partial or fabricated forecast. */
export async function fetchWindgram(
  lat: number,
  lng: number,
  deps?: WindgramFetchDeps
): Promise<WindgramResult | null> {
  const conus = isWithinConus(lat, lng);
  const models = conus ? 'ncep_hrrr_conus,gfs_seamless' : 'gfs_seamless';
  const url =
    `${FORECAST_BASE}?latitude=${lat}&longitude=${lng}` +
    `&hourly=${HOURLY_VARS}&daily=sunrise,sunset&${PARAMS}&models=${models}`;

  const [body, meta] = await Promise.all([
    fetchJson(url, deps, WINDGRAM_TIMEOUT_MS),
    conus ? fetchJson(HRRR_META_URL, deps) : Promise.resolve(null),
  ]);

  const series = parseWindgramResponse(body);
  if (!series) return null;

  const result: WindgramResult = {
    series,
    model: conus ? WINDGRAM_MODEL_LABEL_CONUS : WINDGRAM_MODEL_LABEL_GLOBAL,
    fetchedAtUtc: new Date().toISOString(),
  };
  const runEpochSec = runTimeFrom(meta);
  if (runEpochSec !== undefined) result.runEpochSec = runEpochSec;
  return result;
}
