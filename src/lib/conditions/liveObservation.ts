/**
 * liveObservation.ts — F2's combinator over the NWS and Synoptic clients
 * (forecast-tab.md §3), surfaced as a small "live reading" line beside the
 * matching Wind forecast panel — NEVER blended into the model line or vice
 * versa; two visually distinct registers, spot/[id].tsx keeps them in
 * separate props all the way to the DOM.
 *
 * NWS first (free, unlimited, no key) — Synoptic only as a fallback when
 * NWS has nothing usable within MAX_STATION_RADIUS_KM or fresh within
 * STALE_READING_CUTOFF_MIN (both ⚑ placeholders, same "flag a number,
 * don't invent a silent rule" convention as F1's gust thresholds). A
 * 10-minute TTL cache, same shape as current.ts, bounds both the Synoptic
 * free-tier budget (one lookup per spot view, cached) and needless NWS
 * refetching on every screen focus.
 *
 * "A stale reading is no data" (F2 scope): staleness is judged here, once,
 * for both sources — neither client judges its own freshness.
 */
import type { Spot } from '@core/spot';
import { fetchNwsObservation } from './nwsClient';
import { fetchSynopticObservation } from './synopticClient';
import { MAX_STATION_RADIUS_KM, STALE_READING_CUTOFF_MIN } from './observationThresholds';

export { MAX_STATION_RADIUS_KM, STALE_READING_CUTOFF_MIN };

const TTL_MS = 10 * 60 * 1000;

export type ObservationSource = 'nws' | 'synoptic';

export interface LiveObservation {
  source: ObservationSource;
  stationName: string;
  distanceKm: number;
  observedAtUtc: string;
  windAvgKts?: number;
  windGustKts?: number;
  /**
   * Neither NWS nor Synoptic's common variable set exposes a standard
   * minimum-wind-speed ("lull") field — this stays plumbed for the day a
   * specific network's lull variable is confirmed and wired into
   * synoptic.ts's parser (⚑), never fabricated by treating avg as a
   * stand-in. Always undefined this pass.
   */
  windLullKts?: number;
  windDirectionDeg?: number;
  tempC?: number;
}

interface StationCandidate {
  distanceKm: number;
  observedAtUtc: string;
}

/** Within radius AND fresh — the one place both honesty rules are applied,
 *  for either source, so a caller never has to re-derive them. A reading
 *  that appears to be slightly in the future (device clock drift/skew — a
 *  phone, not an NTP-disciplined server) is clamped to "just now" rather
 *  than rejected: the freshest possible readings are exactly the ones a
 *  strict >= 0 check would otherwise throw away. Same clamp
 *  observationAgeLabel already applies for display, kept in sync here. */
function isUsable<T extends StationCandidate>(candidate: T | null, nowMs: number): candidate is T {
  if (!candidate) return false;
  if (candidate.distanceKm > MAX_STATION_RADIUS_KM) return false;
  const rawAgeMin = (nowMs - Date.parse(candidate.observedAtUtc)) / 60_000;
  if (!Number.isFinite(rawAgeMin)) return false;
  const ageMin = Math.max(0, rawAgeMin);
  return ageMin <= STALE_READING_CUTOFF_MIN;
}

function windFields(c: {
  windAvgKts?: number;
  windGustKts?: number;
  windDirectionDeg?: number;
  tempC?: number;
}) {
  return {
    ...(c.windAvgKts !== undefined ? { windAvgKts: c.windAvgKts } : {}),
    ...(c.windGustKts !== undefined ? { windGustKts: c.windGustKts } : {}),
    ...(c.windDirectionDeg !== undefined ? { windDirectionDeg: c.windDirectionDeg } : {}),
    ...(c.tempC !== undefined ? { tempC: c.tempC } : {}),
  };
}

interface CacheEntry {
  value: LiveObservation | null;
  fetchedAtMs: number;
}

const cache = new Map<string, CacheEntry>();

export interface LiveObservationDeps {
  bypassCache?: boolean;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}

/**
 * The live station reading nearest a spot's coordinates — NWS first,
 * Synoptic only when NWS has nothing usable. Null when neither source has
 * a usable station (including a spot with no coordinates — no fetch
 * fired). Cached 10 minutes per spot id, same TTL as current.ts.
 */
export async function fetchLiveObservationForSpot(
  spot: Spot,
  opts: LiveObservationDeps = {}
): Promise<LiveObservation | null> {
  if (spot.lat == null || spot.lng == null) return null;

  const nowMs = (opts.now?.() ?? new Date()).getTime();

  if (!opts.bypassCache) {
    const cached = cache.get(spot.id);
    if (cached && nowMs - cached.fetchedAtMs < TTL_MS) return cached.value;
  }

  const deps = { fetchImpl: opts.fetchImpl };
  let result: LiveObservation | null = null;

  const nws = await fetchNwsObservation(spot.lat, spot.lng, deps);
  if (isUsable(nws, nowMs)) {
    result = {
      source: 'nws',
      stationName: nws.stationName,
      distanceKm: nws.distanceKm,
      observedAtUtc: nws.observedAtUtc,
      ...windFields(nws),
    };
  } else {
    const synoptic = await fetchSynopticObservation(spot.lat, spot.lng, deps);
    if (isUsable(synoptic, nowMs)) {
      result = {
        source: 'synoptic',
        stationName: synoptic.name,
        distanceKm: synoptic.distanceKm,
        observedAtUtc: synoptic.observedAtUtc,
        ...windFields(synoptic),
      };
    }
  }

  cache.set(spot.id, { value: result, fetchedAtMs: nowMs });
  return result;
}

/** "3 min ago" / "1h ago" — the reading-age stamp F2 requires always be
 *  visible beside a live reading. */
export function observationAgeLabel(observedAtUtc: string, nowMs: number): string {
  const ageMs = nowMs - Date.parse(observedAtUtc);
  const minutes = Math.max(0, Math.round(ageMs / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

/** Test-only: clear the module-level cache between cases. */
export function __clearLiveObservationCache(): void {
  cache.clear();
}
