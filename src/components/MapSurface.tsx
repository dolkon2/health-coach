/**
 * MapSurface — the full-bleed basemap for the Map tab, shared by My Map and
 * Explore (map-tab.md REFRAME AMENDMENT). Centers on a given coordinate and
 * drops a tappable sport-icon pin for each spot that carries real
 * coordinates, plus (My Map only) saved-route and own-trace layers.
 *
 * Honest degradations, never a fabricated or blank map frame:
 *   - No MapTiler key (mapStyleUrl() === null) → a neutral placeholder telling
 *     the truth ("map needs a key"). M0 (keyless OpenFreeMap default) is a
 *     separate pass; until then the map is the keyed upgrade.
 *   - Native MapLibre module absent (old dev build / jest / node) → the same
 *     neutral placeholder. The trace path (RouteMap) has its own SVG fallback;
 *     a live basemap has no honest still-image equivalent, so we say so plainly.
 *
 * The native module loads via the shared lazy `loadMapLibre` (mapLibre.ts), so
 * importing this file anywhere is safe — the require runs only on-device.
 *
 * `guidePath` (routes-spec M4, Session 9): an optional muted line for a route
 * Record was armed to follow — "line + self-position, user navigates
 * themselves," the watch-breadcrumb pattern (routes-implementation.md §1),
 * never a routed/snapped line. No off-route detection, no alerts, ever.
 *
 * `routes`/`traces` (map-tab.md REFRAME AMENDMENT, My Map only): saved
 * routes and your own E/S/W session tracks, each element-tinted via
 * `theme.colors.element`. Both render as ONE GeoJSONSource + Layer for the
 * whole set (a data-driven `match` paint expression keyed on
 * `properties.element`), not one source per route/trace — keeps native
 * layer count constant regardless of data volume. Tap-to-detail rides a
 * `ViewAnnotation` marker at each route's start point (reusing the SpotPin
 * pattern) rather than native per-feature picking — simpler, proven, and
 * doubles as the required "start marker."
 *
 * `onLongPress`/`getCenter` (Explore + My Map's "pin a spot here"): v11
 * exposes both as ref-as-prop / event-prop, not forwardRef internals — see
 * mapLibre.ts's doc comment. `getCenter()` is exposed on THIS component's
 * own ref (`MapSurfaceRef`) so Explore's crosshair can read "wherever the
 * reticle points" on demand, without a continuous region-change subscription.
 *
 * `liveLoc` (base chrome, both modes): the live-position marker. Deliberately
 * an actual blue dot — a one-off, explicitly-decided exception to the
 * monochrome+4-element palette (Dylan, 2026-07-16): "you are here" reads via
 * the universal map convention, not a design-system token.
 *
 * `flyTo` (location search recenter): a declarative prop, not an imperative
 * call — consistent with how `center`/`zoom` already drive the initial
 * camera. A `useEffect` fires the underlying Camera ref's `flyTo()` when the
 * coordinate changes.
 *
 * P4-2: 3D terrain on this same surface — a terrain-RGB RasterDEMSource +
 * hillshade (mapTerrain.ts, via the shared TerrainHillshade) and an initial
 * camera tilt, purely presentational. The map only mounts once
 * useTerrainMapStyle has settled — see RouteMap.tsx for why a live style swap
 * after mount is unsafe (it resets MapLibre's camera).
 */
import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import type { Spot } from '@core/spot';
import type { LatLng } from '@core/geo';
import { useTheme } from '@/theme';
import { mapTerrainTileUrl } from '@/lib/config';
import { TERRAIN_CAMERA_PITCH } from '@/lib/mapTerrain';
import { directionMarks } from '@/lib/mapGeom';
import { loadMapLibre, type LngLat, type MapRefHandle, type CameraRefHandle } from './mapLibre';
import { useTerrainMapStyle } from '@/hooks/useTerrainMapStyle';
import { TerrainHillshade } from './TerrainHillshade';
import { spotIcon } from './activityIcons';
import { Text } from './Text';
import { toLineString, toMultiLineString } from './geoJson';

