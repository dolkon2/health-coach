/**
 * avalancheOrg.ts — the avalanche-forecast zone containing a point, frozen as
 * tier-3 AvalancheConditions (E3). avalanche.org v2, keyless.
 *
 * One GET of the public map-layer (a GeoJSON FeatureCollection of every US
 * forecast zone) + client-side point-in-polygon — the map layer alone carries
 * danger level/string, travel advice, off-season flag, and issue/expiry, which
 * is everything the freeze needs. The product endpoint (zone_id = the feature
 * id) exists for authoritative UTC timestamps and discussion text; it is
 * deliberately NOT called this pass — the map layer suffices for a frozen
 * context line, and one request per save is the whole budget.
 *
 * Honesty notes:
 * - `danger_level` -1 with `danger` "no rating" (off-season) flows through
 *   verbatim — a valid frozen fact, not a failure.
 * - Feature `start_date`/`end_date` are CENTER-LOCAL NAIVE strings
 *   ("2026-04-20T01:30:00", no zone suffix). They are kept verbatim as
 *   issuedAt/expiresAt — fabricating a "Z" would claim a precision the source
 *   didn't state. A forecast is frozen WITH its expiry so staleness stays
 *   visible forever.
 *
 * Never throws — any failure, or a point in no zone, returns null.
 */
import type { AvalancheConditions } from '@core/conditions';
import { pointInMultiPolygon } from '@core/geo';

const MAP_LAYER_URL = 'https://api.avalanche.org/v2/public/products/map-layer';

export interface AvalancheDeps {
  fetchImpl?: typeof fetch;
  /** Injectable clock for fetchedAt. */
  now?: () => Date;
}

interface MapLayerFeature {
  id?: number | string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    name?: string;
    center?: string;
    danger?: string;
    danger_level?: number;
    travel_advice?: string;
    off_season?: boolean;
    start_date?: string | null;
    end_date?: string | null;
    link?: string;
  };
}

/** The feature's rings as MultiPolygon coordinates — the map layer mixes
 * Polygon (64 zones) and MultiPolygon (17), so Polygon wraps to one entry. */
function asMultiPolygon(geometry: MapLayerFeature['geometry']): number[][][][] | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.type === 'Polygon') return [geometry.coordinates as number[][][]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as number[][][][];
  return null;
}

/**
 * The forecast zone whose polygon contains (lat, lng), mapped to frozen
 * AvalancheConditions — or null when no zone covers the point (most terrain;
 * zones exist only around the forecast centers) or the fetch failed.
 */
export async function fetchAvalancheAt(
  point: { lat: number; lng: number },
  deps: AvalancheDeps = {}
): Promise<AvalancheConditions | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(MAP_LAYER_URL);
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: MapLayerFeature[] };
    if (!Array.isArray(body?.features)) return null;

    for (const feature of body.features) {
      const polygons = asMultiPolygon(feature.geometry);
      if (!polygons || !pointInMultiPolygon(point.lat, point.lng, polygons)) continue;

      const p = feature.properties;
      const zoneId = typeof feature.id === 'number' ? feature.id : Number(feature.id);
      // A zone without its identity or rating fields isn't a mappable forecast —
      // skip it rather than freeze a half-invented record.
      if (
        !Number.isFinite(zoneId) ||
        typeof p?.name !== 'string' ||
        typeof p.danger !== 'string' ||
        typeof p.danger_level !== 'number'
      ) {
        continue;
      }

      return {
        tier: 3,
        source: 'avalanche.org',
        fetchedAt: (deps.now?.() ?? new Date()).toISOString(),
        zoneId,
        zoneName: p.name,
        center: typeof p.center === 'string' ? p.center : '',
        dangerLevel: p.danger_level,
        danger: p.danger,
        ...(typeof p.travel_advice === 'string' && p.travel_advice
          ? { travelAdvice: p.travel_advice }
          : {}),
        ...(typeof p.off_season === 'boolean' ? { offSeason: p.off_season } : {}),
        // Verbatim center-local naive strings — see module doc. null → absent.
        ...(typeof p.start_date === 'string' ? { issuedAt: p.start_date } : {}),
        ...(typeof p.end_date === 'string' ? { expiresAt: p.end_date } : {}),
        ...(typeof p.link === 'string' ? { link: p.link } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}
