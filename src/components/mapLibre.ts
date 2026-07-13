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
 * Pinned to v11: the API is aligned to MapLibre GL JS. Classic v10 names were
 * renamed — MapView→Map, ShapeSource→GeoJSONSource (shape→data), the specific
 * LineLayer→a unified Layer (type="line", paint/layout style-spec props),
 * MarkerView→ViewAnnotation (coordinate→lngLat), Camera centerCoordinate/
 * zoomLevel→center/zoom and bounds → a flat [w,s,e,n] + padding object.
 * v11 exposes named exports (no aggregate default) and dropped setAccessToken
 * (MapLibre needs no token). v11 requires the New Architecture (RN ≥ 0.80).
 */
import type { ComponentType, ReactElement, ReactNode } from 'react';

export type LngLat = [number, number];

/** MapLibre GL JS PositionAnchor format (v11 `anchor` prop). */
export type Anchor =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/**
 * Thin typed adapter over only the pieces we use, verified against the v11 d.ts.
 * The native render itself is validated by the human's prebuild + on-device
 * check, not tsc.
 */
export type MapLibreModule = {
  Map: ComponentType<{
    mapStyle: string;
    style?: object;
    logo?: boolean;
    attribution?: boolean;
    compass?: boolean;
    children?: ReactNode;
  }>;
  Camera: ComponentType<{
    /** Flat [west, south, east, north] (GeoJSON order); fits the viewport. */
    bounds?: [number, number, number, number];
    /** Pixel insets applied to a fitted `bounds`. */
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    center?: LngLat;
    zoom?: number;
    /** Animation duration in ms (0 = jump). */
    duration?: number;
  }>;
  GeoJSONSource: ComponentType<{ id?: string; data: object | string; children?: ReactNode }>;
  /** Unified layer: `type="line"` etc.; source is injected when nested. */
  Layer: ComponentType<{
    type: string;
    id?: string;
    source?: string;
    paint?: object;
    layout?: object;
  }>;
  ViewAnnotation: ComponentType<{
    lngLat: LngLat;
    anchor?: Anchor;
    children: ReactElement;
  }>;
};

let cachedModule: MapLibreModule | null = null;
let triedLoad = false;

export function loadMapLibre(): MapLibreModule | null {
  if (triedLoad) return cachedModule;
  triedLoad = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@maplibre/maplibre-react-native');
    // v11 ships named exports directly on the module namespace.
    cachedModule = mod as MapLibreModule;
  } catch {
    cachedModule = null; // no native module in this build / environment
  }
  return cachedModule;
}
