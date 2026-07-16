/**
 * route.ts — the reusable-asset primitive (routes-spec P1, Session 9).
 *
 * A Route is a named line the user can browse and, later, follow while
 * recording — a recipe, not a record. Distinct from a Session's `gpsPath`/
 * `track` (what happened, timestamped, tier-1, never simplified): a Route
 * carries no timestamps at all (`RoutePoint` omits `tsSec`), because a plan
 * has no "when". `source` says how the geometry arrived — see the RouteSource
 * union below ('plotted' free-line, 'snapped' trail/road, 'river' waterway,
 * 'session' promoted recording, 'gpx' import).
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
  /**
   * How this point entered the geometry (Explore-2 route builder). A user-placed
   * waypoint is `'waypoint'`; a point the snapping engine (Valhalla) or the OSM
   * river clip inserted between waypoints is `'derived'`. Absent = untagged
   * (imported/promoted geometry, or a pre-builder plotted route). Rides the
   * existing `points` JSON column via JSON.stringify — no migration, no
   * serialize change (verified: serialize.ts round-trips whole point objects).
   *
   * The builder's undo/clear model is designed around waypoints, not raw points,
   * so a future editor (and Sections, below) can recover user *intent* from
   * derived geometry (routes-implementation.md §3, adopt #5).
   */
  kind?: 'waypoint' | 'derived';
};

/**
 * 'plotted'  — free-line builder: straight segments between placed waypoints
 *              (paragliding, and the universal fallback when snapping is off or
 *              unavailable). Distance "as plotted — trails may be longer".
 * 'snapped'  — builder segments snapped to trails/roads per sport via the
 *              routing engine (Valhalla); foot/bike (Explore-2).
 * 'river'    — builder segments snapped to the OSM waterway line, clipped
 *              between put-in and take-out (Explore-2).
 * 'session'  — promoted from a finished recording, RDP-simplified (P2.5; not
 *              built this session).
 * 'gpx'      — imported file, timestamps stripped at the door.
 *
 * `source` is a free TEXT column (migration 016), so this union widens with no
 * migration. Tagged by the builder's *mode*, not per-segment: a snapped route
 * whose middle segment fell back to free-line is still `'snapped'` (the honesty
 * label carries the per-segment caveat, not the source tag).
 */
export type RouteSource = 'plotted' | 'snapped' | 'river' | 'session' | 'gpx';

/**
 * FUTURE — Sections (R1: named timed stretches within a route;
 * explore-forecasting-research.md §2e). A Route may later gain:
 *
 *   sections?: { name: string; startIdx: number; endIdx: number }[];
 *
 * where startIdx/endIdx index into the `kind: 'waypoint'` points (user intent,
 * not derived geometry). Like `RoutePoint.kind` this rides the routes JSON with
 * no migration. Displayed as tinted sub-segments; per-section self-times derived
 * post-hoc; friend-compare is Ring 4. NOT built here — no Sections UI — recorded
 * so it lands migration-free when specced (open question E5).
 */

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
