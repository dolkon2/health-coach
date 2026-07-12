# Rework Session 9 — Routes entity + Training shelf + Map follow

**Date:** 2026-07-11 · **Branch:** `main` · **Worktree:** `~/Projects/health-coach`
**Commits:** 7, `cc06ef7..673aa27` on top of `238eff2`
**Model:** Sonnet 5, per session-playbook.md (no pre-session questions for this slot).

## ⚑ The one thing to read first: `routes-spec.md` does not exist in this repo

`map-tab.md` and `training-tab.md` both cite `routes-spec.md` ("REF pins-routes
branch") dozens of times as the authority on the Route entity, its build passes,
and the detail screen. It is **not present anywhere in this repository** —
verified with `git rev-list --all | xargs git ls-tree` across every commit on
every branch and worktree (Sky/Water/Body/Earth/outdoor/benchmarks/fourdim). It
only ever existed in a prior session's scratchpad. `map-tab.md`'s own D0 pass
("land the REF specs... before any M pass") was written to fix exactly this and
was never executed by a prior session.

**What this session did about it:** reconstructed the Route entity's shape from
the two specs' extensive direct quotations of routes-spec's locked decisions
(`RoutePoint[]`, no timestamps, `visibility` default `'private'`, the three
`RouteSource` values, migration 016, the detail-screen shape, the M4 follow
contract) rather than inventing anything net-new. `core/src/route.ts`'s header
documents this. **Recommend running D0 for real** (copy the actual pins-routes
files into `planning/`) before any future Routes/Map pass, so the next session
isn't reconstructing from citations again.

## What shipped

Scope per the session prompt: **Routes entity, browse-only Training shelf, and
route-follow on Record.** The straight-line builder itself (routes-spec P3/P4,
map-tab M5/M6) is correctly out — gated on the Explore surface, Phase 4.

1. **Route entity (P1)** — migration 016 (`routes` table; 016 was reserved for
   this by 017's own header comment and the migrations index, confirmed free).
   `core/src/route.ts`: `Route`/`RoutePoint`/`RouteSource`, `routeDistanceM`
   (pure haversine fold — "distance as plotted," never routed). `src/storage/
   routes.ts`: CRUD mirroring `spots.ts`'s shape (nearest precedent).
2. **Finish-tagging plumbing (M4)** — `routeId?` added to `EnduranceBlock`/
   `SkyBlock` (same omit-when-absent pattern as `spotId`), threaded through
   `SessionForm` → `buildSessionObservation` and `RecordingSaveInput` →
   `recordingSessionForm`. `listSessionsForRoute` (single-route efforts list)
   and `countSessionsByRoute` (batch counts, one table scan) read it back.
3. **Guide-line rendering** — `RoutePreview`/`RouteMap` widened from `GeoPoint[]`
   to the structural `LatLng` (core/geo.ts) so a timestamp-less `RoutePoint[]`
   satisfies them with no wrapper code. New `routeGuidePathsD`: projects a live
   trace AND a muted guide route against **one shared bounding box**, so the
   two lines stay spatially comparable (verified visually on-sim — see below).
   `MapSurface` gains a muted dashed `guidePath` line. `toLineString` (GeoJSON
   projection) extracted to `geoJson.ts`, shared instead of duplicated.
4. **Route-follow on Record (M4)** — `app/(tabs)/map.tsx` reads the `routeId`
   deep-link param, shows a live "Following {route}" preview pre-start (only
   when the loaded route's sport matches the armed sport), and **pins** the
   route to the specific recording at the moment Record is tapped
   (`pinnedFollowRoute`) rather than re-reading the live param at stop time —
   this was a real bug caught by review, see below. Finish tags the saved
   session's `routeId`.
5. **Browse-only Training shelf (T3-equivalent)** — `RouteCard` (icon+tint,
   SVG thumbnail, distance, effort count), 2 most-recent + "Routes →". No
   "+ New Route" button — correctly withheld until Map's builder exists.
6. **Full list + detail screens** — `app/routes.tsx` (list, "Import GPX" door),
   `app/route/[id].tsx` (map-hero, distance/source/notes, "Start session on
   this route", efforts list). Mirrors `app/spots.tsx`/`app/spot/[id].tsx`.
7. **GPX-import creation door** — the **only** route-creation path built this
   session (see scope note below).

## Scope note: only one of three creation doors exists

routes-spec names three creation doors: (1) Map's builder — correctly deferred
to Phase 4; (2) save-a-logged-session-as-a-route (P2.5, a `log-session.tsx`
affordance) — **not built**; (3) GPX import — **built**, on `app/routes.tsx`.
Without at least one working door the entity+shelf+follow this session builds
would have nothing to browse or follow, so GPX import shipped to make the
feature real and demoable end-to-end. Save-as-route was not in the session
prompt's literal scope and wasn't added — flagged, not silently expanded.

## Code review (high effort, 8 finder angles → verify → fix)

8 findings, 4 fixed, 4 flagged-not-fixed (all confirmed real but low-severity
or out of proportionate scope):

- **Fixed — `followRoute` misattribution (correctness, the serious one):** the
  original design read `followRoute` live at stop time. Verified reachable in
  three ways: (a) re-arm to a different sport after loading a route still
  tagged the old route onto the new sport's session; (b) a recovered orphan
  from an unrelated earlier recording could inherit whatever route happened to
  be loaded at recovery time; (c) `followRoute` never cleared after save, so a
  second unrelated recording in the same visit inherited the stale tag. Fixed
  by pinning the route to the specific recording at `onRecord()` time
  (`pinnedFollowRoute`, never re-read live) and never tagging a route on the
  recovery-banner path at all (`onStopToSave({fromRecovery: true})`).
- **Fixed — GPX-to-sky-activity mismatch (correctness):** the route-creation
  activity picker gated with `recordsOnMap()` (true for gps AND sky) instead
  of `pairTrackFormat(a, 'gpx')` (gps-only) — a GPX file could be tagged onto
  a paragliding route, a combination nothing else in the app expects. Fixed.
- **Fixed — N+1 session-table scan (efficiency):** `listSessionsForRoute` was
  called once per route on every screen focus (unbounded on the full list,
  bounded to 2 on the shelf) — N full re-scans/re-parses of the session table
  instead of one. Added `countSessionsByRoute` (one scan, grouped in memory).
- **Fixed — duplicate `toLineString` (reuse):** `MapSurface.tsx` had pasted a
  byte-identical copy of `RouteMap.tsx`'s GeoJSON conversion. Extracted to
  `geoJson.ts`.
- **Flagged, not fixed — icon/tint resolution duplicated 4×** (`RouteCard`,
  `TemplateCard`, `RecentTemplateChip`, route detail) — real, but extracting
  it means touching two pre-existing files outside this session's diff for a
  cosmetic-only win; deferred rather than expanding blast radius late in a
  large session.
- **Flagged, not fixed — `onImportGpx`/`onImportTrack` boilerplate overlap**
  (reuse) — verified as a partial shell-only overlap (post-read logic
  genuinely differs); extraction risk didn't clear the bar this session.
- **Flagged, not fixed — `RouteCard`'s unmemoized `routeDistanceM`**
  (efficiency) — verified negligible (points capped at 4000, sub-millisecond
  even at that cap per benchmark).
- **Flagged, not fixed — `RoutePreview`'s guide-path re-projection on every
  live-recording render** (efficiency) — verified negligible AND the
  reviewer's own proposed fix (`useMemo` keyed on `guidePath` alone) would be
  **incorrect** — it would break the intentional shared-bounding-box spatial
  comparability with the evolving live trace. Recorded so a future attempt
  doesn't repeat that mistake; the only safely-cacheable piece is
  `thinForDraw(guidePoints)` in isolation.

## Verification

- `npx jest`: **125 suites / 1307 tests** green (was 123/1286 at session start).
  `npx tsc --noEmit`: clean, run LAST.
- **Sim smoke (iPhone 17, iOS 26.4, relaunched to pick up migration 016 +
  all new code):** seeded 2 sample routes via the extended dev-seed tool →
  Training shelf renders both cards correctly (icon/tint/thumbnail/distance)
  → Routes list + "Import GPX" door render → route detail (real MapLibre
  map-hero, distance, source, honest "no sessions yet" empty state) →
  "Start session on this route" deep-links to Map with "Following Hood River
  Loop" shown → simulated a short GPS walk (`simctl location set` × 3) →
  live-recording SVG preview **visually confirmed** the muted dashed guide
  line and the solid live trace sharing one bounding box exactly as designed
  → Stop → Save → effort count badge updated to "1 session" on the shelf AND
  the route detail's efforts list. Also incidentally verified the
  insufficient-points discard path (an earlier static-location attempt with
  <2 fixes was silently and correctly discarded). No red-screen errors or
  console exceptions throughout. Test artifact (the one logged "run" session)
  was deleted afterward via Profile's swipe-to-delete; the 2 sample routes
  were left in place per the skill's "leave seeded for tap-through" guidance.

## ⚑ Flags (judgment calls made; flag, don't reinterpret)

- **⚑ routes-spec.md absence** — see top of this entry. D0 (landing the REF
  specs) should run for real before the next Routes/Map/Explore pass.
- **⚑ Only GPX import built as a creation door** — save-as-route (P2.5) and
  the Map builder (M6) are both still missing; the Routes feature is real but
  has exactly one way in until a future session adds save-as-route.
- **⚑ Route-follow does not survive an app-kill-and-recover.** The
  `recording_sessions` buffer table (migration 017, shipped — never
  hand-edited) has no `routeId` column. A killed-and-recovered recording
  saves routeless rather than risk a wrong tag. Review surfaced that the
  table already has an **unwired `meta TEXT` JSON column** (declared in the
  schema, never read/written by `recordingBuffer.ts`) that could carry this
  through recovery in a future pass without a new migration — noted for
  whoever picks this up, not built this session (would have meaningfully
  grown an already-large fix).
- **⚑ Distance is never stored** — `routeDistanceM` computes it from `points`
  on every read (a pure haversine fold, cheap even at the 4000-point ceiling).
  No column, no drift-risk between a stored number and the geometry.
- **⚑ Reuse/efficiency debt flagged, not churned** (see code review section
  above): icon/tint resolution ×4, `onImportGpx`/`onImportTrack` shell overlap,
  `RouteCard` memoization, `RoutePreview` guide re-projection.
- **⚑ `RoutePoint` has no `kind: 'waypoint'|'derived'` field** — the research
  doc anticipated this for a future snap-to-trail builder; MVP straight-line
  geometry makes points==waypoints so there's nothing to distinguish yet. No
  schema change needed until a builder actually lands.

## Status / handoff

- **main @ `673aa27`**, 7 commits ahead of Session 8's close-out
  (`86e0fea`), NOT pushed (standing pattern this project follows).
- Working tree clean apart from the pre-existing untracked files noted in
  Session 8's own dev-log (`planning/nutrition-tab-v2-spec.md`,
  `planning/rework/research/fable-session-prompts.md`, `.claude/skills/`) —
  none of these are this session's work; left untouched.
- Sim left on Home tab, sample data loaded (2 routes: "Hood River Loop" /run,
  "White Salmon — Green Truss run" /kayak — both tagged `__sample__`, clearable
  from Settings), Session 8's own leftover "PADDLE" test session from its
  sim-smoke-test is still present in the logbook (pre-dates this session,
  not cleaned up here — flagging rather than unilaterally deleting another
  session's artifact). Simulated GPS location cleared.
- **status-sync NOT yet run** — running next per the skill's own stated
  order (after dev-log-closeout, not before).
- **Ready for Session 10** (the rebrand swap PR) per the playbook. Routes
  save-as-route + Map's builder remain open for a later Phase-4 pass.