type PinnableSpot = Spot & { lat: number; lng: number };
type MapElement = 'earth' | 'water' | 'sky';

export type RouteLayerRoute = { id: string; points: LatLng[]; element: MapElement };
export type TraceLayerTrace = { id: string; points: LatLng[]; element: MapElement };

type MapSurfaceProps = {
  center?: LngLat;
  zoom?: number;
  pins: ReadonlyArray<PinnableSpot>;
  onPressPin: (spot: Spot) => void;
  guidePath?: LatLng[];
  /** Saved routes (My Map only) — element-tinted lines + a tappable start marker. */
  routes?: ReadonlyArray<RouteLayerRoute>;
  onPressRoute?: (routeId: string) => void;
  /** Your own E/S/W session tracks (My Map only) — low-opacity, element-tinted. */
  traces?: ReadonlyArray<TraceLayerTrace>;
  /** Live-position marker (base chrome, both modes). */
  liveLoc?: LngLat | null;
  /** Route builder (Explore takeover): the in-progress line, accent-tinted and
   *  drawn above saved routes; and the placed waypoints as tappable-looking
   *  discs. Both change on every waypoint edit (intended re-render — the builder
   *  is Explore-only, never live during a recording). */
  draftRoute?: LatLng[];
  draftWaypoints?: LatLng[];
  /** My Map's "pin a spot here" door. */
  onLongPress?: (coord: LngLat) => void;
  /** Location search's recenter — declarative, see file header. */
  flyTo?: {
    center: LngLat;
    zoom?: number;
    /** A monotonic per-request id, not just the coordinate — re-picking the
     *  identical search result twice must still fly there a second time
     *  (e.g. after the user panned away); comparing raw lng/lat wouldn't
     *  fire on a numerically-identical repeat request. */
    requestId: number;
  } | null;
};

export type MapSurfaceRef = {
  /** Explore's crosshair reads "wherever the reticle points" on demand. */
  getCenter: () => Promise<LngLat | null>;
};

const GUIDE_SOURCE_ID = 'guide-route-source';
const GUIDE_LAYER_ID = 'guide-route-line';
const ROUTES_SOURCE_ID = 'routes-source';
const ROUTES_LAYER_ID = 'routes-line';
const TRACES_SOURCE_ID = 'traces-source';
const TRACES_LAYER_ID = 'traces-line';
const DRAFT_SOURCE_ID = 'draft-route-source';
const DRAFT_LAYER_ID = 'draft-route-line';

// Google/Apple Maps' "you are here" convention — a deliberate, explicit
// exception to the monochrome+4-element palette (Dylan, 2026-07-16), not a
// design-system token. Never reused for anything else on this surface.
const LIVE_LOCATION_BLUE = '#1A73E8';
const DIRECTION_ARROW_COUNT = 3;

function elementColorExpr(theme: ReturnType<typeof useTheme>): unknown[] {
  return [
    'match',
    ['get', 'element'],
    'earth',
    theme.colors.element.earth,
    'water',
    theme.colors.element.water,
    'sky',
    theme.colors.element.sky,
    theme.colors.textMuted,
  ];
}

