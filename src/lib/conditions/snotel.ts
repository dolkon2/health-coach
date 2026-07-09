/**
 * snotel.ts — nearest SNOTEL station's daily snow readings, frozen as tier-1
 * SnowConditions (E3). NRCS AWDB REST v1, keyless.
 *
 * The stations endpoint has NO lat/lng/bbox/radius parameter (verified against
 * the OpenAPI spec, recon 2026-07-05) — so nearest-neighbor is client-side:
 * map the point to candidate SNOTEL states via a coarse padded bbox table,
 * fetch each state's whole network with the `*:XX:SNTL` wildcard (cheap,
 * ~36 KB/state), and haversine to the closest station. A point in no SNOTEL
 * state (the east coast) is an honest null — no fetch, no fabricated station.
 *
 * Data gotcha (fixture-verified): a station's `values` array can SKIP days
 * entirely — absent, not null. A skipped day → that key absent; a reported 0
 * (melt-out depth) is a real fact and lands as 0 (null ≠ 0).
 *
 * `distanceKm` rides on the snapshot so staleness-by-distance stays visible
 * (outdoor-integrations.md:127). Values stay in the network's native inches.
 * Never throws — any failure returns null and the session saves without snow.
 */
import type { SnowConditions } from '@core/conditions';
import { haversineKm } from '@core/geo';

const AWDB_BASE = 'https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1';

/**
 * Coarse bounding boxes of the states with SNOTEL networks (~900 stations,
 * western US + Alaska). Generous by design — candidates are only used to pick
 * which state networks to fetch; the haversine decides the actual station.
 */
const SNOTEL_STATE_BBOXES: Record<
  string,
  { minLat: number; maxLat: number; minLng: number; maxLng: number }
> = {
  AK: { minLat: 51.0, maxLat: 71.5, minLng: -170.0, maxLng: -129.0 },
  AZ: { minLat: 31.3, maxLat: 37.0, minLng: -114.9, maxLng: -109.0 },
  CA: { minLat: 32.5, maxLat: 42.0, minLng: -124.5, maxLng: -114.1 },
  CO: { minLat: 36.9, maxLat: 41.1, minLng: -109.1, maxLng: -102.0 },
  ID: { minLat: 42.0, maxLat: 49.0, minLng: -117.3, maxLng: -111.0 },
  MT: { minLat: 44.3, maxLat: 49.0, minLng: -116.1, maxLng: -104.0 },
  NV: { minLat: 35.0, maxLat: 42.0, minLng: -120.0, maxLng: -114.0 },
  NM: { minLat: 31.3, maxLat: 37.0, minLng: -109.1, maxLng: -103.0 },
  OR: { minLat: 42.0, maxLat: 46.3, minLng: -124.6, maxLng: -116.4 },
  SD: { minLat: 42.5, maxLat: 45.9, minLng: -104.1, maxLng: -96.4 },
  UT: { minLat: 37.0, maxLat: 42.0, minLng: -114.1, maxLng: -109.0 },
  WA: { minLat: 45.5, maxLat: 49.0, minLng: -124.8, maxLng: -116.9 },
  WY: { minLat: 41.0, maxLat: 45.0, minLng: -111.1, maxLng: -104.0 },
};

/** Padding around each state bbox — a trailhead just over a border still sees
 * the neighbor state's network. */
const BBOX_PAD_DEG = 0.5;

/** SNOTEL states whose (padded) bbox contains the point. [] → not SNOTEL country. */
export function snotelCandidateStates(lat: number, lng: number): string[] {
  return Object.entries(SNOTEL_STATE_BBOXES)
    .filter(
      ([, b]) =>
        lat >= b.minLat - BBOX_PAD_DEG &&
        lat <= b.maxLat + BBOX_PAD_DEG &&
        lng >= b.minLng - BBOX_PAD_DEG &&
        lng <= b.maxLng + BBOX_PAD_DEG
    )
    .map(([state]) => state);
}

export interface SnotelDeps {
  fetchImpl?: typeof fetch;
  /** Injectable clock for fetchedAt. */
  now?: () => Date;
}

interface AwdbStation {
  stationTriplet?: string;
  name?: string;
  elevation?: number;
  latitude?: number;
  longitude?: number;
}

export interface NearestSnotelStation {
  stationTriplet: string;
  name: string;
  distanceKm: number;
  elevationFt?: number;
}

/**
 * The active SNOTEL station nearest to (lat, lng), or null — including the
 * honest null for a point outside every SNOTEL state (no fetch fired at all).
 */
