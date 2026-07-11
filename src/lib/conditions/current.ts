/**
 * conditions/current.ts — the LIVE display path for Pinned Spots
 * (pinned-spots-spec.md "Live conditions layer"). Everything else in the
 * conditions clients is a backdate-correct FREEZE keyed on session time;
 * this is the one genuinely new piece — "what's it doing right now" for a
 * spot on the list/detail screens.
 *
 * Reuses the existing clients verbatim: gauge via fetchGaugeSnapshot's
 * ≤2h-recent branch (already resolves to latest-continuous), weather via
 * fetchWeatherAt. An in-memory TTL cache keyed by spot id avoids refetching
 * on every focus; pull-to-refresh bypasses it. NEVER writes to
 * conditions_snapshots or any session payload — those are freeze stores,
 * this module only ever reads.
 */
import type { GaugeSnapshot } from '@core/conditions/snapshot';
import type { WeatherConditions } from '@core/conditions';
import type { Spot } from '@core/spot';
import { fetchGaugeSnapshot } from './usgsClient';
import { fetchWeatherAt } from './openMeteo';

export type CurrentConditions = {
  weather: WeatherConditions | null;
  gauge: GaugeSnapshot | null;
  /** When this reading was fetched (fresh or served from cache). */
  fetchedAt: string;
};

const TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, CurrentConditions>();

function isFresh(entry: CurrentConditions, nowMs: number): boolean {
  return nowMs - Date.parse(entry.fetchedAt) < TTL_MS;
}

/**
 * Current conditions for a spot: weather always attempted (needs coords),
 * gauge only when `gaugeSiteId` is set. A cached reading younger than the
 * TTL is returned as-is unless `bypassCache` (pull-to-refresh). Both fetches
 * already fold every failure — network, timeout, offline — to `null`, so
 * this function itself never throws; a total failure just returns an
 * all-null snapshot stamped with the attempt time.
 */
export async function fetchCurrentForSpot(
  spot: Spot,
  opts: { bypassCache?: boolean; now?: () => Date; fetchImpl?: typeof fetch } = {}
): Promise<CurrentConditions> {
  const nowDate = opts.now?.() ?? new Date();
  const nowMs = nowDate.getTime();

  if (!opts.bypassCache) {
    const cached = cache.get(spot.id);
    if (cached && isFresh(cached, nowMs)) return cached;
  }

  const nowIso = nowDate.toISOString();
  const [weather, gauge] = await Promise.all([
    spot.lat != null && spot.lng != null
      ? fetchWeatherAt(
          { lat: spot.lat, lng: spot.lng, atIso: nowIso },
          { now: () => nowDate, fetchImpl: opts.fetchImpl }
        )
      : Promise.resolve(null),
    spot.gaugeSiteId
      ? fetchGaugeSnapshot(spot.gaugeSiteId, nowMs / 1000, { fetchImpl: opts.fetchImpl })
      : Promise.resolve(null),
  ]);

  const result: CurrentConditions = { weather, gauge, fetchedAt: nowIso };
  cache.set(spot.id, result);
  return result;
}

/** Last-cached reading for a spot without triggering a fetch — the "—" with
 *  a stamp state when offline/never-fetched (returns undefined then). */
export function cachedCurrentForSpot(spotId: string): CurrentConditions | undefined {
  return cache.get(spotId);
}

/**
 * Fetch current conditions for a list of spots and index the results by spot
 * id — the shared "list of spots → Record<id, reading>" step both the Spots
 * list (app/spots.tsx) and Home's glance module (useSpotsGlance) need, kept
 * in one place so a future change to how that batch is fetched (e.g.
 * per-spot error isolation) doesn't have to land in both call sites.
 */
export async function fetchCurrentForSpots(
  spots: Spot[],
  opts: { bypassCache?: boolean; now?: () => Date; fetchImpl?: typeof fetch } = {}
): Promise<Record<string, CurrentConditions>> {
  const entries = await Promise.all(
    spots.map(async (s) => [s.id, await fetchCurrentForSpot(s, opts)] as const)
  );
  return Object.fromEntries(entries);
}

/** Test-only: clear the module-level cache between cases. */
export function __clearCurrentConditionsCache(): void {
  cache.clear();
}