function MapUnavailable({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[6],
        backgroundColor: theme.colors.surface,
      }}
    >
      <MapPin size={32} color={theme.colors.textMuted} strokeWidth={1.5} />
      <Text variant="bodySm" color={theme.colors.textMuted} style={{ textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}

/** One spot's pin: a sport-icon badge that pushes to its detail on tap. */
function SpotPin({ spot, onPress }: { spot: PinnableSpot; onPress: () => void }) {
  const theme = useTheme();
  const Icon = spotIcon(spot);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Open ${spot.name}`}
      style={{
        width: 34,
        height: 34,
        borderRadius: theme.radius.full,
        borderWidth: 2,
        borderColor: theme.colors.accent,
        backgroundColor: theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={18} color={theme.colors.accent} strokeWidth={1.75} />
    </Pressable>
  );
}

/** A route's start point: a small element-tinted disc, tap → route detail. */
function RouteStartMarker({
  element,
  onPress,
}: {
  element: MapElement;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Open route"
      style={{
        width: 16,
        height: 16,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.element[element],
        borderWidth: 2,
        borderColor: theme.colors.surfaceRaised,
      }}
    />
  );
}

/** A small rotated triangle pointing along the route's direction of travel. */
function RouteArrow({ element, headingDeg }: { element: MapElement; headingDeg: number }) {
  const theme = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderBottomWidth: 9,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: theme.colors.element[element],
        transform: [{ rotate: `${headingDeg}deg` }],
      }}
    />
  );
}

/** A placed route-builder waypoint — a small accent disc. */
function WaypointDot() {
  const theme = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        width: 12,
        height: 12,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.accent,
        borderWidth: 2,
        borderColor: theme.colors.surfaceRaised,
      }}
    />
  );
}

/** The live-position marker — see file header for the blue-dot decision. */
function LiveLocationDot() {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: LIVE_LOCATION_BLUE,
          borderWidth: 2,
          borderColor: theme.colors.surfaceRaised,
        },
        theme.shadow.sm,
      ]}
    />
  );
}

const MapSurfaceInner = React.forwardRef<MapSurfaceRef, MapSurfaceProps>(function MapSurfaceInner(
  { center, zoom, pins, onPressPin, guidePath, routes, onPressRoute, traces, liveLoc, draftRoute, draftWaypoints, onLongPress, flyTo },
  ref
) {
  const theme = useTheme();
  const terrain = useTerrainMapStyle();
  const mapRef = useRef<MapRefHandle | null>(null);
  const cameraRef = useRef<CameraRefHandle | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      getCenter: async () => {
        if (!mapRef.current) return null;
        try {
          return await mapRef.current.getCenter();
        } catch {
          return null;
        }
      },
    }),
    []
  );

  // Declarative recenter (location search): fires the imperative Camera
  // method on every new request (keyed on `requestId`, not the coordinate
  // itself — review finding: keying on lng/lat/zoom meant re-picking the
  // identical search result a second time was silently a no-op, since
  // React's dependency comparison saw no change).
  const flyToLng = flyTo?.center[0];
  const flyToLat = flyTo?.center[1];
  const flyToZoom = flyTo?.zoom;
  const flyToRequestId = flyTo?.requestId;
  useEffect(() => {
    if (flyToLng == null || flyToLat == null || flyToRequestId == null) return;
    cameraRef.current?.flyTo({ center: [flyToLng, flyToLat], zoom: flyToZoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToRequestId]);

  if (terrain.status === 'unavailable') {
    return <MapUnavailable message="The map needs a MapTiler key to render. Recording still works." />;
  }

  const MapLibre = loadMapLibre();
  if (!MapLibre) {
    return <MapUnavailable message="The map needs an updated dev build to render. Recording still works." />;
  }
  if (terrain.status === 'loading') {
    return <MapUnavailable message="Loading the map…" />;
  }
  const { Map, Camera, ViewAnnotation, GeoJSONSource, Layer } = MapLibre;
  const hasGuide = guidePath != null && guidePath.length >= 2;
  const routeList = routes ?? [];
  const traceList = traces ?? [];
  const hasRoutes = routeList.length > 0;
  const hasTraces = traceList.length > 0;
  const draftWpList = draftWaypoints ?? [];
  const hasDraft = draftRoute != null && draftRoute.length >= 2;
  // A search result can arrive before any honest center exists (no GPS fix,
  // no spots) — let it seed the initial camera too, same "never [0,0]" rule
  // the bare-zoom comment below already follows.
  const initialCenter = center ?? (flyToLng != null && flyToLat != null ? [flyToLng, flyToLat] : undefined);

  return (
    <View style={{ flex: 1 }}>
      <Map
        ref={mapRef}
        mapStyle={terrain.mapStyle}
        style={{ flex: 1 }}
        logo={false}
        onLongPress={onLongPress ? (e) => onLongPress(e.nativeEvent.lngLat) : undefined}
      >
        {/* Omit the Camera entirely when we have no honest center — a bare zoom
            would park MapLibre at [0,0]; no Camera lets the style default hold. */}
        {initialCenter ? (
          <Camera
            ref={cameraRef}
            center={initialCenter as LngLat}
            zoom={zoom}
            pitch={terrain.terrainReady ? TERRAIN_CAMERA_PITCH : 0}
            duration={0}
          />
        ) : null}
        <TerrainHillshade
          MapLibre={MapLibre}
          terrainReady={terrain.terrainReady}
          terrainTileUrl={mapTerrainTileUrl()}
          layerId="record-hillshade"
        />
        {hasTraces ? (
          <GeoJSONSource
            id={TRACES_SOURCE_ID}
            data={toMultiLineString(traceList.map((t) => ({ path: t.points, properties: { element: t.element } })))}
          >
            <Layer
              type="line"
              id={TRACES_LAYER_ID}
              paint={{
                'line-color': elementColorExpr(theme),
                'line-width': 2,
                'line-opacity': 0.35,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        {hasRoutes ? (
          <GeoJSONSource
            id={ROUTES_SOURCE_ID}
            data={toMultiLineString(routeList.map((r) => ({ path: r.points, properties: { element: r.element } })))}
          >
            <Layer
              type="line"
              id={ROUTES_LAYER_ID}
              paint={{
                'line-color': elementColorExpr(theme),
                'line-width': 3,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        {hasDraft ? (
          <GeoJSONSource id={DRAFT_SOURCE_ID} data={toLineString(draftRoute!)}>
            <Layer
              type="line"
              id={DRAFT_LAYER_ID}
              paint={{
                'line-color': theme.colors.accent,
                'line-width': 3.5,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        {hasGuide ? (
          <GeoJSONSource id={GUIDE_SOURCE_ID} data={toLineString(guidePath!)}>
            <Layer
              type="line"
              id={GUIDE_LAYER_ID}
              paint={{
                'line-color': theme.colors.textMuted,
                'line-width': 2.5,
                'line-dasharray': [2, 2],
              }}
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
            />
          </GeoJSONSource>
        ) : null}
        {routeList.map((route) =>
          route.points.length > 0 ? (
            <React.Fragment key={route.id}>
              <ViewAnnotation lngLat={[route.points[0].lng, route.points[0].lat]}>
                <RouteStartMarker
                  element={route.element}
                  onPress={() => onPressRoute?.(route.id)}
                />
              </ViewAnnotation>
              {directionMarks(route.points, DIRECTION_ARROW_COUNT).map((mark, i) => (
                <ViewAnnotation key={`${route.id}-arrow-${i}`} lngLat={[mark.point.lng, mark.point.lat]} anchor="center">
                  <RouteArrow element={route.element} headingDeg={mark.bearingDeg} />
                </ViewAnnotation>
              ))}
            </React.Fragment>
          ) : null
        )}
        {pins.map((spot) => (
          <ViewAnnotation key={spot.id} lngLat={[spot.lng, spot.lat]}>
            <SpotPin spot={spot} onPress={() => onPressPin(spot)} />
          </ViewAnnotation>
        ))}
        {draftWpList.map((wp, i) => (
          <ViewAnnotation key={`draft-wp-${i}`} lngLat={[wp.lng, wp.lat]} anchor="center">
            <WaypointDot />
          </ViewAnnotation>
        ))}
        {liveLoc ? (
          <ViewAnnotation lngLat={liveLoc} anchor="center">
            <LiveLocationDot />
          </ViewAnnotation>
        ) : null}
      </Map>
    </View>
  );
});

/**
 * Memoized: while a recording is live the Map screen re-renders every poll
 * tick (~2.5 s); with stable props the native MapView + marker tree must
 * not be reconciled each time (M2 review finding — a screen-on multi-hour
 * recording would otherwise churn the native bridge ~1,400 times for zero
 * visual change). Every new prop callers pass (onLongPress, routes, traces)
 * must stay referentially stable for the same reason.
 */
export const MapSurface = React.memo(MapSurfaceInner);
