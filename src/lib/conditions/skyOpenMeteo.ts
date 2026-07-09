/**
 * openMeteo.ts — the network client core/src/conditions.ts sits behind.
 *
 * All I/O lives here, app-side; the URL and normalization stay in core
 * (openfoodfacts/usda split). Open-Meteo is keyless and free — no auth, no
 * cache layer: a freeze is taken once and persisted, never re-fetched.
 *
 * `fetchImpl` is injectable so tests run against a mocked fetch (no live
 * calls in CI). A failed request returns a typed `null`, never a fabricated
 * snapshot — matching getFoodByBarcode's honest miss.
 */
import type { Spot } from '@core/spot';
import {
  buildOpenMeteoUrl,
  normalizeOpenMeteo,
  openMeteoDateLocal,
  type SkyConditionsSnapshot,
  type OpenMeteoResponse,
} from '@core/skyConditions';
import { uuidv7 } from '@/lib/id';

export interface ConditionsDeps {
  fetchImpl?: typeof fetch;
}

/**
 * Freeze the conditions at a spot: fetch the Open-Meteo forecast and normalize
 * it into a SkyConditionsSnapshot captured at `at` (defaults to now). `dateLocal`
 * is the civil day at the SPOT, derived from the response's own UTC offset.
 * Null on network failure or a non-OK response — no snapshot is ever invented.
 */
export async function fetchSkyConditionsSnapshot(
  spot: Spot,
  at?: Date,
  deps?: ConditionsDeps
): Promise<SkyConditionsSnapshot | null> {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const capturedAt = (at ?? new Date()).toISOString();
  // Coords are optional on the merged Spot type (legacy Water spots predate
  // geocoding) — but a flying-site freeze is meaningless without them.
  if (spot.lat == null || spot.lng == null) return null;
  const res = await fetchImpl(buildOpenMeteoUrl(spot.lat, spot.lng));
  if (!res.ok) return null;
  const json = (await res.json()) as OpenMeteoResponse;
  return normalizeOpenMeteo(json, {
    id: uuidv7(),
    spotId: spot.id,
    capturedAt,
    dateLocal: openMeteoDateLocal(json, capturedAt),
  });
}
