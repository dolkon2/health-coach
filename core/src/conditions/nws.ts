/**
 * conditions/nws.ts — pure parsers over the NWS API (api.weather.gov, free,
 * no key), the F2 direct-observations client (forecast-tab.md §3, "Live
 * observations"). Three response shapes, chained by the network client
 * (nwsClient.ts): /points/{lat},{lng} → the gridpoint's observationStations
 * URL; that URL → a FeatureCollection of nearby stations; a chosen station's
 * /observations/latest → the reading itself.
 *
 * Unit honesty mirrors forecast.ts's windOk assert: wind fields only read
 * when `unitCode` names a unit this file knows how to convert to knots
 * (km/h or m/s — the two the API actually serves); an unrecognized unitCode
 * drops the field rather than mislabeling it. Temperature is degC-only for
 * the same reason. GeoJSON positions are [lng, lat] (core/geo.ts's own
 * documented flip point) — read that order explicitly, once, here.
 */

const KM_H_PER_KT = 1.852;
const M_S_PER_KT = 0.514444;

function kmhToKts(v: number): number {
  return v / KM_H_PER_KT;
}

function msToKts(v: number): number {
  return v / M_S_PER_KT;
}

interface QuantValue {
  unitCode?: unknown;
  value?: unknown;
}

function finite(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** A wind-speed-shaped quantity (windSpeed/windGust) converted to knots, or
 *  undefined when the value is missing or the unit isn't one this file can
 *  honestly convert. */
function windKts(q: QuantValue | undefined | null): number | undefined {
  const v = finite(q?.value);
  if (v === undefined) return undefined;
  if (q?.unitCode === 'wmoUnit:km_h-1') return kmhToKts(v);
  if (q?.unitCode === 'wmoUnit:m_s-1') return msToKts(v);
  return undefined;
}

function degCValue(q: QuantValue | undefined | null): number | undefined {
  const v = finite(q?.value);
  if (v === undefined) return undefined;
  return q?.unitCode === 'wmoUnit:degC' ? v : undefined;
}

/**
 * Extract the gridpoint's `observationStations` collection URL from a
 * `/points/{lat},{lng}` response. Null when the shape doesn't match (a bad
 * coordinate, an API error body, etc.) — the caller stops the chain there.
 */
export function parseNwsPointsStationsUrl(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const props = (json as { properties?: unknown }).properties;
  if (!props || typeof props !== 'object') return null;
  const url = (props as { observationStations?: unknown }).observationStations;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

export interface NwsStation {
  /** Short station identifier ('KHRI', '4S2', …) — what /observations/latest keys on. */
  stationId: string;
  name: string;
  lat: number;
  lng: number;
}

/** One feature of the observationStations FeatureCollection — cast once at
 *  the entry point (usgs.ts's OgcFeature precedent), read with plain
 *  optional chaining from there rather than re-litigating `typeof x ===
 *  'object'` at every nesting level. */
interface NwsStationFeature {
  properties?: { stationIdentifier?: unknown; name?: unknown } | null;
  geometry?: { coordinates?: unknown } | null;
}

/**
 * Parse the observationStations FeatureCollection into pickable stations.
 * A feature missing an identifier or a real Point geometry is dropped —
 * never guessed at with a 0,0 fallback.
 */
export function parseNwsStations(json: unknown): NwsStation[] {
  if (!json || typeof json !== 'object') return [];
  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];

  const stations: NwsStation[] = [];
  for (const f of features as NwsStationFeature[]) {
    const stationId = f?.properties?.stationIdentifier;
    if (typeof stationId !== 'string' || stationId.length === 0) continue;
    const name = typeof f.properties?.name === 'string' ? f.properties.name : stationId;

    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
      continue;
    }
    // GeoJSON order is [lng, lat].
    stations.push({ stationId, name, lat: coords[1], lng: coords[0] });
  }
  return stations;
}

export interface NwsObservation {
  observedAtUtc: string;
  windAvgKts?: number;
  windGustKts?: number;
  windDirectionDeg?: number;
  tempC?: number;
}

/**
 * Parse a `/stations/{id}/observations/latest` response. Null when there's
 * no usable timestamp (an observation with no `timestamp` isn't a reading
 * anyone can trust the age of). Every other field is independently
 * honest-miss: a present-but-null quantity (NWS reports `windGust: null`
 * constantly, e.g. a station that never gusts) drops that one field, never
 * zeroes it.
 */
export function parseNwsObservation(json: unknown): NwsObservation | null {
  if (!json || typeof json !== 'object') return null;
  const props = (json as { properties?: unknown }).properties;
  if (!props || typeof props !== 'object') return null;
  const p = props as Record<string, unknown>;

  const observedAtUtc = p.timestamp;
  if (typeof observedAtUtc !== 'string' || observedAtUtc.length === 0) return null;

  const windAvgKts = windKts(p.windSpeed as QuantValue | undefined);
  const windGustKts = windKts(p.windGust as QuantValue | undefined);
  const windDirDeg = finite((p.windDirection as QuantValue | undefined)?.value);
  const tempC = degCValue(p.temperature as QuantValue | undefined);

  return {
    observedAtUtc,
    ...(windAvgKts !== undefined ? { windAvgKts } : {}),
    ...(windGustKts !== undefined ? { windGustKts } : {}),
    ...(windDirDeg !== undefined ? { windDirectionDeg: windDirDeg } : {}),
    ...(tempC !== undefined ? { tempC } : {}),
  };
}
