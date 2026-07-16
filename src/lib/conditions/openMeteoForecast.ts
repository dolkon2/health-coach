/**
 * openMeteoForecast.ts — the F1 hourly/daily forecast fetch (Spot Forecast
 * dashboard, forecast-tab.md §2a/§2b). Takes a bare {lat, lng}, never a
 * `Spot` — the ad-hoc map-tap sheet (F4) calls this exact same function
 * later; a spot is just one caller that already knows its own coordinates.
 *
 * Same contract as openMeteoClient.ts: `windspeed_unit=kn` (asserted by the
 * parser), `timeformat=unixtime&timezone=UTC`. No `models=` override is
 * requested, so Open-Meteo's default source-selection logic serves the
 * response — FORECAST_MODEL_LABEL is the honest label for exactly that. Any
 * failure is a typed null, never a throw, never a fabricated reading — the
 * same "quiet unavailable" rule current.ts already follows.
 */
import {
  parseForecastResponse,
  type HourlyForecastPoint,
  type DailyForecastPoint,
} from '@core/conditions/forecast';
import { fetchJson, type FetchJsonDeps } from './fetchJson';

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';

const HOURLY_VARS =
  'wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation_probability,precipitation,temperature_2m,apparent_temperature';
const DAILY_VARS =
  'precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min';
const PARAMS = 'windspeed_unit=kn&timeformat=unixtime&timezone=UTC&forecast_days=8';

/** The model label stamped on every forecast panel — what this fetch
 *  actually requested (no model override), never a guess at what served it. */
export const FORECAST_MODEL_LABEL = 'Open-Meteo (best-match)';

export interface ForecastResult {
  hourly: HourlyForecastPoint[];
  daily: DailyForecastPoint[];
  model: string;
  fetchedAtUtc: string;
}

export type ForecastFetchDeps = FetchJsonDeps;

/** Hourly + daily forecast at (lat, lng), ~8 days out. Null on any failure —
 *  never a partial or fabricated forecast. */
export async function fetchForecast(
  lat: number,
  lng: number,
  deps?: ForecastFetchDeps
): Promise<ForecastResult | null> {
  const url =
    `${FORECAST_BASE}?latitude=${lat}&longitude=${lng}` +
    `&hourly=${HOURLY_VARS}&daily=${DAILY_VARS}&${PARAMS}`;
  const parsed = parseForecastResponse(await fetchJson(url, deps));
  if (!parsed) return null;
  return {
    ...parsed,
    model: FORECAST_MODEL_LABEL,
    fetchedAtUtc: new Date().toISOString(),
  };
}
