/**
 * routeBuilder.ts — the pure state model behind the Explore-2 route builder
 * (map-tab.md REFRAME AMENDMENT). Kept React-free so every transition and every
 * derived readout unit-tests without a renderer or a network — the hook
 * (useRouteBuilder.ts) is a thin wrapper that awaits snapSegment and feeds the
 * results in here.
 *
 * The model is keyed on WAYPOINTS (the points the user placed), not the raw
 * geometry: undo/clear operate on waypoints, and each gap between consecutive
 * waypoints carries a cached snapped segment. Flattening tags each stored point
 * `kind: 'waypoint' | 'derived'` (route.ts) so a future editor — and Sections —
 * can recover intent from engine-derived geometry, migration-free.
 */
import {
  routeDistanceM,
  ROUTE_VISIBILITY_PRIVATE,
  type Route,
  type RoutePoint,
  type RouteSource,
} from '@core/route';
import type { LatLng } from '@core/geo';
import { routingModeForActivity, type RoutingMode, type SnapResult } from './routeSnap';

export type Waypoint = LatLng;

/** Geometry for one gap (waypoint i → waypoint i+1), inclusive of both
 *  endpoints, plus whether snapping fell back to a straight line. */
export type BuilderSegment = SnapResult;

export type BuilderState = {
  activityId: string;
  mode: RoutingMode;
  waypoints: Waypoint[];
  /** segments[i] spans waypoints[i]→waypoints[i+1]; length === max(0, n-1). */
  segments: BuilderSegment[];
};

export function emptyBuilder(activityId: string, mode?: RoutingMode): BuilderState {
  return {
    activityId,
    mode: mode ?? routingModeForActivity(activityId),
    waypoints: [],
    segments: [],
  };
}

/**
 * Append a placed waypoint. The first waypoint carries no segment; every later
 * one must carry the segment spanning the previous waypoint to this one (the
 * hook computes it via snapSegment). A non-first append with a null segment is
 * a programming error — treated as a no-op rather than corrupting the invariant.
 */
export function appendWaypoint(
  state: BuilderState,
  wp: Waypoint,
  segment: BuilderSegment | null
): BuilderState {
  if (state.waypoints.length === 0) {
    return { ...state, waypoints: [wp], segments: [] };
  }
  if (!segment) return state;
  return {
    ...state,
    waypoints: [...state.waypoints, wp],
    segments: [...state.segments, segment],
  };
}

/** Remove the last placed waypoint and the segment leading to it. */
export function undoWaypoint(state: BuilderState): BuilderState {
  if (state.waypoints.length === 0) return state;
  return {
    ...state,
    waypoints: state.waypoints.slice(0, -1),
    segments: state.segments.slice(0, -1),
  };
}

/** Drop every waypoint, keeping the sport/mode selection. */
export function clearBuilder(state: BuilderState): BuilderState {
  return { ...state, waypoints: [], segments: [] };
}

/**
 * Switch routing mode (sport change, or the free-line toggle), keeping the
 * waypoints and clearing the cached segments — they were snapped for the old
 * mode. The hook re-snaps each gap under the new mode and re-appends the
 * segments (instant for 'freeline'; a network call per gap otherwise).
 */
export function retargetMode(state: BuilderState, mode: RoutingMode): BuilderState {
  return { ...state, mode, segments: [] };
}

/**
 * Flatten to stored geometry with per-point `kind` tags. Each segment's two
 * endpoints correspond to placed waypoints → `'waypoint'`; the engine-inserted
 * vertices between them → `'derived'`. Consecutive segments share a join
 * vertex, deduped here. A free-line route's coords are the raw placed points, so
 * points === waypoints exactly (no derived points).
 */
export function builderRoutePoints(state: BuilderState): RoutePoint[] {
  const { waypoints, segments } = state;
  if (waypoints.length === 0) return [];
  if (segments.length === 0) {
    return waypoints.map((w) => ({ lat: w.lat, lng: w.lng, kind: 'waypoint' as const }));
  }
  const pts: RoutePoint[] = [];
  for (let i = 0; i < segments.length; i++) {
    const coords = segments[i].coords;
    for (let j = 0; j < coords.length; j++) {
      if (i > 0 && j === 0) continue; // dedupe join with the previous segment's end
      const isEndpoint = j === 0 || j === coords.length - 1;
      const kind: NonNullable<RoutePoint['kind']> = isEndpoint ? 'waypoint' : 'derived';
      pts.push({ lat: coords[j].lat, lng: coords[j].lng, kind });
    }
  }
  return pts;
}

/** Live "distance as plotted" over the flattened geometry (reuses the core
 *  honest haversine fold; snapped geometry gives the along-trail length). */
export function builderDistanceM(state: BuilderState): number {
  return routeDistanceM(builderRoutePoints(state));
}

/** The RouteSource to persist, by build mode (not per-segment): a snapped route
 *  with a free-line fallback segment is still 'snapped' — the honesty label
 *  carries that caveat, the source tag records the intent. */
export function builderSource(mode: RoutingMode): RouteSource {
  switch (mode) {
    case 'foot':
    case 'bike':
      return 'snapped';
    case 'river':
      return 'river';
    case 'freeline':
      return 'plotted';
  }
}

/** Strava-Manual-Mode honesty labeling (routes-implementation.md §1, adopt #2):
 *  say what the distance can and can't claim. Never an elevation number. */
export function builderHonestyLabel(state: BuilderState): string {
  const anyFellBack = state.segments.some((s) => s.fellBack);
  switch (state.mode) {
    case 'foot':
    case 'bike':
      return anyFellBack
        ? 'along trails — some sections plotted straight (no route found)'
        : 'along trails';
    case 'river':
      return anyFellBack
        ? 'along the waterway — some sections plotted straight (no river found)'
        : 'along the waterway';
    case 'freeline':
      return 'as plotted — trails may be longer';
  }
}

/** A route needs at least two stored points to be worth saving. */
export function canSaveBuilder(state: BuilderState): boolean {
  return builderRoutePoints(state).length >= 2;
}

/**
 * Assemble a Route to persist from the current build. Returns null when there's
 * nothing worth saving (fewer than two points). `id` and `now` are injected so
 * this stays pure and testable; the hook supplies uuidv7() / the storage layer
 * stamps timestamps.
 */
export function buildRoute(state: BuilderState, name: string, id: string): Route | null {
  const points = builderRoutePoints(state);
  if (points.length < 2) return null;
  return {
    id,
    name,
    activityId: state.activityId,
    source: builderSource(state.mode),
    points,
    visibility: ROUTE_VISIBILITY_PRIVATE,
  };
}
