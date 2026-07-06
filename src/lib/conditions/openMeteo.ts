/**
 * openMeteo.ts — hourly weather for a point + instant, frozen as tier-3
 * WeatherConditions (E3). Keyless, free for non-commercial use.
 *
 * Two hosts, one recency rule (live-verified 2026-07-05, dev-log ⚑ E-2 recon):
 *   - within FORECAST_MAX_PAST_DAYS (92) of now → forecast host with
 *     `past_days` (server allows 93; 92 is the documented safe max). This is
 *     the only host that serves `freezing_level_height`.
 *   - older → archive host (ERA5) with start_date/end_date, and
 *     freezing_level_height is NEVER requested there — the archive doesn't
 *     400 on it, it returns HTTP 200 with unit "undefined" and an all-null
 *     series. We also defensively drop any null slot on read, so even a
 *     silently unsupported variable can't land a fabricated value.
 *
 * Values are mapped from the hour nearest the session's start; a null in that
 * hour's slot → the key is simply absent (null ≠ 0, absence honest). Never
 * throws — any failure (network, HTTP error, empty body) returns null and the
 * session saves without weather (⚑ E-2).
 */
import { nearestHourIndex, type WeatherConditions } from '@core/conditions';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

/** Documented safe max for the forecast host's past_days (server enforces 93). */
export const FORECAST_MAX_PAST_DAYS = 92;

// Legacy variable names — valid on BOTH hosts (verified live; the modern
// wind_speed_10m aliases also work on forecast, but only these work everywhere).
const HOURLY_COMMON = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'snowfall',
  'windspeed_10m',
  'winddirection_10m',
  'cloudcover',
] as const;

interface OpenMeteoHourlyBody {
  error?: boolean;
  utc_offset_seconds?: number;
  hourly_units?: Record<string, string>;
  hourly?: Record<string, unknown> & { time?: string[] };
}

export interface WeatherFetchDeps {
  fetchImpl?: typeof fetch;
  /** Injectable clock: drives the host recency rule and fetchedAt. */
  now?: () => Date;
}

const DAY_MS = 86_400_000;

/**
 * Weather at (lat, lng) for the hour nearest `atIso`, or null. The host is
 * chosen by how far `atIso` sits behind now (whole UTC days): recent → the
 * forecast host (past_days, freezing level available), beyond 92 days → the
 * archive host (start_date/end_date, no freezing level — honestly absent).
 */
export async function fetchWeatherAt(
  point: { lat: number; lng: number; atIso: string },
  deps: WeatherFetchDeps = {}
): Promise<WeatherConditions | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const nowDate = deps.now?.() ?? new Date();
  const at = Date.parse(point.atIso);
  if (!Number.isFinite(at)) return null;

  // Whole-UTC-day distance between the session instant and today.
  const daysBack = Math.floor(nowDate.getTime() / DAY_MS) - Math.floor(at / DAY_MS);
  const loc = `latitude=${point.lat}&longitude=${point.lng}`;

  let url: string;
  if (daysBack <= FORECAST_MAX_PAST_DAYS) {
    // forecast_days=1 keeps the response to past days + today — the nearest
    // hour to a logged session is never in the future.
    const pastDays = Math.min(Math.max(daysBack, 0), FORECAST_MAX_PAST_DAYS);
    const vars = [...HOURLY_COMMON, 'freezing_level_height'].join(',');
    url = `${FORECAST_URL}?${loc}&hourly=${vars}&past_days=${pastDays}&forecast_days=1&timezone=UTC`;
  } else {
    const day = new Date(at).toISOString().slice(0, 10);
    // freezing_level_height deliberately NOT requested — see module doc.
    const vars = HOURLY_COMMON.join(',');
    url = `${ARCHIVE_URL}?${loc}&hourly=${vars}&start_date=${day}&end_date=${day}&timezone=UTC`;
  }

  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const body = (await res.json()) as OpenMeteoHourlyBody;
    const times = body?.hourly?.time;
    if (body?.error || !Array.isArray(times) || times.length === 0) return null;

    const idx = nearestHourIndex(times, point.atIso);
    if (idx < 0) return null;

    // A non-numeric (null / missing) slot → no reading, key absent.
    const read = (name: string): number | null => {
      const series = body.hourly?.[name];
      const v = Array.isArray(series) ? series[idx] : null;
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    };

    // Snowfall arrives in cm on both hosts (fixture-verified) — but trust the
    // declared unit: mm converts honestly, an unknown unit drops the reading
    // rather than mislabel it.
    const snowfallRaw = read('snowfall');
    const snowfallUnit = body.hourly_units?.snowfall;
    const snowfallCm =
      snowfallRaw == null
        ? null
        : snowfallUnit === 'cm'
          ? snowfallRaw
          : snowfallUnit === 'mm'
            ? snowfallRaw / 10
            : null;

    const readings: Partial<WeatherConditions> = {
      ...numEntry('tempC', read('temperature_2m')),
      ...numEntry('apparentTempC', read('apparent_temperature')),
      ...numEntry('precipMm', read('precipitation')),
      ...numEntry('snowfallCm', snowfallCm),
      ...numEntry('windSpeedKmh', read('windspeed_10m')),
      ...numEntry('windDirDeg', read('winddirection_10m')),
      ...numEntry('cloudCoverPct', read('cloudcover')),
      ...numEntry('freezingLevelM', read('freezing_level_height')),
    };
    // Nothing landed (e.g. an all-null archive row) → no snapshot at all.
    if (Object.keys(readings).length === 0) return null;

    return {
      tier: 3,
      source: 'open-meteo',
      fetchedAt: nowDate.toISOString(),
      ...readings,
      // With timezone=UTC the axis IS UTC (utc_offset_seconds 0), so adding
      // ":00Z" is honest normalization; anything else stays verbatim.
      modelHourUtc:
        body.utc_offset_seconds === 0 ? `${times[idx]}:00Z` : times[idx],
    };
  } catch {
    return null;
  }
}

function numEntry<K extends string>(key: K, v: number | null): Partial<Record<K, number>> {
  return v == null ? {} : ({ [key]: v } as Record<K, number>);
}
