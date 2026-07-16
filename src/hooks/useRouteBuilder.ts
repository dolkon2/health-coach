/**
 * useRouteBuilder — the React seam for the Explore-2 route builder. A thin
 * wrapper over the pure model (lib/routeBuilder.ts): it awaits snapSegment for
 * each new gap, tracks a `pending` flag while a snap is in flight, and saves via
 * createRoute. All the transition and derivation logic lives in the pure model
 * (unit-tested there); this file only owns async + React state.
 *
 * BUILD ONLINE / FOLLOW OFFLINE: snapping runs only here, while building. The
 * saved geometry is local; following a route never re-enters this hook.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { LatLng } from '@core/geo';
import type { Route } from '@core/route';
import { createRoute } from '../storage/routes';
import { uuidv7 } from '../lib/id';
import { snapSegment, routingModeForActivity, type RoutingMode } from '../lib/routeSnap';
import {
  emptyBuilder,
  appendWaypoint,
  undoWaypoint,
  clearBuilder,
  builderRoutePoints,
  builderDistanceM,
  builderHonestyLabel,
  buildRoute,
  type BuilderSegment,
  type BuilderState,
} from '../lib/routeBuilder';

export function useRouteBuilder(initialActivityId: string) {
  const [state, setState] = useState<BuilderState>(() => emptyBuilder(initialActivityId));
  const [pending, setPending] = useState(false);
  // Mirror for async closures — snapSegment needs the *latest* waypoints/mode,
  // not the values captured when the callback was created.
  const stateRef = useRef(state);
  stateRef.current = state;

  const addWaypoint = useCallback(async (coord: LatLng) => {
    const s = stateRef.current;
    if (s.waypoints.length === 0) {
      setState((prev) => appendWaypoint(prev, coord, null));
      return;
    }
    const prevWp = s.waypoints[s.waypoints.length - 1];
    setPending(true);
    try {
      const seg = await snapSegment(prevWp, coord, s.mode);
      setState((prev) => appendWaypoint(prev, coord, seg));
    } finally {
      setPending(false);
    }
  }, []);

  const undo = useCallback(() => setState(undoWaypoint), []);
  const clear = useCallback(() => setState(clearBuilder), []);
  const reset = useCallback((activityId: string) => setState(emptyBuilder(activityId)), []);

  // Re-snap every existing gap under a new mode/sport (instant for free-line).
  const resnapAll = useCallback(async (mode: RoutingMode, activityId?: string) => {
    const wps = stateRef.current.waypoints;
    setPending(true);
    try {
      const segs: BuilderSegment[] = [];
      for (let i = 1; i < wps.length; i++) {
        segs.push(await snapSegment(wps[i - 1], wps[i], mode));
      }
      setState((prev) => ({
        ...prev,
        mode,
        ...(activityId ? { activityId } : {}),
        segments: segs,
      }));
    } finally {
      setPending(false);
    }
  }, []);

  const setMode = useCallback((mode: RoutingMode) => resnapAll(mode), [resnapAll]);
  const setActivity = useCallback(
    (activityId: string) => resnapAll(routingModeForActivity(activityId), activityId),
    [resnapAll]
  );

  const save = useCallback(async (name: string): Promise<Route | null> => {
    const route = buildRoute(stateRef.current, name.trim() || 'Untitled route', uuidv7());
    if (!route) return null;
    return createRoute(route);
  }, []);

  const routePoints = useMemo(() => builderRoutePoints(state), [state]);
  const distanceM = useMemo(() => builderDistanceM(state), [state]);
  const honestyLabel = useMemo(() => builderHonestyLabel(state), [state]);

  return {
    activityId: state.activityId,
    mode: state.mode,
    waypoints: state.waypoints,
    routePoints,
    distanceM,
    honestyLabel,
    canSave: routePoints.length >= 2,
    waypointCount: state.waypoints.length,
    pending,
    addWaypoint,
    undo,
    clear,
    reset,
    setMode,
    setActivity,
    save,
  };
}
