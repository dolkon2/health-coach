# Routes — build spec

v1 — specced with Dylan 2026-07-11, following the Pinned Spots split (spots → Home; routes get
their own home). Companion to `gps-mapping-spec.md` § Routes as a first-class object and
§ Placement — creation on Map, list in both places. Codebase facts verified against the working
tree on 2026-07-11 (branch `claude/pins-vs-routes-ycob8q`, main HEAD ancestry `17e252f`+).

**Amended same day:** the entity, storage, list, and detail (P1/P2) are ready to build now. The
map **builder + follow are DEFERRED** — folded into Dylan's in-progress Map Explore/layers work
rather than a standalone screen; see § Surfaces 3 for the current shape of that deferral.

## What it is

**A saved, reusable line.** A Route is first-class geometry — name + course + the set of your
own efforts on it — that you can browse (Training list), view (map + distance), build (on the
map), and follow (line on the map while recording). One `Route` record, referenced from the Map
(create/view/follow), Training (list), and eventually cohorts (sharing scope).

**What it is NOT:**
- Not a Spot. A Spot is a point + live conditions (`pinned-spots-spec.md`); a Route is a line
  with no conditions feed.
- Not a Session. Sessions are what happened (tier 1); a route is a recipe, like a
  SessionTemplate — no timestamp of occurrence, no fidelity, never on the timeline.
- Not a segment/leaderboard. Self-vs-self only; the KOM/segments pattern is explicitly refused
  (`gps-mapping-spec.md` § The line).

## Decisions locked (Dylan, 2026-07-11)

- **Straight-line plotting is IN — a deliberate, partial reversal of a documented cut.**
  `gps-mapping-spec.md`'s capture ladder cut "drawing a route by tracing it on the map." Dylan
  reconsidered with the Routes home settled: MVP build mode is **tap-to-place waypoints with
  straight segments between them** — no routing engine, no snap-to-trail (that stays out;
  Footpath-style auto-routing is a possible later layer, not this build). Flagged, considered,
  overridden; the cut note in gps-mapping-spec is amended, not silently contradicted.
- **Three doors into creation, one build mode** (gps-mapping-spec § Placement):
  1. "New Route" button (Routes list header) → map build mode.
  2. Tap-in from the map surface itself.
  3. Save-as-route after a logged session (after-the-fact promotion of an actual trace).
- **Basic follow is IN scope:** while recording a GPS session, a chosen route renders as a
  second line under the live trace. **No off-route detection, no alerts, no turn cues** — the
  line is on the map, the user navigates themselves. (Alerts would edge toward the app leading;
  a visible line is descriptive.)
- **List lives on Training** (alongside Templates); creation/viewing is map-native. Not
  Profile — rejected Strava's routes-under-Profile pattern.
- **Map tab shell is NOT this build.** Per the Notion Map game plan, the shell (Record ↔
  Explore) and Record-MVP big rocks (one-tap start, background continuation, offline) are their
  own track. This build mounts thin (below) and re-homes when the shell lands — same play as
  Pinned Spots' temporary Training link.
- **Private-only at MVP, sharing-ready schema.** `visibility` exists from day one
  (`'private'` only value for now) per the constitution's Ring-4 forward reference: visibility
  becomes a permission change, not a schema migration. No route is ever cohort-visible before
  privacy zones exist (hard gate, gps-mapping-spec § Privacy).

## Existing foundation (verified 2026-07-11)

| Piece | Where | State |
|---|---|---|
| Map render (MapLibre v10, MapTiler key, SVG fallback) | `src/components/RouteMap.tsx` | shipped; renders ONE path prop; no gestures, no multi-line |
| SVG trace fallback | `src/components/RoutePreview.tsx` | shipped — reuse as the list-card thumbnail (no GL map per row) |
| Live phone tracking | `src/hooks/useGpsTracker.ts` + `GpsRecorderPanel.tsx` | shipped, foreground-only; emits `GeoPoint[]` via `summarizeTrack` |
| GPX import | GPS logging surface (beside the recorder) | shipped; converges on the same `GeoPoint[]` |
| Haversine + track summary | `core/src/geo.ts` (`haversineM`), `src/lib/gpsTrack.ts` | shipped, pure |
| Elevation / splits display | `ElevationProfile.tsx`, `Splits.tsx` | shipped; both need per-point timestamps/elevation — see honesty notes |
| Session GPS payloads | `core/src/observation.ts` — `gpsPath?: GeoPoint[]` (:234, :307), `SkySegment.track` (:509) | shipped |
| Template precedent (recipe entity, own table) | `core/src/sessionTemplate.ts`, migration 005 | the pattern Route copies: not an Observation |
| `GpsTemplateShape` | `core/src/sessionTemplate.ts:73` | target-distance only; gains optional `routeId` (see data model) — NOT upgraded to carry geometry itself, resolving gps-mapping-spec open question #2 in favor of a separate `Route` entity that templates reference |
| Session detail | `app/log-session.tsx` (`editId` param) | save-as-route affordance goes here, beside save-as-spot |

