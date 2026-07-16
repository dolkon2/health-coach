/**
 * conditions/windgram.ts — pure parser + physics for the Meteo panel's
 * windgram (F3, forecast-tab.md §2a/§6). Parses an Open-Meteo pressure-level
 * response fetched with `windspeed_unit=kn&timeformat=unixtime&timezone=UTC`,
 * optionally dual-model (`models=ncep_hrrr_conus,gfs_seamless`, every field
 * suffixed per model) or single-model (bare field names). Same honesty
 * contract as forecast.ts: wind is only read when the units block confirms
 * knots, holes stay holes, nothing is interpolated or fabricated.
 *
 * Model attribution is per-hour and never mixed: an hour is HRRR only when
 * HRRR carries a finite geopotential height at EVERY requested level;
 * otherwise the whole hour is built from GFS. `hrrrEndEpochSec` marks the
 * last HRRR hour so the chart can draw the model-downgrade boundary.
 */

/**
 * Pressure levels requested for the windgram, descending pressure =
 * ground up. Open-Meteo serves no 650 hPa level; 600 hPa (~4,200 m) covers
 * the "surface to ~650" intent. Verified 2026-07-16: ncep_hrrr_conus serves
 * all nine levels through /v1/forecast.
 */
export const WINDGRAM_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600] as const;

export type WindgramModel = 'hrrr' | 'gfs';

export interface WindgramLevel {
  pressureHpa: number;
  /** Geopotential height, metres ASL. */
  heightM?: number;
  windSpeedKts?: number;
  /** Meteorological convention: direction the wind blows FROM. */
  windDirectionDeg?: number;
  tempC?: number;
  rhPct?: number;
  cloudCoverPct?: number;
}

export interface WindgramHour {
  timeEpochSec: number;
  model: WindgramModel;
  /** Ordered like WINDGRAM_LEVELS: descending pressure, ground up. */
  levels: WindgramLevel[];
  /** Boundary-layer height, metres ABOVE GROUND — add grid elevation to plot. */
  blHeightM?: number;
  /** Freezing level, metres ASL. */
  freezingLevelM?: number;
  capeJkg?: number;
  surfaceWindKts?: number;
  surfaceWindDirDeg?: number;
}

export interface WindgramDayWindow {
  sunriseEpochSec: number;
  sunsetEpochSec: number;
}

export interface WindgramSeries {
  hours: WindgramHour[];
  days: WindgramDayWindow[];
  /** Open-Meteo grid-cell elevation, metres ASL — NOT the launch elevation. */
  gridElevationM?: number;
  /** Time of the last HRRR-built hour; undefined when single-model. */
  hrrrEndEpochSec?: number;
}

const HRRR_SUFFIX = 'ncep_hrrr_conus';
const GFS_SUFFIX = 'gfs_seamless';

const LEVEL_VARS = [
  'wind_speed',
  'wind_direction',
  'temperature',
  'relative_humidity',
  'cloud_cover',
  'geopotential_height',
] as const;

interface WindgramBody {
  error?: unknown;
  elevation?: unknown;
  hourly_units?: Record<string, unknown>;
  hourly?: Record<string, unknown> & { time?: unknown };
  daily?: Record<string, unknown> & { time?: unknown };
}

