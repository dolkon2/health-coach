/**
 * conditions/forecast.ts — pure parser for Open-Meteo hourly + daily
 * forecast responses (F1, forecast-tab.md §2a/§3). Same contract as
 * openMeteo.ts's wind parsers: `windspeed_unit=kn` is asserted before any
 * wind field is read, and every time is an integer epoch
 * (`timeformat=unixtime`). A hole in any array slot is an honest miss
 * (the field is simply absent from the point), never a fabricated or
 * interpolated value — this file only ever composes fields already present
 * in the response.
 */

export interface HourlyForecastPoint {
  timeEpochSec: number;
  windSpeedKts?: number;
  windGustKts?: number;
  windDirectionDeg?: number;
  precipProbabilityPct?: number;
  precipMm?: number;
  tempC?: number;
  apparentTempC?: number;
}

export interface DailyForecastPoint {
  /** Midnight UTC of that civil day. */
  dateEpochSec: number;
  precipProbabilityMaxPct?: number;
  precipSumMm?: number;
  tempMaxC?: number;
  tempMinC?: number;
}

export interface ParsedForecast {
  hourly: HourlyForecastPoint[];
  daily: DailyForecastPoint[];
}

interface ForecastBody {
  error?: unknown;
  hourly_units?: Record<string, unknown>;
  hourly?: Record<string, unknown> & { time?: unknown };
  daily?: Record<string, unknown> & { time?: unknown };
}

function asBody(json: unknown): ForecastBody | null {
  if (!json || typeof json !== 'object') return null;
  const body = json as ForecastBody;
  // Open-Meteo signals bad requests as {error: true, reason: '...'}.
  if (body.error === true) return null;
  return body;
}

function finite(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function at(series: unknown, i: number): number | undefined {
  return Array.isArray(series) ? finite(series[i]) : undefined;
}

/**
 * Parse an hourly+daily forecast body fetched with `windspeed_unit=kn` and
 * `timeformat=unixtime&timezone=UTC`. Wind fields are only read when the
 * units block confirms knots (a km/h number silently read as knots would be
 * a fabricated wind); non-wind fields have no comparable mislabel risk and
 * are read directly. Returns null when neither series carries anything —
 * an all-empty response is a miss, not an empty-but-valid forecast.
 */
export function parseForecastResponse(json: unknown): ParsedForecast | null {
  const body = asBody(json);
  if (!body) return null;

  const hourly: HourlyForecastPoint[] = [];
  const hTimes = body.hourly?.time;
  if (Array.isArray(hTimes)) {
    const windOk = body.hourly_units?.wind_speed_10m === 'kn';
    for (let i = 0; i < hTimes.length; i++) {
      const timeEpochSec = finite(hTimes[i]);
      if (timeEpochSec === undefined) continue;
      const point: HourlyForecastPoint = { timeEpochSec };
      if (windOk) {
        const windSpeedKts = at(body.hourly?.wind_speed_10m, i);
        if (windSpeedKts !== undefined) point.windSpeedKts = windSpeedKts;
        const windGustKts = at(body.hourly?.wind_gusts_10m, i);
        if (windGustKts !== undefined) point.windGustKts = windGustKts;
        const windDirectionDeg = at(body.hourly?.wind_direction_10m, i);
        if (windDirectionDeg !== undefined) point.windDirectionDeg = windDirectionDeg;
      }
      const precipProbabilityPct = at(body.hourly?.precipitation_probability, i);
      if (precipProbabilityPct !== undefined) point.precipProbabilityPct = precipProbabilityPct;
      const precipMm = at(body.hourly?.precipitation, i);
      if (precipMm !== undefined) point.precipMm = precipMm;
      const tempC = at(body.hourly?.temperature_2m, i);
      if (tempC !== undefined) point.tempC = tempC;
      const apparentTempC = at(body.hourly?.apparent_temperature, i);
      if (apparentTempC !== undefined) point.apparentTempC = apparentTempC;
      hourly.push(point);
    }
  }

  const daily: DailyForecastPoint[] = [];
  const dTimes = body.daily?.time;
  if (Array.isArray(dTimes)) {
    for (let i = 0; i < dTimes.length; i++) {
      const dateEpochSec = finite(dTimes[i]);
      if (dateEpochSec === undefined) continue;
      const point: DailyForecastPoint = { dateEpochSec };
      const precipProbabilityMaxPct = at(body.daily?.precipitation_probability_max, i);
      if (precipProbabilityMaxPct !== undefined) point.precipProbabilityMaxPct = precipProbabilityMaxPct;
      const precipSumMm = at(body.daily?.precipitation_sum, i);
      if (precipSumMm !== undefined) point.precipSumMm = precipSumMm;
      const tempMaxC = at(body.daily?.temperature_2m_max, i);
      if (tempMaxC !== undefined) point.tempMaxC = tempMaxC;
      const tempMinC = at(body.daily?.temperature_2m_min, i);
      if (tempMinC !== undefined) point.tempMinC = tempMinC;
      daily.push(point);
    }
  }

  if (hourly.length === 0 && daily.length === 0) return null;
  return { hourly, daily };
}
