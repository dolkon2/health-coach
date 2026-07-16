/**
 * config.ts — runtime config read from environment variables.
 *
 * Keys live in a gitignored `.env.local` (see `.env.example`) for local dev, and
 * as EAS environment variables for cloud builds. Anything prefixed
 * `EXPO_PUBLIC_` is inlined into the app at build time — so these are NOT secret
 * in a shipped binary; route Anthropic through a backend proxy before public
 * distribution. Keeping them out of `app.json`/git is the immediate win.
 *
 * USDA FoodData Central: free key (register at fdc.nal.usda.gov for 1000 req/hr).
 * Falls back to the public DEMO_KEY (~30 req/hr) so the app still works with no
 * key set. Open Food Facts: no key. Free-only food data layer (locked rule).
 *
 * Anthropic: optional. When set, the food logger's `described` parser runs
 * through Claude before resolving against USDA (multi-item meals, vague
 * portions). When unset, the regex parser handles it — the feature gracefully
 * degrades.
 *
 * MapTiler: optional. When a key is set, the GPS route map (RouteMap) renders
 * vector tiles under the recorded polyline; when unset, the map degrades to the
 * SVG route trace (RoutePreview) — nothing is fabricated, nothing is blocked.
 * MAP_STYLE_ID selects the tile style (defaults to `outdoor`). The style URL is
 * assembled here in code so the key/style never land in app.json or git.
 *
 * Synoptic/MesoWest (F2, forecast-tab.md §3): optional, free tier (5k req/mo).
 * When a token is set, the live-observation combinator (liveObservation.ts)
 * falls back to it for a broader station gap-fill (ODOT/WSDOT road stations,
 * etc.) when the free NWS client has nothing usable nearby; when unset, F2
 * degrades to NWS-only — never a blocked feature, same rule as MapTiler.
 *
 * Routing (Explore-2 route builder, routeSnap.ts): the snap-to-trail engine is
 * Valhalla. `EXPO_PUBLIC_ROUTING_URL` is the single swap point for the
 * "free-now → paid → self-host, never rewrite" path — unset it to use Stadia
 * Maps' hosted endpoint (needs `EXPO_PUBLIC_STADIA_API_KEY`, free non-commercial
 * tier); set it to a self-hosted Valhalla base URL (no key needed) when you
 * scale. With neither URL nor key, `valhallaRouteUrl()` is null and the builder
 * degrades to free-line — honest, never blocked (same rule as MapTiler). Overpass
 * (river-clip) is keyless and always available.
 */

export const USDA_API_KEY: string =
  process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';

export const ANTHROPIC_API_KEY: string | null =
  process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || null;

export const MAPTILER_KEY: string | null =
  process.env.EXPO_PUBLIC_MAPTILER_KEY || null;

export const MAP_STYLE_ID: string =
  process.env.EXPO_PUBLIC_MAP_STYLE_ID || 'outdoor';

export const SYNOPTIC_TOKEN: string | null =
  process.env.EXPO_PUBLIC_SYNOPTIC_TOKEN || null;

export const STADIA_API_KEY: string | null =
  process.env.EXPO_PUBLIC_STADIA_API_KEY || null;

/**
 * Base URL of a self-hosted (or otherwise custom) Valhalla instance. When set,
 * routing calls that URL and no key is used — the escape hatch that lets a
 * commercial launch move off Stadia's non-commercial free tier without touching
 * app code. Unset ⇒ Stadia's hosted endpoint (keyed). */
export const ROUTING_BASE_URL: string | null =
  process.env.EXPO_PUBLIC_ROUTING_URL || null;

/** Overpass API endpoint for the river-clip lookup — keyless public instance by
 *  default, overridable to a private mirror. Always non-null. */
export const OVERPASS_URL: string =
  process.env.EXPO_PUBLIC_OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

/** Shared key guard for every MapTiler endpoint — `null` with no key configured. */
function mapTilerUrl(path: string): string | null {
  if (!MAPTILER_KEY) return null;
  return `https://api.maptiler.com/${path}?key=${MAPTILER_KEY}`;
}

/**
 * MapTiler style URL for the route map, or `null` when no key is configured (the
 * caller falls back to the SVG trace). Never hardcodes or logs the key.
 */
export function mapStyleUrl(): string | null {
  return mapTilerUrl(`maps/${MAP_STYLE_ID}/style.json`);
}

/**
 * MapTiler terrain-RGB TileJSON URL for 3D terrain (P4-2), or `null` with no
 * key — rides the same MAPTILER_KEY as the base style rather than adding a
 * second keyed dependency; the caller degrades to the flat 2D style when null.
 */
export function mapTerrainTileUrl(): string | null {
  return mapTilerUrl('tiles/terrain-rgb-v2/tiles.json');
}

/**
 * MapTiler geocoding URL for `query`, or `null` with no key — the caller
 * (geocode.ts) falls back to Nominatim (free, no key), same "degrade
 * honestly, never block the feature" rule as every other MapTiler endpoint.
 */
export function mapGeocodeUrl(query: string): string | null {
  return mapTilerUrl(`geocoding/${encodeURIComponent(query)}.json`);
}

/**
 * Valhalla `/route` endpoint (a POST target), or `null` when no routing engine
 * is reachable — the caller (routeSnap.ts) then degrades to free-line. Prefers a
 * self-hosted `ROUTING_BASE_URL` (no key); otherwise Stadia's hosted endpoint
 * with the key appended; `null` when neither is configured. Never logs the key.
 */
export function valhallaRouteUrl(): string | null {
  if (ROUTING_BASE_URL) {
    return `${ROUTING_BASE_URL.replace(/\/+$/, '')}/route`;
  }
  if (!STADIA_API_KEY) return null;
  return `https://api.stadiamaps.com/route/v1?api_key=${STADIA_API_KEY}`;
}