function asBody(json: unknown): WindgramBody | null {
  if (!json || typeof json !== 'object') return null;
  const body = json as WindgramBody;
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
 * Resolve a field for a model: dual-model responses suffix every field
 * (`temperature_850hPa_ncep_hrrr_conus`); single-model responses use bare
 * names. Suffixed wins so a dual-model body never silently reads the wrong
 * model through the bare fallback (bare and suffixed never coexist).
 */
function series(block: Record<string, unknown> | undefined, name: string, suffix: string): unknown {
  if (!block) return undefined;
  const suffixed = block[`${name}_${suffix}`];
  if (suffixed !== undefined) return suffixed;
  return block[name];
}

/**
 * Every wind_speed unit present must be knots — a km/h number silently read
 * as knots would be a fabricated wind (forecast.ts contract).
 */
function windUnitsOk(units: Record<string, unknown> | undefined): boolean {
  if (!units) return false;
  const windKeys = Object.keys(units).filter((k) => k.startsWith('wind_speed'));
  return windKeys.length > 0 && windKeys.every((k) => units[k] === 'kn');
}

function buildHour(
  hourly: Record<string, unknown>,
  i: number,
  timeEpochSec: number,
  model: WindgramModel,
  suffix: string,
  windOk: boolean,
): WindgramHour {
  const levels: WindgramLevel[] = WINDGRAM_LEVELS.map((pressureHpa) => {
    const level: WindgramLevel = { pressureHpa };
    const heightM = at(series(hourly, `geopotential_height_${pressureHpa}hPa`, suffix), i);
    if (heightM !== undefined) level.heightM = heightM;
    if (windOk) {
      const windSpeedKts = at(series(hourly, `wind_speed_${pressureHpa}hPa`, suffix), i);
      if (windSpeedKts !== undefined) level.windSpeedKts = windSpeedKts;
      const windDirectionDeg = at(series(hourly, `wind_direction_${pressureHpa}hPa`, suffix), i);
      if (windDirectionDeg !== undefined) level.windDirectionDeg = windDirectionDeg;
    }
    const tempC = at(series(hourly, `temperature_${pressureHpa}hPa`, suffix), i);
    if (tempC !== undefined) level.tempC = tempC;
    const rhPct = at(series(hourly, `relative_humidity_${pressureHpa}hPa`, suffix), i);
    if (rhPct !== undefined) level.rhPct = rhPct;
    const cloudCoverPct = at(series(hourly, `cloud_cover_${pressureHpa}hPa`, suffix), i);
    if (cloudCoverPct !== undefined) level.cloudCoverPct = cloudCoverPct;
    return level;
  });

  const hour: WindgramHour = { timeEpochSec, model, levels };
  const blHeightM = at(series(hourly, 'boundary_layer_height', suffix), i);
  if (blHeightM !== undefined) hour.blHeightM = blHeightM;
  const freezingLevelM = at(series(hourly, 'freezing_level_height', suffix), i);
  if (freezingLevelM !== undefined) hour.freezingLevelM = freezingLevelM;
  const capeJkg = at(series(hourly, 'cape', suffix), i);
  if (capeJkg !== undefined) hour.capeJkg = capeJkg;
  if (windOk) {
    const surfaceWindKts = at(series(hourly, 'wind_speed_10m', suffix), i);
    if (surfaceWindKts !== undefined) hour.surfaceWindKts = surfaceWindKts;
    const surfaceWindDirDeg = at(series(hourly, 'wind_direction_10m', suffix), i);
    if (surfaceWindDirDeg !== undefined) hour.surfaceWindDirDeg = surfaceWindDirDeg;
  }
  return hour;
}

/**
 * Parse a pressure-level forecast body into a WindgramSeries. Returns null
 * on a malformed body or when no hour parses — an all-empty response is a
 * miss, not an empty-but-valid windgram.
 */
export function parseWindgramResponse(json: unknown): WindgramSeries | null {
  const body = asBody(json);
  if (!body) return null;

  const hourly = body.hourly;
  const hTimes = hourly?.time;
  if (!hourly || !Array.isArray(hTimes)) return null;

  const windOk = windUnitsOk(body.hourly_units);
  const hasHrrr = Object.keys(hourly).some((k) => k.endsWith(`_${HRRR_SUFFIX}`));

  const hours: WindgramHour[] = [];
  let hrrrEndEpochSec: number | undefined;
  for (let i = 0; i < hTimes.length; i++) {
    const timeEpochSec = finite(hTimes[i]);
    if (timeEpochSec === undefined) continue;

    // HRRR only when it carries a height at every level; never mix models
    // within one hour.
    const hrrrComplete =
      hasHrrr &&
      WINDGRAM_LEVELS.every(
        (p) => at(hourly[`geopotential_height_${p}hPa_${HRRR_SUFFIX}`], i) !== undefined,
      );

    const hour = hrrrComplete
      ? buildHour(hourly, i, timeEpochSec, 'hrrr', HRRR_SUFFIX, windOk)
      : buildHour(hourly, i, timeEpochSec, 'gfs', GFS_SUFFIX, windOk);
    if (hrrrComplete) hrrrEndEpochSec = timeEpochSec;
    hours.push(hour);
  }
  if (hours.length === 0) return null;

  // Daily sunrise/sunset also arrive model-suffixed on dual-model responses
  // (values identical across models — it's astronomy, not forecast).
  const days: WindgramDayWindow[] = [];
  const daily = body.daily;
  const dTimes = daily?.time;
  if (daily && Array.isArray(dTimes)) {
    for (let i = 0; i < dTimes.length; i++) {
      const sunriseEpochSec =
        at(series(daily, 'sunrise', HRRR_SUFFIX), i) ?? at(series(daily, 'sunrise', GFS_SUFFIX), i);
      const sunsetEpochSec =
        at(series(daily, 'sunset', HRRR_SUFFIX), i) ?? at(series(daily, 'sunset', GFS_SUFFIX), i);
      if (sunriseEpochSec !== undefined && sunsetEpochSec !== undefined) {
        days.push({ sunriseEpochSec, sunsetEpochSec });
      }
    }
  }

  const result: WindgramSeries = { hours, days };
  const gridElevationM = finite(body.elevation);
  if (gridElevationM !== undefined) result.gridElevationM = gridElevationM;
  if (hasHrrr && hrrrEndEpochSec !== undefined) result.hrrrEndEpochSec = hrrrEndEpochSec;
  return result;
}

// ---------------------------------------------------------------------------
// Lapse-rate physics
// ---------------------------------------------------------------------------

export type LapseBucket = 'unstable' | 'conditional' | 'stable' | 'inverted';

/**
 * Environmental lapse rate between two adjacent levels, °C per km, positive
 * when temperature falls with height. Null when the layer has no thickness
 * (or inverted geometry) — a rate over Δh ≤ 0 would be fabricated.
 */
export function lapseRateCPerKm(
  lower: { tempC: number; heightM: number },
  upper: { tempC: number; heightM: number },
): number | null {
  const dHKm = (upper.heightM - lower.heightM) / 1000;
  if (!Number.isFinite(dHKm) || dHKm <= 0) return null;
  const rate = -(upper.tempC - lower.tempC) / dHKm;
  return Number.isFinite(rate) ? rate : null;
}

/**
 * ⚑ Tunable placeholders, not validated rules (same status as the GUST_*
 * thresholds in src/lib/forecastPanels.ts). Anchors: dry adiabatic ≈
 * 9.8 °C/km, moist adiabatic ≈ 6 °C/km. UNSTABLE uses 9.5 to give the DALR
 * a small tolerance.
 */
export const LAPSE_UNSTABLE_C_PER_KM = 9.5;
export const LAPSE_CONDITIONAL_C_PER_KM = 6.0;

/**
 * Classify an environmental lapse rate into the windgram's four shading
 * buckets: super-adiabatic → 'unstable', between moist and dry adiabatic →
 * 'conditional', cooling slower than moist adiabatic → 'stable', warming
 * with height → 'inverted'.
 */
export function lapseBucket(ratePerKm: number): LapseBucket {
  if (ratePerKm >= LAPSE_UNSTABLE_C_PER_KM) return 'unstable';
  if (ratePerKm >= LAPSE_CONDITIONAL_C_PER_KM) return 'conditional';
  if (ratePerKm >= 0) return 'stable';
  return 'inverted';
}

// ---------------------------------------------------------------------------
// Model eligibility
// ---------------------------------------------------------------------------

/**
 * Rough CONUS bounding box for HRRR eligibility. Deliberately generous —
 * a point just outside the true HRRR domain simply comes back all-null and
 * the parser attributes those hours to GFS.
 */
export function isWithinConus(lat: number, lng: number): boolean {
  return lat >= 21 && lat <= 53 && lng >= -134 && lng <= -60;
}
