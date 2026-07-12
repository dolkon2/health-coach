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
