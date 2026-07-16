/**
 * synopticClient.ts — the network client behind the pure Synoptic parser
 * (forecast-tab.md §3, F2's broader-coverage gap-fill: ODOT/WSDOT road
 * stations and other networks NWS doesn't carry). Same shape as
 * usgsClient.ts: injectable fetch, every failure folds to a typed null.
 *
 * Missing token → null with NO fetch fired at all (mapTilerUrl's pattern in
 * config.ts) — both because there's nothing to authenticate with and because
 * that's the honest way to respect the free tier's 5k req/mo budget: no
 * token configured should cost zero requests, not fail loudly per attempt.
 * The `recent`/`radius`/`limit` params bound the query server-side; the
 * caller (liveObservation.ts) applies the app's own staleness/radius rules
 * on top rather than trusting the server-side bound alone.
 *
 * ⚑ Same live-verification gap as synoptic.ts: this session has no real
 * Synoptic token to test against, so the query param names (`radius`,
 * `recent`, `units`) are best-effort against the public v2 docs, not
 * confirmed live. Re-verify once Dylan has registered a token.
 */
import { nearestTo } from '@core/geo';
import { parseSynopticLatest, type SynopticStation } from '@core/conditions/synoptic';
import { SYNOPTIC_TOKEN } from '@/lib/config';
import { MAX_STATION_RADIUS_KM, STALE_READING_CUTOFF_MIN } from './observationThresholds';
import { fetchJson, type FetchJsonDeps } from './fetchJson';

const BASE = 'https://api.synopticdata.com/v2/stations/latest';

const KM_PER_MI = 1.60934;
/**
 * Search radius, miles — Synoptic's own `radius=lat,lng,miles` filter.
 * Derived from the SAME MAX_STATION_RADIUS_KM the app-level isUsable()
 * check applies (rounded up), not a second independent number — a station
 * this query never returns can never reach isUsable() at all, so the
 * server-side bound must always be >= the app's usable radius, never the
 * other way round.
 */
const SEARCH_RADIUS_MI = Math.ceil(MAX_STATION_RADIUS_KM / KM_PER_MI);
/**
 * Only consider stations that reported within this many minutes — a
 * server-side bound, deliberately a superset of STALE_READING_CUTOFF_MIN
 * (same reasoning as the radius above); liveObservation.ts's isUsable()
 * narrows it further for display.
 */
const RECENT_MIN = STALE_READING_CUTOFF_MIN + 30;
const STATION_LIMIT = 10;

export type SynopticFetchDeps = FetchJsonDeps;

export interface SynopticStationObservation extends SynopticStation {
  distanceKm: number;
}

/**
 * The nearest Synoptic-network station's latest observation for (lat, lng),
 * or null — including the honest null for "no token configured" (no fetch
 * attempted) and "nothing reported nearby within the recency window."
 */
export async function fetchSynopticObservation(
  lat: number,
  lng: number,
  deps?: SynopticFetchDeps
): Promise<SynopticStationObservation | null> {
  if (!SYNOPTIC_TOKEN) return null;

  const url =
    `${BASE}?radius=${lat},${lng},${SEARCH_RADIUS_MI}&limit=${STATION_LIMIT}` +
    `&recent=${RECENT_MIN}&units=speed|kts,temp|C` +
    `&vars=wind_speed,wind_gust,wind_direction,air_temp` +
    `&token=${encodeURIComponent(SYNOPTIC_TOKEN)}`;

  const stations = parseSynopticLatest(await fetchJson(url, deps));
  const nearest = nearestTo({ lat, lng }, stations);
  if (!nearest) return null;

  return { ...nearest.item, distanceKm: nearest.distanceKm };
}
