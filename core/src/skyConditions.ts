/**
 * skyConditions.ts — Open-Meteo forecast → frozen SkyConditionsSnapshot (pure; renamed from Sky's conditions.ts at the 2026-07-09 merge — Earth's session-payload ConditionsSnapshot kept the plain name).
 *
 * A snapshot is a captured-at-the-time fact: what the air was doing at a spot
 * when the pilot froze it. It is never recomputed or overwritten later — the
 * storage layer is insert-only. The pressure levels are the wind-aloft numbers
 * pilots compare across days at a site: 850 hPa ≈ 1,500 m, 700 hPa ≈ 3,000 m.
 *
 * Mirrors the openfoodfacts/usda split: this module owns the URL and the
 * response normalization, fixture-tested with no live network; the fetch lives
 * app-side (src/lib/conditions/openMeteo.ts).
 *
 * Missing/null API fields stay ABSENT on the snapshot — a dropped sensor value
 * is unknown, never a fabricated 0 (calm air and missing data are different
 * facts).
 */

export type AloftLevel = {
  windSpeedMS?: number;
  windDirDeg?: number;
  tempC?: number;
};

export type SkyConditionsSnapshot = {
  id: string;
  spotId: string;
  capturedAt: string; // ISO instant the freeze was taken
  dateLocal: string; // 'YYYY-MM-DD' civil day at the SPOT (site history is per-day)
  source: 'open-meteo';
  surface?: {
    tempC?: number;
    windSpeedMS?: number;
    windDirDeg?: number;
    gustMS?: number;
    precipMm?: number;
  };
  aloft?: {
    p850?: AloftLevel; // ≈ 1,500 m
    p700?: AloftLevel; // ≈ 3,000 m
  };
};

/** The fields we read from an Open-Meteo `/v1/forecast` response (timezone=auto). */
export interface OpenMeteoResponse {
  /** Spot-local UTC offset; with timezone=auto all times below are spot-local. */
  utc_offset_seconds?: number;
  current?: {
    time?: string;
    temperature_2m?: number | null;
    wind_speed_10m?: number | null;
    wind_direction_10m?: number | null;
    wind_gusts_10m?: number | null;
    precipitation?: number | null;
  };
  hourly?: {
    time?: string[]; // spot-local 'YYYY-MM-DDTHH:mm', parallel to the arrays below
    temperature_2m?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_direction_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
    precipitation?: Array<number | null>;
    wind_speed_850hPa?: Array<number | null>;
    wind_direction_850hPa?: Array<number | null>;
    temperature_850hPa?: Array<number | null>;
    wind_speed_700hPa?: Array<number | null>;
    wind_direction_700hPa?: Array<number | null>;
    temperature_700hPa?: Array<number | null>;
  };
}

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

const CURRENT_VARS = [
  'temperature_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'precipitation',
];

const HOURLY_VARS = [
  ...CURRENT_VARS,
  'wind_speed_850hPa',
  'wind_direction_850hPa',
  'temperature_850hPa',
  'wind_speed_700hPa',
  'wind_direction_700hPa',
  'temperature_700hPa',
];

/**
 * The forecast URL for a spot: current + hourly surface vars, hourly pressure-
 * level vars (850/700 hPa are on the standard forecast endpoint), winds in m/s,
 * timezone=auto so times come back in the spot's own zone.
 */
export function buildOpenMeteoUrl(lat: number, lng: number): string {
  return (
    `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lng}` +
    `&current=${CURRENT_VARS.join(',')}` +
    `&hourly=${HOURLY_VARS.join(',')}` +
    `&wind_speed_unit=ms&timezone=auto`
  );
}

/** A finite number or undefined — nulls and NaN never become values. */
function num(v: number | null | undefined): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Parse a spot-local 'YYYY-MM-DDTHH:mm' hourly time to a true epoch (ms). */
function localTimeToEpoch(t: string, utcOffsetSeconds: number): number {
  const iso = t.length === 16 ? `${t}:00Z` : `${t}Z`;
  return Date.parse(iso) - utcOffsetSeconds * 1000;
}

