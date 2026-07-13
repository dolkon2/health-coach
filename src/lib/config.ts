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
 */

export const USDA_API_KEY: string =
  process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';

export const ANTHROPIC_API_KEY: string | null =
  process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || null;

export const MAPTILER_KEY: string | null =
  process.env.EXPO_PUBLIC_MAPTILER_KEY || null;

export const MAP_STYLE_ID: string =
  process.env.EXPO_PUBLIC_MAP_STYLE_ID || 'outdoor';

/**
 * MapTiler style URL for the route map, or `null` when no key is configured (the
 * caller falls back to the SVG trace). Never hardcodes or logs the key.
 */
export function mapStyleUrl(): string | null {
  if (!MAPTILER_KEY) return null;
  return `https://api.maptiler.com/maps/${MAP_STYLE_ID}/style.json?key=${MAPTILER_KEY}`;
}

/**
 * MapTiler terrain-RGB TileJSON URL for 3D terrain (P4-2), or `null` with no
 * key — rides the same MAPTILER_KEY as the base style rather than adding a
 * second keyed dependency; the caller degrades to the flat 2D style when null.
 */
export function mapTerrainTileUrl(): string | null {
  if (!MAPTILER_KEY) return null;
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;
}
