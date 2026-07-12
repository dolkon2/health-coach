/**
 * route.ts — the reusable-asset primitive (routes-spec P1, Session 9).
 *
 * A Route is a named line the user can browse and, later, follow while
 * recording — a recipe, not a record. Distinct from a Session's `gpsPath`/
 * `track` (what happened, timestamped, tier-1, never simplified): a Route
 * carries no timestamps at all (`RoutePoint` omits `tsSec`), because a plan
 * has no "when". `source` says how the geometry arrived — 'plotted' (the
 * straight-line builder, deferred to the Explore track, Phase 4), 'session'
 * (promoted from a finished recording — not built this session), or 'gpx'
 * (imported file, stripped of timestamps at the door).
 *
 * NOTE (Session 9, flagged not reinterpreted): the authoring `routes-spec.md`
 * this type is meant to implement is cited throughout `planning/rework/tabs/
 * map-tab.md` and `training-tab.md` as "REF pins-routes branch" but does not
 * exist anywhere in this repo or its git history (verified: absent from every
 * branch/worktree, never committed) — the D0 doc-landing pass those specs
 * call for was never executed. This shape is reconstructed from the specs'
 * extensive direct citations of its locked decisions (RoutePoint[], no
 * timestamps, visibility default private, RouteSource's three values,
 * migration 016) rather than read from the source document itself.
 */
import { haversineM } from './geo';

export type RoutePoint = {
  lat: number;
  lng: number;
  /** Present only when the source carried elevation (an imported file's
   *  <ele>, or a future promoted session's track). Absent, never fabricated —
   *  a plotted route has no elevation number at all (no DEM source chosen
   *  yet; map-tab.md §5). */
  eleM?: number;
};

/**
 * 'plotted'  — the straight-line builder (Explore track, Phase 4; not built).
 * 'session'  — promoted from a finished recording, RDP-simplified (P2.5; not
 *              built this session).
 * 'gpx'      — imported file, timestamps stripped at the door (this session's
 *              creation door — the only one that exists yet).
 */
export type RouteSource = 'plotted' | 'session' | 'gpx';

export interface Route {
  id: string;
  name: string;
  /** Registry id from src/lib/activity.ts — which sport this route is for. */
  activityId: string;
  source: RouteSource;
  points: RoutePoint[];
  /** 'private' | a cohortId (Ring 4, unused at MVP) — private-only everywhere
   *  today (map-tab.md §6). Free string, same convention as Spot.kind. */
  visibility: string;
  notes?: string;
  /** Storage bookkeeping — present on reads; writes may omit it (stamped at
   *  insert). */
  createdAt?: string;
  updatedAt?: string;
}

export const ROUTE_VISIBILITY_PRIVATE = 'private';

/**
 * Plotted-line distance: a pure haversine fold over consecutive points, in
 * metres. "Distance as plotted" (Strava Manual Mode's honesty framing,
 * routes-implementation.md §1) — never routed, never corrected for terrain.
 * Returns 0 for fewer than 2 points (nothing to sum, not a fabricated
 * measurement).
 */
export function routeDistanceM(points: RoutePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1], points[i]);
  }
  return total;
}
