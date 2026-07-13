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
 * @maplibre/maplibre-react-native v11 (New-Architecture only): Map (mapStyle) /
 * Camera (center|bounds + padding) / GeoJSONSource (data) / Layer (type="line",
 * style-spec paint/layout), all named exports off the module namespace.
 *
 * P4-2: 3D terrain on the same hero — a terrain-RGB RasterDEMSource + hillshade
 * (mapTerrain.ts, via the shared TerrainHillshade) and an initial camera tilt,
 * purely presentational (no elevation number is read off the DEM here). The
 * map only ever mounts once useTerrainMapStyle has *settled* (never handed a
 * style value that later swaps out from under it) — a live style reload
 * resets MapLibre's camera to the default world view, so the brief loading
 * window degrades to the SVG trace instead of flashing a broken map.
 */
import React from 'react';
import { View } from 'react-native';
import type { LatLng } from '@core/geo';
import { useTheme } from '@/theme';
import { mapTerrainTileUrl } from '@/lib/config';
import { TERRAIN_CAMERA_PITCH } from '@/lib/mapTerrain';
import { loadMapLibre, type LngLat } from './mapLibre';
import { useTerrainMapStyle } from '@/hooks/useTerrainMapStyle';
import { TerrainHillshade } from './TerrainHillshade';
import { RoutePreview } from './RoutePreview';
import { toLineString } from './geoJson';

const SOURCE_ID = 'route-source';
const LAYER_ID = 'route-line';

type RouteMapProps = {
  path: LatLng[];
  height?: number;
};

export function RouteMap({ path, height = 220 }: RouteMapProps) {
  const theme = useTheme();
  const terrain = useTerrainMapStyle();

  // No key, still loading, or nothing drawable → the honest SVG trace still
  // tells the truth (and never flashes a map that's about to reload).
  if (terrain.status !== 'ready' || path.length < 2) {
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

  // A barely-moved route (a handful of near-identical fixes) has an almost-zero
  // bounding box; fitting the camera to it over-zooms past where tiles exist and
  // the map renders blank. Below ~65 m across, center on it at a sensible zoom.
  const tiny = maxLat - minLat < 0.0006 && maxLng - minLng < 0.0006;
  const cameraProps = tiny
    ? {
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as LngLat,
        zoom: 15,
      }
    : {
        // v11 bounds are a flat [west, south, east, north] with a separate
        // padding inset object (was v10's { ne, sw, paddingTop, … }).
        bounds: [minLng, minLat, maxLng, maxLat] as [number, number, number, number],
        padding: { top: 28, right: 28, bottom: 28, left: 28 },
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
      <Map mapStyle={terrain.mapStyle} style={{ flex: 1 }}>
        <Camera
          {...cameraProps}
          pitch={terrain.terrainReady ? TERRAIN_CAMERA_PITCH : 0}
          duration={0}
        />
        <TerrainHillshade
          MapLibre={MapLibre}
          terrainReady={terrain.terrainReady}
          terrainTileUrl={mapTerrainTileUrl()}
          layerId="route-hillshade"
        />
        <GeoJSONSource id={SOURCE_ID} data={toLineString(path)}>
          <Layer
            type="line"
            id={LAYER_ID}
            paint={{
              'line-color': theme.colors.accent,
              'line-width': 3,
            }}
            layout={{
              'line-cap': 'round',
              'line-join': 'round',
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}
