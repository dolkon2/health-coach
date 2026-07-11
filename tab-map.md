# Map Tab

The traverse — the primary logging and browsing surface for outdoor (Earth/Sky/Water) sessions. Body sessions never appear here; the map only shows where you actually went, never a fabricated line.

## Current shape / status

- Bottom nav position: 3rd of 5. Status: **"Not started"** as a tab shell — but the underlying capture/render pieces (RouteMap, ElevationProfile, Splits, GpsRecorderPanel, GPX import) are **already shipped on `main`**, just not wired into a Map tab yet.
- Two modes only: **Record** (MVP) and **Explore** (post-MVP). Everything else is either a layer inside Explore or a step in the Record flow — a strict "bouncer rule."
- A `planning/routes-spec.md` build doc is cited by Notion as landed (2026-07-11) for the route builder/follow feature but **was not found in this repo checkout** — same gap flagged in `tab-training.md`.

## Structural pieces / modules

- **Record mode** — outdoor logging surface. One-tap start from last sport (or a pinned favorite); full-screen map with minimal HUD; stop → details prompted. Replaces the in-logger GPS panel for Earth/Sky/Water.
- **Explore mode** (post-MVP) — browse yourself in the world: your own routes, colored by element (Earth/Sky/Water — Body never appears), filterable by element chips first (sport-hierarchy filtering scales later).
- **Conditions archive** — silent Open-Meteo snapshot captured at every session save, zero UI, accumulating from day one so later correlation ("similar days") has real data on arrival.
- **Route creation** (three entry doors, all landing in the same Map build mode): (1) "New Route" button from Training's Routes list, (2) tapping straight into build mode from within Map, (3) save-as-route after finishing a normal session. Finishing a build prompts a save into Training's Routes list.

## Full-screen features needing their own design pass

### Record mode (MVP core)
One-tap start; background continuation of *user-initiated* recording only (the "4-hour flight in a pocket must survive the screen lock" case — background recording the user didn't start remains banned); offline capture (record blind, render trace on save via RouteMap's existing SVG fallback).

### Map-hero session detail
Replaces the embedded RouteMap card. When geometry exists, the map *is* the reflection surface — stats overlay the route, no separate card. When no geometry (treadmill, pool, gym), stats stand alone; never a fake line. Open question: one screen that flips map-hero vs. stats-only based on geometry presence, or two routed screens?

### Route builder (straight-line, no routing engine)
Tap waypoints + straight segments — a deliberate, partial reversal of the earlier "no drawing" cut. Explicitly **not** a snap-to-trail/routing-engine feature. Tap-gesture feasibility on MapLibre is unverified; a crosshair-drop fallback is specced as a backstop.

### Basic route follow
Route line rendered under the live trace while recording. **No off-route alerts, ever** — navigation aid only, not a coaching nudge.

### Explore mode v1 (post-MVP)
Full-screen map of the user's own routes, colored by element, filter chips (Earth/Sky/Water).

### Cohort map (Ring 4, far post-MVP)
Heatmap of where a cohort has been/frequent routes — descriptive, pull-based. Hard-gated on privacy zones existing first (see Open decisions). Real-time "friend's dot moving" is a *separate* safety feature (LiveTrack/Beacon-style), not bundled into the social map.

## Open decisions

- **Background recording permission model** — `always` location vs. `whenInUse` + persistent notification. Battery/permission-fatigue trade-off.
- **Offline map tiles** — manual "download this box" (Gaia/Windy pattern) vs. automatic caching around home.
- **Session detail architecture** — one flipping detail screen vs. two routed screens (ties to the Training-tab logbook-location conflict — see `tab-training.md`).
- **Conditions snapshot source** — Open-Meteo alone vs. dual-source with a sounding-specific provider (starting with Open-Meteo only).
- **Save-as-route prompt timing** — prompt at record-save time (higher friction, better data) vs. explicit later action from history.
- **Explore filter granularity** — element chips only vs. element × sport hierarchy.
- **Conflict with Training tab:** Map's plan assumes session history/logbook stays on Training tab; Training's latest thinking is to move the logbook to overflow (possibly Profile). This needs a single resolution — flagging it here and in `tab-training.md`.
- `planning/routes-spec.md` is cited as an authoritative landed spec in Notion but is missing from the repo.

## Out of scope

- Body/gym/yoga-type sessions and Nutrition — never appear on Map.
- Fabricated or interpolated route lines — a routeless session shows stats only, never a fake line.
- Global/stranger leaderboards, KOMs, segment crowns — explicitly refused as gamification (constitution rule 5). Cohort-scoped, time-bound course challenges are the one sanctioned exception, and only inside an active challenge (per `cohorts-spec.md`).
- Mid-session push notifications ("PR pace, push harder!") — on-demand display of your own history against a route is fine; unsolicited buzzing is not (pull, not push).
- Forecast display overlays (Windy-style wind/pressure) and natural-language retrieval over the archive — future, explicitly not now; correlation leads, display commodity follows.
- Cohort/shared route map — hard-gated on privacy zones (auto-hiding trace near home/work) existing first; this is a non-negotiable gate per `gps-mapping-spec.md` § Privacy.

## Sources used

- Notion: "Map" page (full game plan, MVP order, post-MVP, "Future Planning" freeform notes on live tracking + heatmaps), "Pages and Features" (Map summary row).
- Repo: `planning/gps-mapping-spec.md` (capture ladder, routes-as-first-class-object, the self-vs-self-vs-strangers privacy line, cohort map, data-model implications), `planning/pinned-spots-spec.md` (spots are points, not routes — clarifies the Map/Training boundary).
- Gap: `planning/routes-spec.md`, cited by Notion as the landed build spec, not present in repo.
