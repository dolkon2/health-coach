/**
 * conditions/usgs.ts — pure parsers over the USGS Water Data OGC API
 * (GeoJSON FeatureCollections). No I/O here; the fetch wrapper lives in
 * `src/lib/conditions/usgsClient.ts` (the nutrition core/lib split).
 *
 * API quirks these parsers absorb (all fixture-proven, see `__fixtures__/`):
 *   - `properties.value` is a STRING (the API preserves precision) —
 *     parseFloat at the boundary, and a value that doesn't parse is DROPPED,
 *     never coerced to 0 (constitution: null ≠ 0).
 *   - a site publishes many parameters (turbidity, temperature, …) — we keep
 *     only discharge (00060) and gauge height (00065), instantaneous
 *     statistic (00011).
 *   - `numberReturned: 0` / missing `features` → empty array, not a throw.
 *   - bbox site searches include cooperator sites (`OR004-*`) that the
 *     latest-continuous collection cannot serve → filter to agency USGS.
 */
import type { GaugeReading } from './snapshot';

/** USGS parameter code → our reading discriminator. */
const PARAMETER_BY_CODE: Record<string, GaugeReading['parameter']> = {
  '00060': 'discharge',
  '00065': 'gaugeHeight',
};

/** Instantaneous-value statistic; daily means etc. are not session conditions. */
const INSTANTANEOUS_STATISTIC = '00011';

/**
 * A GaugeReading plus the per-reading provenance the OGC response carries.
 * Extends (never modifies) the locked snapshot type — the client hoists
 * `approvalStatus` onto the snapshot and drops the rest.
 */
export interface ParsedGaugeReading extends GaugeReading {
  /** 'Provisional' | 'Approved' — recent data is provisional per USGS policy. */
  approvalStatus?: string;
  /** USGS data qualifier (e.g. estimated, ice-affected); absent when null. */
  qualifier?: string;
}

/** One point of a time series (trend input). Value already parsed. */
export interface SeriesPoint {
  timeUtc: string;
  value: number;
}

/** A monitoring-location search hit the user can pick a home gauge from. */
export interface GaugeSite {
  /** Agency-prefixed feature id, e.g. 'USGS-14123500'. */
  siteId: string;
  name: string;
  /** Omitted when the feature has missing/null geometry (absent ≠ 0,0). */
  lat?: number;
  lng?: number;
}

interface OgcFeature {
  id?: unknown;
  properties?: Record<string, unknown> | null;
  geometry?: { type?: unknown; coordinates?: unknown } | null;
}

interface OgcFeatureCollection {
  features?: OgcFeature[] | null;
  numberReturned?: number;
}

function featuresOf(json: unknown): OgcFeature[] {
  const fc = json as OgcFeatureCollection | null | undefined;
  if (!fc || !Array.isArray(fc.features)) return [];
  return fc.features;
}

/** parseFloat with an honest miss: a non-numeric string yields undefined. */
function parseValue(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== 'string') return undefined;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? undefined : n;
}

/** Qualifier arrives as null, a string, or occasionally an array of strings. */
function parseQualifier(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw)) {
    const parts = raw.filter((q): q is string => typeof q === 'string' && q.length > 0);
    return parts.length > 0 ? parts.join(',') : undefined;
  }
  return undefined;
}

/**
 * Parse a latest-continuous (or bounded continuous) items response into
 * gauge readings. Keeps instantaneous (00011) discharge/gauge-height only;
 * unparseable values are dropped, not zeroed. Empty response → [].
 */
export function parseLatestReadings(json: unknown): ParsedGaugeReading[] {
  const readings: ParsedGaugeReading[] = [];
  for (const f of featuresOf(json)) {
    const p = f.properties;
    if (!p) continue;
    if (p.statistic_id !== INSTANTANEOUS_STATISTIC) continue;
    const parameter = PARAMETER_BY_CODE[String(p.parameter_code)];
    if (!parameter) continue;
    const value = parseValue(p.value);
    if (value === undefined) continue;
    if (typeof p.time !== 'string') continue;
    const approvalStatus = typeof p.approval_status === 'string' ? p.approval_status : undefined;
    const qualifier = parseQualifier(p.qualifier);
    readings.push({
      parameter,
      value,
      unit: typeof p.unit_of_measure === 'string' ? p.unit_of_measure : '',
      timeUtc: p.time,
      ...(approvalStatus !== undefined ? { approvalStatus } : {}),
      ...(qualifier !== undefined ? { qualifier } : {}),
    });
  }
  return readings;
}

/**
 * Parse a single-parameter series response (e.g. the 6h trend window,
 * fetched with `sortby=-time&properties=time,value`) into points sorted
 * OLDEST-FIRST — the API returns newest-first, and the trend computation
 * wants chronological endpoints. Client-side sort so the caller never
 * depends on server ordering. Unparseable values dropped.
 */
export function parseSeries(json: unknown): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const f of featuresOf(json)) {
    const p = f.properties;
    if (!p || typeof p.time !== 'string') continue;
    const value = parseValue(p.value);
    if (value === undefined) continue;
    points.push({ timeUtc: p.time, value });
  }
  return points.sort((a, b) => (a.timeUtc < b.timeUtc ? -1 : a.timeUtc > b.timeUtc ? 1 : 0));
}

/**
 * Parse a monitoring-locations search response into pickable sites.
 * FILTERS to `agency_code === 'USGS'`: bbox results include cooperator
 * sites (e.g. 'OR004-…') that the latest-continuous collection cannot
 * serve — offering one would be a dead-end pick. Missing/null geometry
 * yields a site without coordinates (absent means absent).
 */
export function parseSiteSearch(json: unknown): GaugeSite[] {
  const sites: GaugeSite[] = [];
  for (const f of featuresOf(json)) {
    const p = f.properties;
    if (!p || p.agency_code !== 'USGS') continue;
    if (typeof f.id !== 'string' || f.id.length === 0) continue;
    const name = typeof p.monitoring_location_name === 'string' ? p.monitoring_location_name : '';
    const coords = f.geometry?.coordinates;
    const hasCoords =
      Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number';
    sites.push({
      siteId: f.id,
      name,
      // GeoJSON order is [lng, lat].
      ...(hasCoords ? { lat: coords[1] as number, lng: coords[0] as number } : {}),
    });
  }
  return sites;
}
