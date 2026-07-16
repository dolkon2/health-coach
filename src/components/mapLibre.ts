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
 *
 * `RasterDEMSource` (P4-2, 3D terrain): a source component like GeoJSONSource,
 * pointed at a terrain-RGB TileJSON. Style-level `terrain`/`sky` (the fields
 * that actually raise the mesh) have no component — they're set on the style
 * object itself; see mapTerrain.ts + useTerrainMapStyle.
 *
 * `Map`'s `ref`/`Camera`'s `ref` (map-tab.md Explore reframe): v11 exposes
 * imperative handles as an ordinary `ref` prop, not `forwardRef` — `MapRefHandle.
 * getCenter()` is Explore's crosshair reading "wherever the reticle points" on
 * demand (no continuous region-change state); `CameraRefHandle.flyTo()` is
 * location search's recenter. `onLongPress` is My Map's "pin a spot here" door.
 */
import type { ComponentType, ReactElement, ReactNode, Ref } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

export type LngLat = [number, number];

/** The touch coordinate carried by `Map`'s onPress/onLongPress events. */
export type MapPressEvent = { lngLat: LngLat; point: { x: number; y: number } };

/** Imperative handle exposed via `Map`'s `ref` prop (v11 ref-as-prop, not forwardRef). */
export type MapRefHandle = {
  getCenter(): Promise<LngLat>;
};

/** Imperative handle exposed via `Camera`'s `ref` prop — only the method we use. */
export type CameraRefHandle = {
  flyTo(options: { center: LngLat; zoom?: number; duration?: number }): void;
};

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
    mapStyle: string | StyleSpecification;
    style?: object;
    logo?: boolean;
    attribution?: boolean;
    compass?: boolean;
    children?: ReactNode;
    /** v11 ref-as-prop (not forwardRef) — `getCenter()` for Explore's crosshair. */
    ref?: Ref<MapRefHandle>;
    /** Fires on a long touch-and-hold — My Map's "pin a spot here" door. */
    onLongPress?: (event: NativeSyntheticEvent<MapPressEvent>) => void;
  }>;
  Camera: ComponentType<{
    /** Flat [west, south, east, north] (GeoJSON order); fits the viewport. */
    bounds?: [number, number, number, number];
    /** Pixel insets applied to a fitted `bounds`. */
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    center?: LngLat;
    zoom?: number;
    /** Tilt in degrees (0 = straight down); a two-finger drag adjusts it live (Map's `touchPitch` default). */
    pitch?: number;
    /** Rotation in degrees from north. */
    bearing?: number;
    /** Animation duration in ms (0 = jump). */
    duration?: number;
    /** Ref to imperative camera methods — only `flyTo` (search recenter) is typed here. */
    ref?: Ref<CameraRefHandle>;
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
  /** Terrain-RGB elevation source; pair with a `type="hillshade"` Layer child. */
  RasterDEMSource: ComponentType<{
    id?: string;
    url?: string;
    encoding?: 'mapbox' | 'terrarium';
    children?: ReactNode;
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
