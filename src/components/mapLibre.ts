/**
 * mapLibre.ts — the single lazy loader for @maplibre/maplibre-react-native,
 * shared by every map surface (RouteMap's polyline, MapSurface's basemap + pins).
 *
 * The native module imports react-native at module load, so a static import
 * would break jest/node and crash any dev build made before the native module
 * shipped. We `require()` it once, on first render, and cache the result;
 * importing THIS file from anywhere is always safe (the require runs only when a
 * map actually renders on-device). Every caller degrades honestly when the
 * loader returns null — a fallback trace or a neutral placeholder, never a
 * fabricated map.
 *
 * Pinned to v10 (v10.4.2): its config plugin is compatible with Expo SDK 53.
 * v10's classic API: MapView (mapStyle) / Camera (centerCoordinate|bounds) /
 * ShapeSource (shape) / LineLayer (camelCase style) / MarkerView (interactive
 * RN marker), exposed on the module's default aggregate export.
 */
import type { ComponentType, ReactElement, ReactNode } from 'react';

export type LngLat = [number, number];

/**
 * Thin typed adapter over only the pieces we use, verified against the v10 d.ts.
 * The native render itself is validated by the human's prebuild + on-device
 * check, not tsc.
 */
export type MapLibreModule = {
  MapView: ComponentType<{
    mapStyle: string;
    style?: object;
    attributionEnabled?: boolean;
    logoEnabled?: boolean;
    compassEnabled?: boolean;
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
    centerCoordinate?: LngLat;
    zoomLevel?: number;
    animationDuration?: number;
  }>;
  ShapeSource: ComponentType<{ id: string; shape: object; children?: ReactNode }>;
  LineLayer: ComponentType<{ id: string; sourceID?: string; style?: object }>;
  MarkerView: ComponentType<{
    coordinate: LngLat;
    anchor?: { x: number; y: number };
    allowOverlap?: boolean;
    children: ReactElement;
  }>;
  setAccessToken?: (token: string | null) => void;
};

let cachedModule: MapLibreModule | null = null;
let triedLoad = false;

export function loadMapLibre(): MapLibreModule | null {
  if (triedLoad) return cachedModule;
  triedLoad = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@maplibre/maplibre-react-native');
    // v10 exposes an aggregate default export; fall back to the namespace.
    const G = (mod && mod.default ? mod.default : mod) as MapLibreModule;
    // MapLibre needs no access token; set null once to silence the token warning.
    G.setAccessToken?.(null);
    cachedModule = G;
  } catch {
    cachedModule = null; // no native module in this build / environment
  }
  return cachedModule;
}
