/**
 * nwsClient.ts — the network client behind the pure NWS parsers
 * (forecast-tab.md §3 "Live observations", F2). Same shape as
 * usgsClient.ts: injectable fetch, every failure — network, timeout,
 * missing station, no observation — folds to a typed null, never a throw.
 *
 * Chains three api.weather.gov calls: /points/{lat},{lng} → the
 * gridpoint's observationStations collection URL → the nearest station
 * (haversine, not API ordering — this codebase's house rule, see
 * snotel.ts) → that station's /observations/latest. A User-Agent is
 * attached per NWS's own usage policy (identify your application); no key
 * is required.
 *
 * Single-nearest-station design (like usgsClient's single-site fetch,
 * not a cascading retry across the station list) — ⚑ if the nearest
 * station happens to be offline while a second-nearest one is reporting,
 * this degrades to "no live reading" rather than trying the next station.
 * Reasonable MVP scope; revisit if that proves common in practice.
 */
import { nearestTo } from '@core/geo';
import {
  parseNwsPointsStationsUrl,
  parseNwsStations,
  parseNwsObservation,
  type NwsObservation,
} from '@core/conditions/nws';
import { fetchJson, type FetchJsonDeps } from './fetchJson';

const BASE = 'https://api.weather.gov';

/** api.weather.gov asks every consumer to identify itself; this string is
 *  not a secret and carries no user data. */
const USER_AGENT = 'health-coach/1.0 (github.com/dolkon2/health-coach)';

export type NwsFetchDeps = FetchJsonDeps;

export interface NwsStationObservation extends NwsObservation {
  stationId: string;
  stationName: string;
  distanceKm: number;
}

/**
 * The nearest NWS-tracked station's latest observation for (lat, lng), or
 * null on any failure in the three-call chain (including "no stations
 * near this point" and "the nearest station has no current observation").
 */
export async function fetchNwsObservation(
  lat: number,
  lng: number,
  deps?: NwsFetchDeps
): Promise<NwsStationObservation | null> {
  const withHeaders: NwsFetchDeps = {
    ...deps,
    headers: { 'User-Agent': USER_AGENT, ...(deps?.headers ?? {}) },
  };

  const pointsUrl = `${BASE}/points/${lat.toFixed(4)},${lng.toFixed(4)}`;
  const stationsUrl = parseNwsPointsStationsUrl(await fetchJson(pointsUrl, withHeaders));
  if (!stationsUrl) return null;

  const stations = parseNwsStations(await fetchJson(stationsUrl, withHeaders));
  const nearest = nearestTo({ lat, lng }, stations);
  if (!nearest) return null;

  const obsUrl = `${BASE}/stations/${encodeURIComponent(nearest.item.stationId)}/observations/latest`;
  const observation = parseNwsObservation(await fetchJson(obsUrl, withHeaders));
  if (!observation) return null;

  return {
    ...observation,
    stationId: nearest.item.stationId,
    stationName: nearest.item.name,
    distanceKm: nearest.distanceKm,
  };
}
