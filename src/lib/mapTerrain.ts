/**
 * mapTerrain.ts — layers MapLibre v11 terrain onto an already-fetched MapTiler
 * style (RouteMap/MapSurface's "hero" 3D surfaces, P4-2 map-tab.md §3).
 * `terrain`/`sky` are style-level fields with no declarative component (unlike
 * sources/layers, which get added as ordinary `<RasterDEMSource>`/`<Layer>`
 * children the same way the route polyline already does) — the only way to
 * set them is inside the style object handed to `Map`'s `mapStyle` prop, so
 * the caller fetches the remote style JSON once (`useTerrainMapStyle`) and
 * passes it through here before rendering.
 *
 * Honest-gap note: this only adds visual 3D relief. No elevation number is
 * read off the DEM anywhere in this pass — if one ever is, it must carry the
 * `dem` provenance tag per mapping-architecture-spec.md, never presented as
 * measured.
 */
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

/** Must match the `id` given to the sibling `<RasterDEMSource>` element. */
export const TERRAIN_SOURCE_ID = 'terrain-dem';

/** MapTiler's terrain-RGB reads flat at the style-spec default (1) on most trail-grade slopes. */
export const TERRAIN_EXAGGERATION = 1.3;

/** Initial camera tilt on terrain-enabled surfaces; a two-finger drag still adjusts it (Map's `touchPitch` default). */
export const TERRAIN_CAMERA_PITCH = 45;

export function withTerrain(
  style: StyleSpecification,
  exaggeration: number = TERRAIN_EXAGGERATION
): StyleSpecification {
  return {
    ...style,
    terrain: { source: TERRAIN_SOURCE_ID, exaggeration },
    sky: {
      'sky-color': '#8ecae6',
      'horizon-color': '#e9f5f9',
      'fog-color': '#e9f5f9',
    },
  };
}
