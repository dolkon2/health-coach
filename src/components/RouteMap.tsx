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
 * The native module is loaded with a lazy require() (mirrors healthkit/index.ts
 * and useGpsTracker): @maplibre/maplibre-react-native imports react-native at
 * module load, so a static import would break tests and crash older dev builds.
 * require() runs only when RouteMap actually renders on-device, so importing
 * this file from anywhere is always safe.
 */
import React from 'react';
import type { ComponentType, ReactNode } from 'react';
import { View } from 'react-native';
import type { GeoPoint } from '@core/observation';
import { useTheme } from '@/theme';
import { mapStyleUrl } from '@/lib/config';
import { RoutePreview } from './RoutePreview';

// ── Thin typed adapter over the four MapLibre pieces we use ───────────────────
// Types only the props we pass, verified against the package's d.ts (v11):
// Map.mapStyle, Camera.bounds, GeoJSONSource.data, Layer.type/paint/layout. The
// native render is validated by the human's prebuild + visual check, not tsc.
type LngLat = [number, number];
type MapLibreModule = {
  Map: ComponentType<{
    mapStyle: string;
    style?: object;
    children?: ReactNode;
  }>;
  Camera: ComponentType<{
    bounds?: {
      ne: LngLat;
      sw: LngLat;
      paddingTop?: number;
      paddingBottom?: number;
      paddingLeft?: number;
      paddingRight?: number;
    };
    animationMode?: 'flyTo' | 'easeTo' | 'linearTo' | 'moveTo' | 'none';
    animationDuration?: number;
  }>;
  GeoJSONSource: ComponentType<{ id: string; data: object; children?: ReactNode }>;
  Layer: ComponentType<{
    id: string;
    type: 'line';
    source?: string;
    paint?: object;
    layout?: object;
  }>;
};

let cachedModule: MapLibreModule | null = null;
let triedLoad = false;
function loadMapLibre(): MapLibreModule | null {
  if (triedLoad) return cachedModule;
  triedLoad = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('@maplibre/maplibre-react-native') as MapLibreModule;
  } catch {
    cachedModule = null; // no native module in this build / environment
  }
  return cachedModule;
}

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
  const { Map, Camera, GeoJSONSource, Layer } = MapLibre;

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

  return (
    <View
      style={{
        height,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Map mapStyle={styleUrl} style={{ flex: 1 }}>
        <Camera
          bounds={{
            ne: [maxLng, maxLat],
            sw: [minLng, minLat],
            paddingTop: 28,
            paddingBottom: 28,
            paddingLeft: 28,
            paddingRight: 28,
          }}
          animationDuration={0}
        />
        <GeoJSONSource id={SOURCE_ID} data={toLineString(path)}>
          <Layer
            id={LAYER_ID}
            type="line"
            paint={{ 'line-color': theme.colors.sandstone, 'line-width': 3 }}
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}
