# Explore-2 — Route builder (takeover state inside Explore)

*2026-07-16. Branch: `main` (local, not pushed — 8 commits ahead of `origin/main`
for this pass, HEAD `1bf3be2`; 34 ahead overall).*

## What was built

Per `planning/rework/tabs/map-tab.md`'s 2026-07-15 REFRAME AMENDMENT (ROUTING
REVERSAL) and `explore-forecasting-research.md` §2e: the route builder now exists
as a **takeover state inside Explore** (creation door 2), plus Training's gated
"+ New Route" button (door 1) deep-linking into it. `source: 'plotted'` had never
had a live writer before this — the builder is its first, and the first writer of
the new `'snapped'`/`'river'` sources too.

- **`core/src/route.ts`** — `RoutePoint` gains optional `kind: 'waypoint' |
  'derived'` (rides the existing `points` JSON, no migration, no serialize
  change — verified `serialize.ts` round-trips whole point objects). `RouteSource`
  widened with `'snapped'` (trails/roads) and `'river'` (OSM waterway clip); free
  TEXT column, union-only change. The future **Sections** shape
  (`sections?: {name,startIdx,endIdx}[]`, indices into `kind:'waypoint'` points)
  is recorded as a doc-note — **no Sections UI built**, lands migration-free later.
- **Routing engine — Valhalla, provider-abstracted (`config.ts`).**
  `valhallaRouteUrl()` prefers a self-hosted `EXPO_PUBLIC_ROUTING_URL` (no key),
  else Stadia's hosted endpoint with `EXPO_PUBLIC_STADIA_API_KEY`, else `null`.
  This is the single swap point for the "free-now (Stadia free tier) → paid
  commercial → self-host, never rewrite" path Dylan asked for (he wants to grow
  this into a business). `OVERPASS_URL` (keyless) for the river clip. No key ⇒
  the builder degrades to free-line — the same "degrade honestly, never block"
  rule the MapTiler endpoints use. `.env.example` documents all three.
- **`src/lib/routeSnap.ts`** (new) — `snapSegment(a,b,mode)`: Valhalla
  pedestrian/bicycle for foot/bike, an OSM waterway clip for river, straight line
  for freeline. `routingModeForActivity()` maps a sport → mode via its engine
  *modality* (run/hike→foot, ride→bike, paddle→river, everything else incl.
  paragliding→freeline). River clip **stitches contiguous OSM ways**
  (`stitchWays`) before clipping — OSM waterways are split across many `way`
  elements, so a reach spanning more than one would otherwise always fall back to
  free-line (code-review finding). All decoders (polyline precision-6, Valhalla
  legs, Overpass ways, stitch, clip) are pure + unit-tested. Every failure →
  free-line segment flagged `fellBack`, never throws.
- **`src/lib/routeBuilder.ts`** (new, pure) + **`src/hooks/useRouteBuilder.ts`** —
  waypoint-keyed state model: add/undo/clear operate on waypoints, each gap
  carries a cached snapped segment; flatten tags each stored point
  `waypoint`/`derived` (join-deduped; free-line ⇒ points === waypoints exactly);
  source-by-mode; honest distance (reuses core `routeDistanceM`) + Manual-Mode
  labeling (never an elevation number). The hook awaits `snapSegment` per gap with
  a `pending` flag and **guards every async apply** against an
  undo/clear/mode-change that lands mid-snap (would otherwise weld a stale segment
  or break the `segments.length === waypoints.length-1` invariant — code-review).
- **`src/components/MapSurface.tsx`** — new `draftRoute` (accent line above saved
  routes) + `draftWaypoints` (accent discs) props, reusing `toLineString` +
  `ViewAnnotation`.
- **`src/components/RouteBuilderOverlay.tsx`** (new) — the takeover chrome: sport
  chip (→ picker) + Snap/Free-line toggle (forced free-line for paragliding),
  Drop point / Undo / Clear / distance+honesty / Save (inline name field). Undo /
  Clear / Save are disabled while a snap is pending (so a Save can't persist a
  route missing the in-flight point).
- **`app/(tabs)/map.tsx`** — `builderActive` takeover on Explore: a "Build a
  route" entry beside the crosshair actions, and a `build=1` deep-link receiver
  (door 1). While active the shared crosshair is the placement reticle (Drop point
  → `getCenter` → `addWaypoint`), the mode switcher + search are suppressed, and
  the builder exits (discarding) on leaving Explore or the map locking for a
  recording. The element picker is reused for choosing the builder's sport
  (`pickerPurpose`). Save → `createRoute`; the route appears on My Map via the
  existing `routesForLayer`.
- **`app/(tabs)/training.tsx` + `app/routes.tsx`** — un-gated "+ New Route → Map
  build mode" (door 1), deep-linking `build=1`; empty states now name both doors.

## Decisions locked with Dylan this session

- **Valhalla via Stadia free tier for dev, provider-abstracted.** Chosen over
  proprietary Mapbox (can't self-host → lock-in) precisely because the same MIT
  engine carries dev → paid-commercial → self-host with only a config change.
- **Rivers: build the OSM-waterway snap now** (with free-line fallback).
- **Offline tiles: DEFER.** Following a saved route offline already works (route
  line renders from local geometry); the basemap *tile* download (⚑4, MapTiler
  terms; clean end-state self-hosted Protomaps) is its own later pass.

## Verification

- **Jest**: 150 suites / **1527 tests pass** (43 new across `routeSnap` +
  `routeBuilder`, incl. the stitch/clip and race-guard-adjacent cases).
- **tsc**: clean (run last).
- **/code-review** (high effort): 2 high + 3 med/low findings; both highs (the
  async-apply races) fixed, plus the river multi-way stitch and pending-gating;
  cleanup (fetchJson POST reuse, dead `retargetMode` removed, `canSaveBuilder`
  wired, teardown deduped). Low findings (interior-waypoint join kink; deep-link
  effect ordering) judged cosmetic / not reachable in real flows — left, noted.
- **Sim smoke test: NOT YET RUN** — see handoff. Blocked on (1) a Stadia API key
  in `.env.local` and (2) a dev build; snap routing degrades to free-line without
  the key, so a true snapped-route test needs it first.

## Flags carried (⚑ — record, don't re-litigate)

- ⚑ Offline **tile-pack** deferred (MapTiler terms; end-state self-hosted Protomaps).
- ⚑ Stadia free tier is non-commercial — **commercial launch = paid Stadia plan
  or self-host** the same MIT Valhalla (config-only swap; why the provider is
  abstracted).
- ⚑ River Overpass clip is best-effort (stitch + free-line fallback); the
  interior-waypoint join can kink a few metres when adjacent gaps snap the shared
  waypoint slightly differently (cosmetic).
- ⚑ `build=1` deep-link relies on effect declaration order to win the mode race
  vs the arm-effect; safe today because Training passes only `build` (not
  activity/element), so the arm-effect doesn't fire.

## Not pushed

34 commits ahead of `origin/main`, unpushed (per standing "don't push without
asking"). Nothing on this branch has left the machine.
