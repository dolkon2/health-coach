# Handoff prompt — Explore-2 (the route builder)

*Written 2026-07-16 at the close of Explore-1 (`dev-log/map-tab-reframe-my-map-explore.md`).
Explore-1 shipped the crosshair mode and its two actions; this is what's
left of the Map track. Paste the block below to a fresh session to start
the build — the surrounding notes here are context for whoever's handing
it off, not part of the prompt itself.*

## What's already true (don't re-derive)

- **The mode switcher, Explore's crosshair, and both its actions are done**
  (`app/(tabs)/map.tsx`, `src/components/MapSurface.tsx`,
  `src/components/PointForecastSheet.tsx`). Explore is currently a
  single `{mode === 'explore' ? (<>...crosshair + two buttons...</>) : null}`
  branch in `map.tsx` with nothing else inside it — no typed seam was
  built beyond that, because the render branch itself already is the
  seam: the builder's takeover UI is just new JSX added inside that same
  block, gated on a new `exploreState` (or however this session names it)
  rather than a permanent second thing living beside the crosshair.
- **Routing reversal is a locked decision**, not open for this session to
  relitigate (`planning/rework/tabs/map-tab.md`'s REFRAME AMENDMENT,
  "ROUTING REVERSAL" paragraph): the builder **snaps to trails/roads per
  sport** (reference: Footpath, footpathapp.com) — **paragliding stays
  free-line**, **rivers snap-to-waterway** (clip the OSM river line
  between put-in and take-out — a sibling mechanism to road routing, not
  the same engine), **free-line is the universal fallback** for anything
  else. This supersedes the older "straight-line-only, no routing engine"
  scope that `routes-implementation.md`/`explore-forecasting-research.md`
  §2e still describe — read those for the waypoint/undo/save mechanics,
  not the routing model.
- **"Build online / follow offline" is a locked requirement from the same
  amendment**: planning a route may need signal (snap-routing calls a
  service); but tapping into a SAVED route to follow it must work
  offline — geometry is already local SQLite, so a saved route needs to
  **cache its corridor tiles** so the basemap renders in the field. This
  promotes the previously-deferred offline-tile-pack flag (⚑4 in
  map-tab.md / R8 in the research doc) from "post-MVP ladder" to a real
  requirement, with **a route's bbox as the pack unit**.
- **Route creation has three doors, one build mode** (locked,
  `routes-spec` via map-tab.md §5): (1) "+ New Route" from Training's
  routes-list header, (2) a door inside Explore's takeover state (this
  session), (3) save-as-route from a logged session. Only door 2 is this
  session's scope — the other two already route to wherever the builder
  ends up living.
- **`routes` table already exists** (migration 016) —
  `{id, name, activityId, source: 'plotted'|'session'|'gpx', points:
  RoutePoint[], visibility, notes, createdAt, updatedAt}` — no migration
  needed for the builder itself. `src/storage/routes.ts` has
  `createRoute`/`listRoutes`/`getRoute`/`updateRoute` already.
  `src/lib/mapRoutes.ts`'s `routesForLayer()` (new this pass) is the
  activity→element resolution the My Map layer already uses — reuse it,
  don't re-derive.
- **Sections** (named timed stretches within a route — R1, still a "worth
  a look" not a locked requirement): `explore-forecasting-research.md`
  §2e has the fuller shape (`sections: [{name, startIdx, endIdx}]` riding
  the routes JSON column, no migration, self-vs-self timing only at v1,
  friend-comparison is Ring 4/social). **Design the waypoint data model
  so this stays migration-free later** (the research doc's own note:
  "design undo/edit around waypoints so a future `kind: waypoint|derived`
  lands migration-free") — don't build Sections now, just don't paint
  the builder into a corner that makes it a schema change later.
- **Cohort/friends anything is Ring 4, hard-gated, not this pass** — same
  rule Explore-1 followed (gated stubs in comments if mentioned at all,
  nothing rendered).

## Build prompt (paste this)

```
Read planning/rework/tabs/map-tab.md (the REFRAME AMENDMENT at top,
especially "ROUTING REVERSAL" and "Build online / follow offline" — both
locked, don't relitigate), planning/rework/research/routes-implementation.md
(waypoint/undo/save mechanics — NOT the routing model, which the amendment
supersedes), planning/rework/research/explore-forecasting-research.md §2e
(Sections future-proofing note), core/src/route.ts, src/storage/routes.ts,
src/lib/mapRoutes.ts, app/(tabs)/map.tsx (Explore's current crosshair
branch — the builder's takeover state is new JSX inside that same
`mode === 'explore'` render, not a new top-level mode), src/components/
MapSurface.tsx, and the latest handoff in dev-log/ (map-tab-reframe-
my-map-explore.md).

Build Explore-2, the route builder, on the current stack. Decisions
already locked (don't re-ask): snap-to-trail/road per sport (paragliding
free-line, rivers snap-to-waterway via OSM river clip, free-line the
universal fallback); planning needs signal, following a saved route must
work offline (cache the route's bbox as a tile pack); three creation
doors exist, this session builds door 2 only (a takeover state inside
Explore); routes table (migration 016) needs no schema change.

Scope: (1) entering the builder — a new affordance inside Explore's
crosshair UI (your call on exact placement/label) that takes over the
map surface, suspending the crosshair's own actions while active; (2)
waypoint placement + snap-routing per the locked sport rules above, with
an honest label when a segment fell back to free-line (no signal, or a
sport/terrain combination with no snap mechanism); (3) undo/clear on the
waypoint sequence; (4) live distance + the same "as plotted, never
routed-and-corrected" honesty framing routes-implementation.md already
established for the old straight-line builder; (5) save, writing
`source: 'plotted'` via the existing createRoute(); (6) exit the
takeover state back to Explore's crosshair. Corridor tile-pack caching
for offline follow can be its own sub-scope if it's cleaner as a
follow-up to THIS session's save path landing first — flag (⚑) rather
than silently deferring it if you cut it.

No new top-level mode, no migration for the builder itself (flag if
Sections' future-proofing genuinely can't stay migration-free — don't
silently add a column). Cohort/friends: still not this pass, still
Ring-4-gated. Single-concern commits; flag (⚑) don't reinterpret.

Finish: full jest, tsc LAST, /code-review, sim smoke test (enter the
builder from Explore, place waypoints for at least one snap-routed sport
and confirm it snaps, place waypoints for paragliding and confirm it
stays free-line, undo mid-build, save a route and confirm it appears on
My Map's Routes layer with the correct element tint, exit without saving
and confirm Explore's crosshair still works normally), then status-sync
+ dev-log-closeout skills, and write a handoff prompt for whatever's next
(Forecast-3/windgram, or offline tile-pack caching if it was cut from
this pass). Do not push without asking me.
```

## Notes for whoever picks this up

- The three creation doors aren't all live yet — Training's "+ New Route"
  header button and session save-as-route may not exist as tappable UI
  even if the data model supports them. Check before assuming door 1/3
  work; if they don't, that's separate scope from this handoff, not a
  blocker for door 2.
- `⚑1` from Explore-1's own dev-log (neither `geocode.ts` branch
  live-verified) is unrelated to this build — don't let it block start.
