/**
 * useTerrainMapStyle — resolves the MapLibre style RouteMap/MapSurface hand to
 * `Map`'s `mapStyle` prop, layering v11 terrain onto it when a DEM tile URL is
 * configured (mapTerrain.ts). Zero-arg: `mapStyleUrl()`/`mapTerrainTileUrl()`
 * are pure functions of a build-time env var, so they never change within a
 * session, and the hook reads them itself rather than making every caller
 * repeat the same three lines.
 *
 * Returns a settled value only — never swaps `mapStyle`'s identity out from
 * under an already-mounted `<Map>` (a live style reload resets MapLibre's
 * camera to the style's default world view, undoing the Camera `center`/
 * `zoom` the caller already applied). While the one-time style fetch is in
 * flight the caller sees `status: 'loading'` and should show its existing
 * honest placeholder/fallback instead of mounting `<Map>` — matching
 * map-tab.md §3's documented "map style → neutral skeleton" loading state.
 * Once settled, `terrainReady` is the single flag that governs both whether
 * the style's `terrain` field was set AND whether the caller should render
 * the matching `<RasterDEMSource>` (see `TerrainHillshade`) — they can never
 * disagree because they're driven by the same decision.
 *
 * Any fetch/parse failure (network hiccup, non-2xx, malformed JSON) settles
 * to the plain style URL string with `terrainReady: false` — terrain is
 * presentation-only polish, never a reason to blank the basemap. A later,
 * independent mount (e.g. revisiting the Map tab) retries, since the failure
 * is likely transient network state, not a permanent capability gap.
 *
 * The module-level cache/in-flight promise is keyed by nothing but "this
 * session" (styleUrl is constant), so every RouteMap/MapSurface instance —
 * including two that mount before the first fetch resolves — shares one
 * fetch and one settled result.
 */
import { useEffect, useState } from 'react';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { mapStyleUrl, mapTerrainTileUrl } from '@/lib/config';
import { withTerrain } from '@/lib/mapTerrain';

export type TerrainMapStyleState =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'ready'; mapStyle: string | StyleSpecification; terrainReady: boolean };

type Settled = { mapStyle: string | StyleSpecification; terrainReady: boolean };

/** Pure resolve step — exported for unit testing without React or a real fetch. */
export async function resolveTerrainStyle(
  styleUrl: string,
  terrainTileUrl: string | null,
  fetchImpl: typeof fetch
): Promise<Settled> {
  try {
    const res = await fetchImpl(styleUrl);
    if (!res.ok) throw new Error(`style fetch failed: ${res.status}`);
    const json = (await res.json()) as StyleSpecification;
    if (!terrainTileUrl) return { mapStyle: json, terrainReady: false };
    return { mapStyle: withTerrain(json), terrainReady: true };
  } catch {
    // Network hiccup, non-2xx (e.g. an expired key), or malformed JSON —
    // the plain style URL string still renders the flat 2D basemap.
    return { mapStyle: styleUrl, terrainReady: false };
  }
}

let cachedUrl: string | null = null;
let cached: Settled | null = null;
let inFlight: Promise<Settled> | null = null;

export function useTerrainMapStyle(deps?: { fetchImpl?: typeof fetch }): TerrainMapStyleState {
  const styleUrl = mapStyleUrl();
  const terrainTileUrl = mapTerrainTileUrl();
  const fetchImpl = deps?.fetchImpl ?? fetch;

  const [settled, setSettled] = useState<Settled | null>(
    styleUrl && cachedUrl === styleUrl ? cached : null
  );

  useEffect(() => {
    if (!styleUrl) return;
    if (cachedUrl === styleUrl && cached) {
      setSettled(cached);
      return;
    }
    let cancelled = false;
    if (cachedUrl !== styleUrl || !inFlight) {
      cachedUrl = styleUrl;
      inFlight = resolveTerrainStyle(styleUrl, terrainTileUrl, fetchImpl);
    }
    const thisFlight = inFlight;
    thisFlight.then((result) => {
      if (cancelled) return;
      if (result.terrainReady) {
        cached = result;
      } else {
        // A failed fetch degrades THIS mount honestly but isn't remembered —
        // a later independent mount gets a fresh attempt, since the failure
        // is transient network state, not a permanent capability gap (unlike
        // the native-module check, which caches even a negative result).
        cachedUrl = null;
      }
      setSettled(result);
    });
    return () => {
      cancelled = true;
    };
  }, [styleUrl, terrainTileUrl, fetchImpl]);

  if (!styleUrl) return { status: 'unavailable' };
  if (!settled) return { status: 'loading' };
  return { status: 'ready', mapStyle: settled.mapStyle, terrainReady: settled.terrainReady };
}