/**
 * Nearest-hour rule: the index of the hourly.time entry closest to capturedAt
 * (absolute time distance, using utc_offset_seconds to place the spot-local
 * hour strings on the real timeline). A capture before the first hour snaps to
 * the first, after the last to the last; an exact half-way tie (e.g. :30:00)
 * goes to the EARLIER hour. Null when there are no parseable hours.
 */
function nearestHourIndex(
  times: string[],
  capturedAtIso: string,
  utcOffsetSeconds: number
): number | null {
  const target = Date.parse(capturedAtIso);
  if (!Number.isFinite(target)) return null;
  let best: number | null = null;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const epoch = localTimeToEpoch(times[i], utcOffsetSeconds);
    if (!Number.isFinite(epoch)) continue;
    const diff = Math.abs(epoch - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/** 'YYYY-MM-DD' at the spot for a capture instant, via the response's own offset. */
export function openMeteoDateLocal(json: OpenMeteoResponse, capturedAtIso: string): string {
  const offset = json.utc_offset_seconds ?? 0;
  return new Date(Date.parse(capturedAtIso) + offset * 1000).toISOString().slice(0, 10);
}

export type SnapshotMeta = {
  id: string;
  spotId: string;
  capturedAt: string;
  dateLocal: string;
};

type Surface = NonNullable<SkyConditionsSnapshot['surface']>;
type Aloft = NonNullable<SkyConditionsSnapshot['aloft']>;

/** A block with only its present fields, or undefined when every field is absent. */
function compact<T extends Record<string, number | undefined>>(block: T): T | undefined {
  const out = {} as T;
  let any = false;
  for (const k of Object.keys(block) as Array<keyof T>) {
    if (block[k] !== undefined) {
      out[k] = block[k];
      any = true;
    }
  }
  return any ? out : undefined;
}

/**
 * Normalize an Open-Meteo response into a frozen snapshot.
 *
 * Surface comes from the `current` block when present (it IS the conditions at
 * capture time); when the response carries no current block it falls back to
 * the nearest hour. Aloft always comes from the hourly arrays (pressure-level
 * vars are hourly-only), at the hour nearest capturedAt — see nearestHourIndex
 * for the tie/boundary rule. Absent or null API fields stay absent.
 */
export function normalizeOpenMeteo(
  json: OpenMeteoResponse,
  meta: SnapshotMeta
): SkyConditionsSnapshot {
  const snapshot: SkyConditionsSnapshot = { ...meta, source: 'open-meteo' };

  const hourly = json.hourly;
  const offset = json.utc_offset_seconds ?? 0;
  const idx =
    hourly?.time && hourly.time.length > 0
      ? nearestHourIndex(hourly.time, meta.capturedAt, offset)
      : null;
  const at = (arr: Array<number | null> | undefined): number | undefined =>
    idx == null ? undefined : num(arr?.[idx]);

  const surface: Surface | undefined = json.current
    ? compact<Surface>({
        tempC: num(json.current.temperature_2m),
        windSpeedMS: num(json.current.wind_speed_10m),
        windDirDeg: num(json.current.wind_direction_10m),
        gustMS: num(json.current.wind_gusts_10m),
        precipMm: num(json.current.precipitation),
      })
    : compact<Surface>({
        tempC: at(hourly?.temperature_2m),
        windSpeedMS: at(hourly?.wind_speed_10m),
        windDirDeg: at(hourly?.wind_direction_10m),
        gustMS: at(hourly?.wind_gusts_10m),
        precipMm: at(hourly?.precipitation),
      });
  if (surface) snapshot.surface = surface;

  const p850 = compact<AloftLevel>({
    windSpeedMS: at(hourly?.wind_speed_850hPa),
    windDirDeg: at(hourly?.wind_direction_850hPa),
    tempC: at(hourly?.temperature_850hPa),
  });
  const p700 = compact<AloftLevel>({
    windSpeedMS: at(hourly?.wind_speed_700hPa),
    windDirDeg: at(hourly?.wind_direction_700hPa),
    tempC: at(hourly?.temperature_700hPa),
  });
  if (p850 || p700) {
    const aloft: Aloft = {};
    if (p850) aloft.p850 = p850;
    if (p700) aloft.p700 = p700;
    snapshot.aloft = aloft;
  }

  return snapshot;
}
