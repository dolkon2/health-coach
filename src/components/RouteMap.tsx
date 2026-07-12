/**
 * RouteMap — the recorded GeoPoint[] drawn as a polyline over MapLibre tiles.
 *
 * The richer sibling of RoutePreview on the map-display ladder (gps-mapping-
 * spec.md): the engine still holds only the GeoPoint[] and renders no pixel —
 * this platform component projects the path to a GeoJSON LineString *at the
 * render boundary only* (never the stored shape) and hands it to MapLibre.
 *
 * Two honest degradations, never a fabricated line or an empty map frame:
 *  - No MapTiler key configured (mapStyleUrl() === null) → the SVG trace.
 *  - The native MapLibre module is absent — a dev build made before this pass,
 *    or the jest/node environment → the SVG trace.
 *
 * The native module is loaded with a lazy require() via the shared `loadMapLibre`
 * (mapLibre.ts) — @maplibre/maplibre-react-native imports react-native at module
 * load, so a static import would break tests and crash older dev builds. The
 * require runs only when RouteMap actually renders on-device, so importing this
 * file from anywhere is always safe.
 *
 * Pinned to @maplibre/maplibre-react-native v10 — its config plugin is compatible
 * with Expo SDK 53's @expo/config-plugins (v11 needs a newer Expo). v10's classic
 * API: MapView (mapStyle) / Camera (bounds) / ShapeSource (shape) / LineLayer
 * (camelCase style), exposed on the module's default aggregate export.
 */
import React from 'react';
import { View } from 'react-native';
import type { GeoPoint } from '@core/observation';
import { useTheme } from '@/theme';
import { mapStyleUrl } from '@/lib/config';
import { loadMapLibre, type LngLat } from './mapLibre';
import { RoutePreview } from './RoutePreview';

const SOURCE_ID = 'route-source';
const LAYER_ID = 'route-line';

/** GeoPoint[] → a GeoJSON LineString FeatureCollection (render-boundary only). */
function toLineString(path: GeoPoint[]): object {
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

type RouteMapProps = {
  path: GeoPoint[];
  height?: number;
};

export function RouteMap({ path, height = 220 }: RouteMapProps) {
  const theme = useTheme();
  const styleUrl = mapStyleUrl();

  // No key, or nothing drawable → the honest SVG trace still tells the truth.
  if (!styleUrl || path.length < 2) {
    return <RoutePreview path={path} height={height} />;
  }

  const MapLibre = loadMapLibre();
  if (!MapLibre) {
    // Native module absent (old dev build / jest) — fall back to the trace.
    return <RoutePreview path={path} height={height} />;
  }
  const { MapView, Camera, ShapeSource, LineLayer } = MapLibre;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of path) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  // A barely-moved route (a handful of near-identical fixes) has an almost-zero
  // bounding box; fitting the camera to it over-zooms past where tiles exist and
  // the map renders blank. Below ~65 m across, center on it at a sensible zoom.
  const tiny = maxLat - minLat < 0.0006 && maxLng - minLng < 0.0006;
  const cameraProps = tiny
    ? {
        centerCoordinate: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as LngLat,
        zoomLevel: 15,
      }
    : {
        bounds: {
          ne: [maxLng, maxLat] as LngLat,
          sw: [minLng, minLat] as LngLat,
          paddingTop: 28,
          paddingBottom: 28,
          paddingLeft: 28,
          paddingRight: 28,
        },
      };

  return (
    <View
      style={{
        height,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <MapView mapStyle={styleUrl} style={{ flex: 1 }}>
        <Camera {...cameraProps} animationDuration={0} />
        <ShapeSource id={SOURCE_ID} shape={toLineString(path)}>
          <LineLayer
            id={LAYER_ID}
            style={{
              lineColor: theme.colors.accent,
              lineWidth: 3,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      </MapView>
    </View>
  );
}
