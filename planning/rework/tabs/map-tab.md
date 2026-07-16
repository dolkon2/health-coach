# Map tab — consolidated spec

v1 — 2026-07-11, product-rework planning pass; one of the 8-spec set under
`planning/rework/tabs/`. Authority: REF pins-routes `gps-mapping-spec.md` / `routes-spec.md` /
`pinned-spots-spec.md`, REF map-nav `gps-mapping-spec.md` (background amendment),
`planning/rework/research/gps-recording-expo.md` + `routes-implementation.md`,
`planning/mapping-architecture-spec.md`. Siblings referenced by path.

## ⚠️ REFRAME AMENDMENT — 2026-07-15 (supersedes conflicting text below; source of record = Notion "🗺️ Explore & Forecast — Build Map")

The Map tab is now **two live modes: My Map | Explore** — Record is no longer its own mode.

- **My Map** (the landing, was "Record"): your established world — pinned spots + saved
  routes + your own traces, with the **log/record action front-and-center** (recording
  still takes over the screen when live, but launches from here). **Long-hold → pin a
  spot** (My Map's creation door).
- **Explore** (expanding your world): a fixed **center crosshair reticle** (pan the map
  under it, Windy-style) with two explicit actions for wherever it points — **"View
  forecast"** (opens the forecast sheet for that coordinate, nothing saved) and **"Pin
  this location"** (creates a spot there). Dylan's refinement 2026-07-15: this replaces
  raw tap-anywhere (cleaner + precise) and makes the crosshair the **primary** placement
  model — **retiring the tap-gesture spike** the old spec carried as a risk. Also:
  scouting river levels/conditions, and the route builder (takeover state).
- **Base chrome on BOTH modes:** location search (MapTiler geocoding on the existing key)
  + a live-position **blue dot**.
- **No standalone Forecast mode** until the wind arrow/color overlay (v2) earns its own
  home; until then forecast lives on spot detail (forecast-tab.md F1–F3) and in Explore's
  crosshair "View forecast".
- **ROUTING REVERSAL (supersedes §5's straight-line-only lock):** the builder **snaps to
  trails/roads per sport** (Footpath = reference, footpathapp.com); **paragliding stays
  free-line**; **rivers snap-to-waterway** (clip the OSM river line between put-in and
  take-out — a sibling mechanism, not a road-routing engine); **free-line remains the
  universal fallback**. **Build online / follow offline:** planning a route may require
  signal (snap-routing calls a service); **tapping into a SAVED route to follow it must
  work offline** — geometry is already local SQLite, and a saved route should **cache its
  corridor tiles** so the basemap renders in the field. This **promotes the deferred
  offline tile-pack flag (⚑4/R8) into a real requirement**, with a route's bbox as the
  pack unit.

Everything below predates this amendment; where it says "Record ↔ Explore," "two modes
only: Record," or "no routing engine / straight-line only," this block wins.

## 1. Purpose & constitution alignment

The Map tab is where geometry happens: GPS capture (Record mode) and, later, map browsing and
route building (Explore mode). It is the mirror applied to geography — **the app ingests a
track or records one; it never fabricates one** (gps-mapping-spec's one rule). Everything here
is pull: the user starts every recording; background *continuation* of a user-initiated
recording is required (a 4-hour flight survives a pocket and a locked screen) — what's banned
is recording the user didn't start; pull-only applies to *initiation* (map-nav amendment
2026-07-10; obvious call: the consolidated `gps-mapping-spec.md` must union this amendment
with pins-routes' § Placement work, whose copy still carries the old "never in the background"
wording — pass D0, §7, owns executing that union). No off-route alerts, no mid-run push, no
KOMs/segments — self-vs-self only. Body sessions
never appear on any map surface (constitution § four dimensions): Body is infrastructure, not
geography, and its fixed indoor locations are exactly the location data the privacy rules
protect. Fidelity on GPS sessions is a quiet provenance tag, never an organizing axis.

## 2. Information architecture / layout

**Two modes only: Record (MVP) ↔ Explore (post-MVP).** At MVP the tab *is* Record — no mode
switch renders until Explore ships (obvious call: no dead toggle).

**Header chrome:** the shell-standard avatar + gear cluster (locked #1; `profile-settings.md`
§2 — fixed right-side pair, every tab) renders here like everywhere else, floating over the
full-bleed map; "full-bleed" means the map runs under translucent header chrome, not that the
shell controls disappear. The sport arm control takes the header's left/center per that same
rule (the right side is spoken for). Decision (obvious call): the cluster persists in Record's
live state too — recording survives navigating away (M2's background task stack; a known
foreground caveat at M1), so suppressing the shell to "protect" a recording would solve
nothing and quietly break locked #1.

**Record, pre-start state** (the tab's landing):
- Full-bleed map centered on the user, with the **Pinned Spots pin layer** (sport-icon pins
  from the `spots` table; tap → push `app/spot/[id]`). Spots *list/glance* lives on Home
  (`home-tab.md`, locked #11); the Map renders them in place.
- **Sport arm control** (header control, not a sub-tab — Decision, obvious call: keeps the map
  full-bleed): pre-armed by the Home deep link, else last-used; consumes the same
  recent/pinned-activities preference as Training's picker and Home's element picker. Freely
  switchable before record — the deep link's choice is a default, not a lock (home-tab-spec).
- Arming a sport loads that element's map layers and Pinned-Spots context (Water → river spots
  + gauge context). Mapping-architecture Layer 5: style sources toggled by activity identity —
  one switch, not five maps.
- **Record button** + GPS accuracy chip.

**Record, live state:** live trace; stats strip (elapsed, distance, current speed/pace per
sport); manual pause/resume (user-initiated = a fact; **no auto-pause** — §4); Stop.
Backgrounded: Android persistent notification ("Recording session / GPS is on until you stop
the session"), iOS background-location pill; no map rendering (battery).

**Record, save state:** Stop → save sheet: confirm activity, optional name/notes, route
association if followed, save or discard (discard confirms). Save writes the session
Observation and silently freezes conditions (§4).

**Explore (post-MVP stub):** Dylan is mid-build on an Explore/"Now" surface not yet documented
in this repo (routes-spec § Surfaces 3). Deliberately stubbed here: a browse map with togglable
layers (spots, saved routes, own traces; cohort layers Ring-4-gated) and the **route builder as
a mode/layer inside it**. Only the builder's *behavior* is locked (§5); its placement inside
Explore is open (⚑5) — do not design ahead of Dylan's work.

## 3. Components & states

| Component | Notes |
|---|---|
| `MapSurface` | `RouteMap` extended: spots pin layer, live-trace source, optional muted `guidePath` under the trace, direction arrows + start marker on route lines (research adopt #3) |
| Sport arm control | Registry-driven (`activity.ts`), element-grouped; icons free |
| Record button + accuracy chip | acquiring (spinner) / poor (>50 m, "weak signal — points may scatter") / good |
| Live stats strip | Units via `metersToDisplay` + settings everywhere |
| Save sheet | Activity confirm, name/notes, save/discard |
| Recovery banner | On launch with an orphaned recording: "finish the partial session" (§4) |
| "Import a track" door (M2) | Quiet pre-start affordance → `parseGpx`/`parseIgc` → save sheet (§5 Ingestion); unparseable file named plainly, nothing written |
| Spot pin + callout | Tap → spot detail push; creation stays the modal pin picker (pinned-spots P4) until Explore lands, then map long-press becomes a door |

**Empty:** pre-start with zero spots is just a map — no upsell, no "add your first spot" nag
(absent, not empty). Explore with nothing recorded shows the basemap, nothing else.

**Loading:** map style → neutral skeleton; GPS acquiring → chip state, Record disabled until
first fix.

**Permission states:** undetermined → rationale sheet before the OS prompt, using the research's
honest sentence: *"the app cannot see your location except during a session you started"* —
**While Using the App is the only permission ever requested, on both platforms**
(gps-recording-expo §3: no "Always" grant needed). Denied / services off → descriptive state +
settings link, no guilt.

**Tile/key states:** Decision (obvious call, per research): **OpenFreeMap becomes the keyless
default basemap; MapTiler the keyed upgrade** (outdoor/topo cartography). One config change in
style resolution; SVG fallback remains for the no-native-module case only — no "map needs a
key" dead state anywhere. Offline: recording is unaffected (GPS is receive-only — worth a help
line in Record); tiles render from cache or a blank grid, trace still drawn.

**Error states:** task-start failure surfaced plainly; write failure at save → buffer
retained, retry offered; Android mocked-location fixes tag the session rather than pass
silently.

## 4. Data touchpoints (descriptive — no code here)

- **Sessions (tier 1, sovereign):** Record writes ordinary session Observations into the
  existing `gpsPath` / Sky `track` payload shapes (`GeoPoint[]` canonical; GeoJSON only at the
  render boundary — mapping-architecture Layer 3). Fidelity = quiet provenance tag (phone
  trace slightly under watch import). Raw fixes are the fact: **persist every fix passing a
  minimal sanity gate; filter/derive at read time** (research §5). Never simplify the session
  trace.
- **Recording buffer (new storage):** the background task appends point batches to a
  crash-safe buffer table with an active-recording marker — SQLite is the recording, React
  state a cache (research §8). A new table → claims the **next free migration number at build
  time** (015 `spots_sport` → 016 `routes` → 017+ contested; coordinate with the consolidated
  ledger). Buffer clears on save/discard; on relaunch, marker + task check drive recovery.
- **Derived stats (tier 2, computed not stored):** moving vs elapsed derived post-hoc from
  the stored track (no live auto-pause — Decision, obvious call, research §6: record
  everything, derive the reading, show both); distance with its honest band (±2–10% forest,
  ±1–3% open sky); elevation gain from smoothed GPS with hysteresis, band labeled. Barometer
  fusion is a fast-follow — most phones *do* have one; adopt the research's correction of
  gps-mapping-spec's "no barometric altimeter" line (Decision, obvious call).
- **Silent conditions snapshot on save** (the Notion Map plan's "most compounding MVP item"):
  freeze weather at the track's start point/time through the existing backdate-correct freeze
  clients (the Sky-build pattern), stored on the session payload. Never touches the
  live-display path; `conditions_snapshots` stays the insert-only per-spot freeze store.
- **Routes:** `routes` table = migration 016, owned by routes-spec P1 (`RoutePoint[]`, no
  timestamps, `visibility` default private from day one). Builder writes `source: 'plotted'`
  (no elevation — honest gap until a DEM source is chosen); save-as-route promotion writes
  `source: 'session'` with the copy RDP-simplified (~5–10 m tolerance; a route is a recipe,
  simplify freely — the session trace, never). Sessions backlink `routeId` in payload JSON —
  no migration. Builder data-model note: design undo/edit around *waypoints* (MVP points ==
  waypoints) so a future `kind: waypoint|derived` lands migration-free (research adopt #5).
- **Spots:** reads `spots` (+ migration 015 sport column) for the pin layer; creation writes
  via the pinned-spots flows.
- **Sharing/privacy schema:** routes already carry `visibility`. Per-*session* visibility
  scoping is Social's seam (`social-tab.md`); Map adds nothing to it and must not foreclose
  it. Privacy zones are a future entity, schema'd nowhere yet — a hard-gate prerequisite row
  in any Ring-4 plan (§6).

## 5. Interactions & cross-tab flows

Locked routing, verbatim: **Log Session (Home log bar) opens an Earth/Sky/Water/Body element
picker; Earth/Sky/Water rows lead with most-recent activity, route to Map Record with sport
armed; Body routes to Training template/session selection** (locked #6). **GPS capture lives
on the Map tab (Record mode)** (locked #7). **Routes are created on Map (straight-line builder
etc.), and the route library is browsed on Training. History (logbook) is on Profile; routes
are reusable assets, not history** (locked #8).

- **Home → Record deep-link contract:** element + activity id, optional template shape (an
  E/S/W-surface template arms Record with its target), optional `routeId` (start-on-route).
  Until M1/M2 land, Home's interim routing (`log-session` with activity pre-selected) applies;
  Home pass H6 swaps it (`home-tab.md`).
- **Route creation — three doors, one build mode** (locked; routes-spec): (1) "+ New Route"
  from the Training routes-list header; (2) tap-in from the Map surface; (3) save-as-route
  from a logged session (`log-session.tsx` affordance, routes-spec P2.5 — no map dependency;
  resolves save-prompt timing as *explicit later action from history*). Build mode is
  **tap-to-place waypoints, straight segments, no routing engine, no snap-to-trail** — the
  drawing-cut reversal is on the record, do not re-flag. Builder readout: live distance per
  waypoint with Strava-Manual-Mode-style honesty labeling ("distance as plotted — trails may
  be longer"); no elevation number at all. Post-MVP ladder: reverse/close-loop helpers (pure
  geometry), DEM elevation, snap-to-trail (a fresh decision if ever).
- **Follow:** Route detail's "Start session on this route" (Training side) → Record with the
  route preloaded as a **muted second line under the live trace. No off-route detection, no
  alerts, no turn cues — ever.** Finishing tags the session's block with `routeId` (effort
  appears on the route's self-vs-self list). Vocabulary: phone-screen *watch-breadcrumb*
  navigation, not degraded Komoot (research §1).
- **Spots:** pin tap → spot detail; save-as-spot lives in `log-session.tsx` (pinned-spots P4).
- **Session detail:** map-hero display of a saved trace (one-vs-two-screens open, §9). The
  logbook is Profile's (`profile.md`); efforts-under-a-route and sessions-under-a-spot are
  scoped filtered views, not the logbook (locked #3 resolves this).
- **Refused, restated:** no mid-run "off your best" push (on-demand pull of own history is
  fine); no stranger leaderboards; cohort course challenges only inside a group's active
  challenge (Ring 4, `social-tab.md`).

### Ingestion — the other half of "ingests a track or records one"

The one rule (§1) has two halves; Record is only the second. The first — tracks the app
didn't record — is owned as follows:

- **Session import (GPX/IGC) relocates here with the recorder** (`training-tab.md` §2
  hand-off: "GPS live capture + GPX import — OUT → Map Record"). Both parsers ship today in
  `log-session.tsx` ("Import GPX file" / "Import IGC file", `parseGpx`/`parseIgc`, converging
  on the same `GeoPoint[]`). New surface: a quiet **"Import a track" door on Record
  pre-start** — secondary to the Record button, never competing with it — feeding the parsed
  track straight into the M2 save sheet (same activity confirm, name/notes, route
  association, conditions snapshot, same Observation write). Rides **M2** (the save sheet is
  its dependency); until M2 lands, the existing `log-session.tsx` importers stay exactly
  where they are — the capability is never removed before its replacement ships (Training
  T4's principle, applied here). Provenance: a watch-exported file is the capture ladder's
  top rung; imported tracks take the correspondingly higher fidelity tag (§4).
- **Route-from-GPX** — the creation flow for `source: 'gpx'` (migration 016's third
  `RouteSource` value, which otherwise has none): file pick → parse → strip timestamps →
  `RoutePoint[]` → user names it. Decision (obvious call): like save-as-route it is a
  promotion flow with no map dependency, so it rides **routes-spec P2.5's slot**, mounted on
  the Routes list (`app/routes.tsx`) header/empty state — exactly where `training-tab.md`
  §3 C already names "import GPX" as a builder-independent creation door (door-3 precedent;
  locked #8's "created on Map" is about the builder, which this doesn't touch).
- **Watch/HealthKit workout import is not this spec's.** `wearable-ingestion-spec.md` owns
  that pipeline end-to-end (§ Addendum 2026-06-30 is current: Garmin direct API blocked, not
  merely deprioritized; Health Connect promoted to a Layer-0 peer of HealthKit;
  source-precedence/dedup lives in the adapter, and already exists in code for steps/sleep).
  Imported sessions land on the timeline — and thus in the Profile logbook — exactly like
  recorded ones; Map adds nothing to that pipeline and only renders whatever tracks it
  produces.

## 6. Privacy — the hardest line in the app

- **Body sessions never render on any map surface** — a structural exclusion at the query
  level (map surfaces only ever read E/S/W-dimension sessions), not a toggle.
- **Privacy zones must exist before any route or trace is ever cohort-visible.** Hard gate on
  Ring 4. Zones are a property of geometry, applied to every capture rung — plotted, recorded,
  imported, reused all reveal the front door equally.
- Visibility is per-object (`private | cohortId`); private-only at MVP everywhere.
- The cohort map (descriptive, pull-only heatmap) is Ring 4; **real-time location/Beacon is a
  separate safety feature, fully deferred, never bundled** into the social map.
- The permission model is itself a privacy feature: While-Using-only, forever (§3) — the OS
  enforces that location is invisible outside a user-started session.

## 7. Build passes (ordered; S/M/L; each independently shippable)

0. **D0 (S, docs-only) — land the REF specs; execute the gps-mapping union.** The rework
   set's authority files exist only in the session scratchpad; the `planning/` copies
   actively contradict them (`pinned-spots-spec.md` still mounts the list on Training;
   `gps-mapping-spec.md` still says recording "never runs in the background") and
   `home-tab-spec.md` / `routes-spec.md` / `social-tab-spec.md` are absent from the repo
   entirely. Before any M pass: copy the REF-branch files into `planning/` on this branch —
   **union the two `gps-mapping-spec.md` amendments** (map-nav's background-continuation +
   pins-routes' § Placement; this is §1's obvious call, executed here), take pins-routes'
   `pinned-spots-spec.md`, add `routes-spec.md` / `home-tab-spec.md` / `social-tab-spec.md` —
   then repoint the rework specs' "REF …" / "(pins-routes version)" citations at the repo
   paths. Owned here because the gps-mapping union is this spec's declared call, but it is
   the whole rework set's citation hygiene: once the scratchpad expires, every REF citation
   dangles and a future session reading stale `planning/` re-derives the wrong placement.
1. **M0 (S) — keyless basemap default.** OpenFreeMap as the no-key fallback in config style
   resolution; MapTiler keyed upgrade. Benefits every existing map surface; zero schema.
2. **M1 (M) — tab shell + Record pre-start.** `app/(tabs)/map.tsx` (zero code today): map +
   spots pin layer + sport arm control + Record button + accuracy chip; Home deep-link
   contract; permission rationale + denied/off states. Recording may still be the foreground
   `useGpsTracker` in this pass — the tab is real, the ceiling known.
3. **M2 (L) — background recording + save.** The MVP big rock: task-based two-layer stack per
   research §2 (`pausesUpdatesAutomatically: false` explicit — the found-in-source gotcha),
   plugin config + new dev build, recording-buffer migration, kill-resilience + recovery,
   stop→save writing the Observation, silent conditions snapshot. Keep `useGpsTracker`'s API
   surface, swap internals. The **"Import a track" (GPX/IGC) door rides this pass** — it
   targets the same save sheet (§5 Ingestion); `log-session.tsx`'s importers retire only
   once it's live.
4. **M3 (S) — derived honesty stats.** Moving vs elapsed post-hoc; sanity-gate counters;
   distance band; smoothed elevation gain, band labeled; provenance fidelity tag on save.
5. **M4 (S) — route follow.** `guidePath` on the map component; recorder preload via
   `routeId`; finish-tagging. Requires routes P1/P2 (routes-spec's own track; Training T3
   mounts the list). Ships with the known foreground ceiling if M2 hasn't landed.
6. **M5 (L) — Explore mode v1.** Dylan's in-flight Explore/"Now" design lands here: browse
   map, layer toggles (spots, routes, own traces), map tap-in creation doors. Gated on that
   design being visible.
7. **M6 (M) — straight-line builder inside Explore.** Routes P3/P4 carried scope: tap-to-place
   (gesture spike → crosshair fallback, shared with Spots P4), undo/clear on a waypoint model,
   live distance + honesty label, save (doors 1+2). Gated on M5 + ⚑3.

**Post-MVP ladder (recorded, not passes):** barometer fusion (after a background-delivery
spike); offline tile packs (route-bbox as the pack unit; blocked on ⚑4); DEM elevation for
plotted routes; proximity effort/spot matching; 3D replay (mapping-architecture Layer 4½);
cohort map + privacy zones (Ring 4).

## 8. Dependencies

- **Home** (`home-tab.md`): H6 swaps interim routing for the real Record deep link — consumes
  M1/M2; the element picker defines the arming params.
- **Training** (`training-tab.md`): T3 needs routes P1/P2; route detail's "Start session on
  this route" feeds M4. Save-as-route/spot are `log-session.tsx` affordances (routes P2.5,
  pinned-spots P4), independent of every M pass.
- **Profile** (`profile.md`): session-detail map-hero; the logbook is the tap-through target.
- **Social** (`social-tab.md`): per-session visibility seam; cohort map + course challenges +
  privacy zones all Ring 4 behind it.
- **Wearable ingestion** (`planning/wearable-ingestion-spec.md`, § Addendum 2026-06-30
  current): owns watch/HealthKit workout import — Layers 0/2/3 of its route model; Map
  consumes the resulting tracks and adds nothing to that pipeline (§5 Ingestion).
- **Research:** build M2 against `gps-recording-expo.md` §11; M0/M6/offline against
  `routes-implementation.md`.
- **Platform track:** Expo SDK 53→56 + MapLibre v10→v11 (⚑3). M0–M4 buildable on v10; the
  research lean is upgrade-before-Explore (M5/M6 are gesture/camera-heavy — exactly the v11
  API surface that renamed).
- **Rebrand track** (locked #13, mechanics only): element-tinted traces/pins consume the
  `elements.{earth,sky,water,body}` token group — never hardcode Gorge hexes; the Android
  notification icon is a brand asset slot.

## 9. ⚑ Flagged concerns (for Dylan)

- **⚑1 `killServiceOnDestroy: false` vs `true`** — does swiping the app away mean "stop
  recording"? Research recommends `false` (industry norm; the persistent notification is the
  consent surface; protects a 3-hour flight from a habitual swipe), but it's a values call.
  iOS swipe-kill honestly ends the recording either way, with partial recovery.
- **⚑2 Battery-optimization exemption prompt** (Android OEM killers) — a contextual one-time
  ask when the first *long* recording starts. Data-said-something timing, but still a prompt
  the user didn't summon; confirm it clears the pull-not-push bar.
- **⚑3 SDK 53→56 + MapLibre v10→v11 sequencing** — upgrade before the Explore/builder track
  (research lean), or build on v10 and migrate later? Real work; decide before M5.
- **⚑4 Offline tile terms** — `OfflineManager.createPack` collides with provider terms
  (MapTiler meters requests; OpenFreeMap isn't an offline-pack origin). Clean end state:
  self-hosted Protomaps extracts. Decide before any offline-pack pass ships.
- **⚑5 Builder + follow host surface inside Explore is open** (routes-spec ⚑1) — a placement
  deferral pending your Explore design, *not* a scope cut. Don't let it read as "routes got
  cut."
- **⚑6 Non-GPS Earth/Water starts** (shared with `training-tab.md` ⚑3) — indoor climbing and
  pool swim are E/W by dimension but Map Record is wrong for them. Proposal: routing follows
  the *logging surface*, not the dimension; Record could also offer a "log without GPS"
  escape. Touches Home, Training, and this spec.
- Decisions (obvious calls) taken here, on the record, not re-raised: union both gps-mapping
  amendments (D0 executes it); OpenFreeMap keyless default; no live auto-pause;
  `BestForNavigation` accuracy; store-raw-derive-clean; RDP on save-as-route promotion only;
  barometer doc correction; no dead Explore toggle at MVP; sport arm as a header control;
  avatar/gear cluster persists over the full-bleed map, including live Record (locked #1);
  route-from-GPX rides routes P2.5 on the Routes list (door-3 precedent).

## 10. Open questions

1. **One vs two session-detail screens** (map-hero flip vs separate detail) — decide alongside
   Profile's logbook rendering.
2. **Conditions snapshot source** — Open-Meteo alone vs dual-source at save.
3. **Offline tiles UX** — manual region/route download vs auto-cache (downstream of ⚑4).
4. **Explore filter granularity** — element chips vs element×sport.
5. **DEM source for plotted-route elevation** (research lean: client-side terrain-RGB decode)
   — until chosen, plotted routes honestly show no elevation.
6. **Where follow starts** once Explore exists — route detail → Record (current spec) or
   directly from the Explore layer (routes-spec left this open).
7. **Recording-buffer migration number** — claim the next free (≥017) at build time against
   the consolidated ledger; several specs hold 017 candidates.
