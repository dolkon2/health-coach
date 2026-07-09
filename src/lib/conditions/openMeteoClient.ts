/**
 * openMeteoClient.ts — the network client the pure Open-Meteo parsers sit
 * behind (core/lib split per the Water contract §0.7). No key, no auth.
 *
 * BACKDATE-CORRECT: both functions take the SESSION time and fetch
 * conditions for THAT moment. Age cutover: within ~90 days the forecast
 * API serves past hours (start_date/end_date); older sessions read the
 * archive (ERA5) API. The two are different models that can disagree for
 * the same hour, so the snapshot's `source` records which one served it —
 * never mixed within one snapshot.
 *
 * EVERY wind call carries `windspeed_unit=kn` (the parsers assert the
 * response echoes 'kn') and `timeformat=unixtime&timezone=UTC` (times as
 * integer epochs — naive local ISO strings are a parsing footgun). A
 * failed fetch is a typed null, never a throw, never a now-reading.
 */
import type { WindSnapshot } from '@core/conditions/snapshot';
import {
  parseCurrentWind,
  pickHourlyWind,
  sumHourlyPrecip,
  type ParsedWind,
} from '@core/conditions/openMeteo';

const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive';

/** ≤ this many seconds ago counts as "now" → `current=` block is honest. */
const RECENT_CUTOFF_S = 2 * 3600;
/** Sessions older than this read the archive API instead of forecast-past. */
const ARCHIVE_CUTOVER_S = 90 * 86400;

const WIND_VARS = 'wind_speed_10m,wind_gusts_10m,wind_direction_10m';
const WIND_PARAMS = 'windspeed_unit=kn&timeformat=unixtime&timezone=UTC';

export interface ConditionsDeps {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/** Epoch seconds → explicit RFC3339 UTC ('...Z'), no fractional seconds. */
function epochToUtcIso(sec: number): string {
  return new Date(Math.round(sec) * 1000).toISOString().replace('.000Z', 'Z');
}

/** Epoch seconds → UTC civil date 'YYYY-MM-DD'. */
function utcDate(sec: number): string {
  return new Date(Math.round(sec) * 1000).toISOString().slice(0, 10);
}

/**
 * GET a JSON body with an AbortController timeout (~4s), chaining the
 * caller's signal (anthropicClient pattern). Any failure → null miss.
 */
async function fetchJson(url: string, deps?: ConditionsDeps, timeoutMs = 4000): Promise<unknown> {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  if (deps?.signal) {
    if (deps.signal.aborted) controller.abort();
    else deps.signal.addEventListener('abort', onAbort);
  }

  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (deps?.signal) deps.signal.removeEventListener('abort', onAbort);
  }
}

function toSnapshot(
  wind: ParsedWind,
  lat: number,
  lng: number,
  source: WindSnapshot['source']
): WindSnapshot {
  return {
    // The REQUESTED spot coords — never the model's grid-snapped echo.
    lat,
    lng,
    speedKts: wind.speedKts,
    ...(wind.gustKts !== undefined ? { gustKts: wind.gustKts } : {}),
    ...(wind.directionDeg !== undefined ? { directionDeg: wind.directionDeg } : {}),
    observedAtUtc: epochToUtcIso(wind.timeEpochSec),
    fetchedAtUtc: new Date().toISOString(),
    source,
  };
}

/**
 * Freeze the wind at (lat, lng) as it was at `whenUtcSec`.
 *
 * ≤2h old: the forecast API's `current=` block (15-min cadence).
 * ≤90d old: forecast API hourly for the session's UTC date (end date rolls
 * to the next day so a 23:30+ session can still round to midnight),
 * nearest hour picked. Older: archive API, same shape, source tagged
 * 'open-meteo-archive'. Any failure → null (manual entry is the fallback).
 */
export async function fetchWindSnapshot(
  lat: number,
  lng: number,
  whenUtcSec: number,
  deps?: ConditionsDeps
): Promise<WindSnapshot | null> {
  const nowSec = Date.now() / 1000;
  const ageS = nowSec - whenUtcSec;
  const at = `latitude=${lat}&longitude=${lng}`;

  if (ageS <= RECENT_CUTOFF_S) {
    const url = `${FORECAST_BASE}?${at}&current=${WIND_VARS}&${WIND_PARAMS}`;
    const wind = parseCurrentWind(await fetchJson(url, deps));
    return wind ? toSnapshot(wind, lat, lng, 'open-meteo-forecast') : null;
  }

  const useArchive = ageS > ARCHIVE_CUTOVER_S;
  const base = useArchive ? ARCHIVE_BASE : FORECAST_BASE;
  const dates = `start_date=${utcDate(whenUtcSec)}&end_date=${utcDate(whenUtcSec + 3600)}`;
  const url = `${base}?${at}&${dates}&hourly=${WIND_VARS}&${WIND_PARAMS}`;
  const wind = pickHourlyWind(await fetchJson(url, deps), whenUtcSec);
  return wind
    ? toSnapshot(wind, lat, lng, useArchive ? 'open-meteo-archive' : 'open-meteo-forecast')
    : null;
}

/**
 * Total rain (mm) over the EXACT 72 hours preceding the session instant at
 * (lat, lng) — "did it rain into this river lately". Hourly UTC epoch math
 * end to end: no civil-day buckets (which shift with timezone and, for any
 * evening session, would count that night's post-paddle storm), no
 * timezone=auto. The request dates span the window in UTC; the parser sums
 * only hours in [when−72h, when). Cutover keys on the WINDOW START — the
 * oldest hour needed decides forecast-past vs archive. Any missing hour →
 * null, never a partial sum.
 */
export async function fetchPrecip72hMm(
  lat: number,
  lng: number,
  whenUtcSec: number,
  deps?: ConditionsDeps
): Promise<number | null> {
  const fromSec = whenUtcSec - 72 * 3600;
  const nowSec = Date.now() / 1000;
  const useArchive = nowSec - fromSec > ARCHIVE_CUTOVER_S;
  const base = useArchive ? ARCHIVE_BASE : FORECAST_BASE;

  const url =
    `${base}?latitude=${lat}&longitude=${lng}` +
    `&start_date=${utcDate(fromSec)}&end_date=${utcDate(whenUtcSec)}` +
    `&hourly=precipitation&timeformat=unixtime&timezone=UTC`;
  return sumHourlyPrecip(await fetchJson(url, deps), fromSec, whenUtcSec);
}