Migration numbering: **010–013 burned; 015 is reserved by `pinned-spots-spec.md`
(`spots_sport`). Routes takes 016.** If Spots hasn't built by the time this does, 015 stays
reserved — do not take it.

## Data model (Pass 1)

**Migration 016 `routes`:**

```sql
CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  activity TEXT,               -- activity id from src/lib/activity.ts (icon for free); nullable
  points TEXT NOT NULL,        -- JSON RoutePoint[]
  distance_m REAL NOT NULL,    -- derived at save via haversine; cached for list cards
  source TEXT NOT NULL,        -- 'plotted' | 'session' | 'gpx'
  source_session_id TEXT,      -- when source='session': the promoting session's observation id
  visibility TEXT NOT NULL DEFAULT 'private',  -- 'private' now; cohortId later (Ring 4)
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**`core/src/route.ts` (pure, platform-free):**

```ts
export type RoutePoint = { lat: number; lng: number; eleM?: number };  // NO timestamp
export type RouteSource = 'plotted' | 'session' | 'gpx';
export type Route = {
  id: string; name: string; activity?: string;
  points: RoutePoint[]; distanceM: number;
  source: RouteSource; sourceSessionId?: string;
  visibility: 'private';        // widens to `'private' | { cohortId: string }` at Ring 4
  notes?: string;
  createdAt: ISOInstant; updatedAt: ISOInstant;
};
export function routeDistanceM(points: RoutePoint[]): number  // fold haversineM
```

`RoutePoint` deliberately has **no `tsSec`**: a route is geometry, not a performance. Promoting
a session trace strips timestamps (the effort's pace stays on the Session, where it belongs).
This is why `GeoPoint` isn't reused directly — `GeoPoint.tsSec` is required there.

**Backlinks (payload JSON, no migration):** `routeId?: string` on `EnduranceBlock` and the GPS
session shape (wherever `gpsPath` lives), plus `SkySegment` if flying wants it later (skip at
MVP). Set when a session is started from / associated with a route. This is what powers the
efforts-on-this-route list.

**`GpsTemplateShape.routeId?: string`** — a template can *reference* a route ("Tuesday loop,
zone 2") without embedding geometry. Resolves gps-mapping-spec open question #2: separate
entity, referenced.

**Storage:** `src/storage/routes.ts` — CRUD modeled 1:1 on `src/storage/spots.ts` /
`sessionTemplates.ts` (create/list/get/update/delete, serialized points JSON, tested).

## Surfaces

### 1. Routes list (Pass 2)
- MVP mount: **"Routes →" header link on the Training tab** (`app/(tabs)/training.tsx`, the
  existing links row) — same deliberately-thin play as Spots' original mount; re-homes into the
  Training shelf properly when tab shells land. Route: `app/routes.tsx`.
- Cards: name, activity icon, distance, `RoutePreview` SVG thumbnail (never a GL map per row),
  effort count when > 0. Sort: `updatedAt` desc.
- Header: **"+ New Route"** → build mode (door 1). Empty state explains all three doors.

### 2. Route detail (Pass 2)
- Route: `app/route/[id].tsx`. `RouteMap` hero + name, activity, distance, notes.
- **Elevation honesty:** plotted routes have no elevation data — show nothing, not a flat
  fake profile. Session-promoted routes keep `eleM` where the trace had it. DEM lookup for
  plotted routes is post-MVP (gps-mapping-spec open question #3).
- **Efforts list:** sessions whose payload carries this `routeId`, newest first, existing
  `SessionCard`; tap → `log-session?editId=…`. This is the self-vs-self mirror — purely a list
  of what happened; no targets, no "beat your best" framing. No proximity auto-matching at
  MVP (post-MVP, same ladder as Spots').
- Actions: rename / notes / re-tag activity / delete (confirm; sessions keep their trace,
  `routeId` dangles harmlessly — same design as spot deletion). **"Start session on this
  route"** → GPS logging surface with the route preloaded for follow (Pass 4).

### 3. Builder + follow (Pass 3/4) — DEFERRED, folds into Map's Explore surface

*Amended 2026-07-11 (Dylan): dropped the standalone `app/build-route.tsx` modal this section
originally specced. Dylan is already mid-build on Map's Explore/layers work (an "Explore" or
"Now" surface — not yet documented in this repo). Rather than stand up a parallel proto-Map-tab
for the builder, **route building and following become a mode/layer inside that existing Explore
surface**, alongside whatever else lives there. This section is deliberately left thin — a
placeholder for the real design once the Explore work is visible — rather than specced against
a screen that doesn't exist yet.*

**What still holds regardless of where the UI lands** (unchanged from the decisions above):
- Build mode is tap-to-place waypoints, straight segments, no routing engine.
- Three creation doors — new-route button, tap-in from the map, save-as-route from a session.
- Follow renders the route as a second, muted line under the live trace; no off-route alerts.
- Tap gesture on MapLibre v10.4.2 is unverified — crosshair-button fallback still applies
  whatever surface it ends up on. Coordinate the spike with Spots Pass 4 (one investigation,
  shared by both consumers).

**What's now open, pending the Explore work:**
- Where exactly build mode and follow live inside Explore — a distinct layer toggle, a mode
  within a mode, or something else. Don't guess ahead of that design.
- Whether "Start session on this route" still routes through Route detail → GPS logging, or
  whether following starts directly from the Explore layer.
- **Save-as-route** (not deferred — no map-builder dependency, it's a `log-session.tsx`
  affordance, not a map surface): in `app/log-session.tsx` edit mode, when the session has a
  track (`gpsPath`/`track`) — "Save as route": strips timestamps,
  prefills activity, user names it, writes `routeId` back onto the block so the session appears
  as effort #1. Sits beside save-as-spot; resolves the Notion Map plan's open question #5 as
  **explicit later action from history** (low friction), with an optional save-prompt at
  record-stop deferred.
- **Follow (deferred, spec unchanged):** `RouteMap` gains an optional second path prop
  (`guidePath?: RoutePoint[]`),
  rendered as its own ShapeSource/LineLayer (muted color, under the live trace).
  `GpsRecorderPanel` accepts an optional preloaded route (from "Start session on this route")
  and shows it while tracking. Finishing tags the session's block with the `routeId`. No
  off-route math anywhere.

## Constitution check

- Descriptive: a route never carries a target time/pace; efforts are a list, not a scoreboard.
- No push: nothing suggests routes; the library of routes is user-authored, pull-only.
- Tier honesty: routes are recipes (like templates), never Observations; an effort is the
  tier-1 fact. Follow shows a line, it never coaches ("off route!" alerts stay out).
- Privacy: private-only; `visibility` schema-ready; cohort exposure hard-gated on privacy zones.

## Build passes

Single-concern commits, jest per pass, `tsc` last.

- **P1 — core + storage:** `core/src/route.ts` (+ barrel export), migration 016,
  `src/storage/routes.ts`, `routeId` backlinks on payload types, `GpsTemplateShape.routeId`.
  Tests: distance derivation, CRUD round-trip, migration.
- **P2 — list + detail:** `app/routes.tsx` + Training header link; `app/route/[id].tsx` with
  efforts query (`listSessionsForRoute` — JS scan over payloads, same rationale as
  `listSessionsForSpot`); edit/delete.
- **P2.5 — save-as-route:** `log-session.tsx` affordance; independent of the Explore work,
  buildable any time after P1/P2.
- **P3/P4 — builder + follow: DEFERRED**, pending Dylan's Map Explore/layers design. Scope
  (tap-spike → crosshair fallback; undo/clear/save; `RouteMap.guidePath`; recorder preload +
  `routeId` tagging on finish) carries over unchanged — only the host surface (a mode/layer
  inside Explore, not a standalone `app/build-route.tsx` modal) is now open. Re-spec the exact
  screen once Explore's shape is visible.

**Post-MVP ladder (recorded, not built):** DEM elevation for plotted routes; snap-to-trail /
auto-routing engine; off-route indication (if ever — constitution review first); proximity
effort-matching; save-prompt at record-stop; route → template deep integration (recurrence);
GPX export; cohort sharing + privacy zones (Ring 4).

## Flags ⚑ (for Dylan)

1. **Builder + follow host surface is now open, not decided** (2026-07-11) — originally
   speced as a standalone `app/build-route.tsx` modal; deferred and re-scoped to fold into
   Map's Explore/layers work once that design exists. Everything about *what* the builder does
   (tap-to-place, straight segments, three doors, muted follow line) is still locked; only
   *where it lives inside Explore* is open. Don't let this quietly turn into "routes got cut" —
   it's a placement deferral, not a scope cut.
2. **The drawing-cut reversal is now on the record** — straight-line only; if snap-to-trail
   ever comes back, that's a new decision (routing engine, API cost, offline story).
3. **Map tap gesture unverified** on MapLibre v10.4.2 — crosshair fallback specified; share the
   spike with Spots Pass 4 (still relevant whichever surface the builder lands in).
4. **Plotted routes show no elevation** until a DEM source is chosen — honest gap, not a bug.
5. **Follow needs the recorder** — foreground-only today; a 3-hour follow with the screen off
   drops fixes. Real fix is the Map-tab Record background work, not this build. Follow ships
   with that known ceiling.
6. **Distance-unit display** reuses `metersToDisplay` + settings; list cards and the eventual
   builder readout must respect it (easy to miss in new UI).
7. **Efforts list vs. logbook location** — the sessions-under-route list is another partial
   answer to "where does the logbook live" (same tension Spots flagged #3). Raise at the
   Training tab talk-through.