export async function findNearestSnotelStation(
  point: { lat: number; lng: number },
  deps: SnotelDeps = {}
): Promise<NearestSnotelStation | null> {
  const states = snotelCandidateStates(point.lat, point.lng);
  if (states.length === 0) return null;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const triplets = states.map((s) => `*:${s}:SNTL`).join(',');

  try {
    const res = await fetchImpl(
      `${AWDB_BASE}/stations?stationTriplets=${triplets}&activeOnly=true`
    );
    if (!res.ok) return null;
    const stations = (await res.json()) as AwdbStation[];
    if (!Array.isArray(stations)) return null;

    let best: NearestSnotelStation | null = null;
    for (const s of stations) {
      if (
        typeof s.stationTriplet !== 'string' ||
        typeof s.latitude !== 'number' ||
        typeof s.longitude !== 'number'
      ) {
        continue;
      }
      const distanceKm = haversineKm(point, { lat: s.latitude, lng: s.longitude });
      if (best === null || distanceKm < best.distanceKm) {
        best = {
          stationTriplet: s.stationTriplet,
          name: typeof s.name === 'string' ? s.name : s.stationTriplet,
          distanceKm,
          ...(typeof s.elevation === 'number' ? { elevationFt: s.elevation } : {}),
        };
      }
    }
    return best;
  } catch {
    return null;
  }
}

interface AwdbDataElement {
  stationElement?: { elementCode?: string };
  values?: Array<{ date?: string; value?: number }>;
}

export interface SnotelDayValues {
  sweIn?: number;
  depthIn?: number;
  precipSnowAdjIn?: number;
}

const ELEMENT_KEYS: Record<string, keyof SnotelDayValues> = {
  WTEQ: 'sweIn',
  SNWD: 'depthIn',
  PRCPSA: 'precipSnowAdjIn',
};

/**
 * The station's DAILY WTEQ/SNWD/PRCPSA readings for one civil day. A day the
 * station skipped (absent from `values` — never null there) → that key absent;
 * an empty object is a station that reported nothing for the date. Null only
 * on fetch failure.
 */
export async function fetchSnowAt(
  stationTriplet: string,
  dateLocal: string,
  deps: SnotelDeps = {}
): Promise<SnotelDayValues | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `${AWDB_BASE}/data?stationTriplets=${stationTriplet}&elements=WTEQ,SNWD,PRCPSA&duration=DAILY&beginDate=${dateLocal}&endDate=${dateLocal}`
    );
    if (!res.ok) return null;
    const body = (await res.json()) as Array<{
      stationTriplet?: string;
      data?: AwdbDataElement[];
    }>;
    if (!Array.isArray(body)) return null;
    const station = body.find((b) => b.stationTriplet === stationTriplet);
    const out: SnotelDayValues = {};
    for (const el of station?.data ?? []) {
      const key = ELEMENT_KEYS[el.stationElement?.elementCode ?? ''];
      if (!key) continue;
      const row = el.values?.find((v) => v.date === dateLocal);
      // 0 is a reading (melt-out), absence is not — only a present numeric lands.
      if (row && typeof row.value === 'number' && Number.isFinite(row.value)) {
        out[key] = row.value;
      }
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Compose: nearest station + that station's readings for the session's civil
 * day → SnowConditions, or null when there's no station in range, the fetch
 * failed, or the station reported nothing at all for the date (freezing a
 * station identity with zero readings would be noise, not context).
 */
export async function fetchSnotelConditions(
  point: { lat: number; lng: number; dateLocal: string },
  deps: SnotelDeps = {}
): Promise<SnowConditions | null> {
  const nearest = await findNearestSnotelStation(point, deps);
  if (!nearest) return null;
  const values = await fetchSnowAt(nearest.stationTriplet, point.dateLocal, deps);
  if (!values || Object.keys(values).length === 0) return null;
  return {
    tier: 1,
    source: `snotel:${nearest.stationTriplet}`,
    fetchedAt: (deps.now?.() ?? new Date()).toISOString(),
    stationTriplet: nearest.stationTriplet,
    stationName: nearest.name,
    // Rounded to 100 m — plenty for the staleness-by-distance note.
    distanceKm: Math.round(nearest.distanceKm * 10) / 10,
    ...(nearest.elevationFt != null ? { stationElevationFt: nearest.elevationFt } : {}),
    ...values,
    date: point.dateLocal,
  };
}
