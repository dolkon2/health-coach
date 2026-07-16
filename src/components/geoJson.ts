/**
 * geoJson.ts — the render-boundary-only GeoJSON projection shared by every
 * MapLibre line layer (RouteMap's polyline, MapSurface's guide line). The
 * engine holds only point arrays; this is the one place a point path becomes
 * GeoJSON, never the stored shape (mapping-architecture-spec.md Layer 3).
 */
import type { LatLng } from '@core/geo';

/** A point path → a GeoJSON LineString FeatureCollection. */
export function toLineString(path: LatLng[]): object {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: path.map((p) => [p.lng, p.lat]),
        },
      },
    ],
  };
}

/**
 * Many point paths → one GeoJSON LineString FeatureCollection, each feature
 * carrying its caller-supplied properties (e.g. `{element: 'water'}`) so a
 * single Layer's data-driven paint expression can style every line by its
 * own feature — one native source/layer pair regardless of feature count
 * (My Map's routes/traces layers; map-tab.md REFRAME AMENDMENT).
 */
export function toMultiLineString(
  paths: ReadonlyArray<{ path: LatLng[]; properties: Record<string, string> }>
): object {
  return {
    type: 'FeatureCollection',
    features: paths.map(({ path, properties }) => ({
      type: 'Feature',
      properties,
      geometry: {
        type: 'LineString',
        coordinates: path.map((p) => [p.lng, p.lat]),
      },
    })),
  };
}
