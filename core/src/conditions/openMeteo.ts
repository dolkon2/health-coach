/**
 * conditions/openMeteo.ts — pure parsers over Open-Meteo wind/precip
 * responses. No I/O here; the fetch wrapper lives in
 * `src/lib/conditions/openMeteoClient.ts`.
 *
 * Contract with the client (fixture-proven, see `__fixtures__/`):
 *   - EVERY wind call is made with `windspeed_unit=kn` — the parsers ASSERT
 *     the response's `*_units` block says 'kn' and refuse to parse
 *     otherwise. A km/h number silently read as knots would be a fabricated
 *     wind; a typed null miss is honest.
 *   - EVERY call is made with `timeformat=unixtime&timezone=UTC`, so times
 *     are integer epochs (naive local ISO strings are a parsing footgun).
 *   - Error bodies come back as `{error: true, reason}` with HTTP 200 on
 *     some routes — rejected here.
 *   - Archive responses can carry null tail elements (ERA5 ingest delay) —
 *     every array element is null-checked; a null hour is a miss, never a 0.
 */

/** One wind observation, unit-verified knots, epoch time. */
export interface ParsedWind {
  timeEpochSec: number;
  speedKts: number;
  gustKts?: number;
  directionDeg?: number;
}

interface OpenMeteoBody {
  error?: unknown;
  current_units?: Record<string, unknown>;
  current?: Record<string, unknown>;
  hourly_units?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
}

function asBody(json: unknown): OpenMeteoBody | null {
  if (!json || typeof json !== 'object') return null;
  const body = json as OpenMeteoBody;
  // Open-Meteo signals bad requests as {error: true, reason: '...'}.
  if (body.error === true) return null;
  return body;
}

function finite(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** True when the units block declares knots for wind_speed_10m. */
function unitsAreKnots(units: Record<string, unknown> | undefined): boolean {
  return !!units && units.wind_speed_10m === 'kn';
}

/**
 * Parse a `current=` response fetched with `timeformat=unixtime`.
 * Requires epoch time, knots units, and a finite speed; gust/direction are
 * optional extras (omitted when absent). Null on anything else.
 */
export function parseCurrentWind(json: unknown): ParsedWind | null {
  const body = asBody(json);
  if (!body || !body.current) return null;
  if (!unitsAreKnots(body.current_units)) return null;

  const timeEpochSec = finite(body.current.time);
  const speedKts = finite(body.current.wind_speed_10m);
  if (timeEpochSec === undefined || speedKts === undefined) return null;

  const gustKts = finite(body.current.wind_gusts_10m);
  const directionDeg = finite(body.current.wind_direction_10m);
  return {
    timeEpochSec,
    speedKts,
    ...(gustKts !== undefined ? { gustKts } : {}),
    ...(directionDeg !== undefined ? { directionDeg } : {}),
  };
}

/**
 * Pick the hourly wind nearest `targetEpochSec` from a response fetched
 * with `timeformat=unixtime&timezone=UTC`. Times are hourly epochs, so the
 * index is integer math from the first timestamp (no date parsing), then
 * clamped to the array. A null speed at that hour (archive ingest tail) is
 * a typed null miss — we never substitute a neighboring hour's wind.
 */
export function pickHourlyWind(json: unknown, targetEpochSec: number): ParsedWind | null {
  const body = asBody(json);
  if (!body || !body.hourly) return null;
  if (!unitsAreKnots(body.hourly_units)) return null;

  const times = body.hourly.time;
  const speeds = body.hourly.wind_speed_10m;
  if (!Array.isArray(times) || !Array.isArray(speeds) || times.length === 0) return null;

  const t0 = finite(times[0]);
  if (t0 === undefined) return null;
  const idx = Math.min(times.length - 1, Math.max(0, Math.round((targetEpochSec - t0) / 3600)));

  const timeEpochSec = finite(times[idx]);
  const speedKts = finite(speeds[idx]);
  if (timeEpochSec === undefined || speedKts === undefined) return null;

  const gusts = body.hourly.wind_gusts_10m;
  const dirs = body.hourly.wind_direction_10m;
  const gustKts = Array.isArray(gusts) ? finite(gusts[idx]) : undefined;
  const directionDeg = Array.isArray(dirs) ? finite(dirs[idx]) : undefined;
  return {
    timeEpochSec,
    speedKts,
    ...(gustKts !== undefined ? { gustKts } : {}),
    ...(directionDeg !== undefined ? { directionDeg } : {}),
  };
}

/**
 * Sum the first `nDays` entries of `daily.precipitation_sum` (mm). Null-
 * tolerant means null-HONEST: if any of those days is null/missing (ERA5
 * delay tail), the total is unknowable and we return null — a 72h rain sum
 * with a silently dropped day would understate a flooding river.
 */
export function parsePrecipDaysSum(json: unknown, nDays: number): number | null {
  const body = asBody(json);
  if (!body || !body.daily) return null;
  const sums = body.daily.precipitation_sum;
  if (!Array.isArray(sums) || nDays <= 0 || sums.length < nDays) return null;

  let total = 0;
  for (let i = 0; i < nDays; i++) {
    const v = finite(sums[i]);
    if (v === undefined) return null;
    total += v;
  }
  return total;
}
