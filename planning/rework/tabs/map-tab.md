# Map tab — consolidated spec

v1 — 2026-07-11, product-rework planning pass; one of the 8-spec set under
`planning/rework/tabs/`. Authority: REF pins-routes `gps-mapping-spec.md` + `routes-spec.md` +
`pinned-spots-spec.md`, REF map-nav `gps-mapping-spec.md` (background amendment),
`planning/rework/research/gps-recording-expo.md` + `routes-implementation.md`,
`planning/mapping-architecture-spec.md`. Siblings referenced by path, not restated.

## 1. Purpose & constitution alignment

The Map tab is where geometry happens: GPS capture (Record mode) and, later, map browsing and
route building (Explore mode). It is the mirror applied to geography — **the app ingests a
track or records one; it never fabricates one** (gps-mapping-spec's one rule). Everything here
is pull: the user starts every recording; background *continuation* of a user-initiated recording
is required (a 4-hour flight survives a pocket and a locked screen), but recording the user
didn't start is banned — pull-only applies to *initiation* (map-nav amendment 2026-07-10;
Decision (obvious call): the consolidated `gps-mapping-spec.md` must union this amendment with
pins-routes' § Placement work — the pins-routes copy still carries the old "never runs in the
background" wording that map-nav corrected). No off-route alerts, no mid-run push, no
KOMs/segments — self-vs-self only. Body sessions
never appear on any map surface (constitution § four dimensions): Body is infrastructure, not
geography, and its fixed indoor locations are exactly the location data the privacy rules
protect. Fidelity on GPS sessions is a quiet provenance tag, never an organizing axis.

## 2. Information architecture / layout

**Two modes only: Record (MVP) ↔ Explore (post-MVP).** At MVP the tab *is* Record — no mode
switch renders until Explore ships (Decision: obvious call — don't show a dead toggle).

**Record, pre-start state** (the tab's landing):
- Full-bleed map centered on the user, with the **Pinned Spots pin layer** (sport icon pins
  from the `spots` table; tap → push `app/spot/[id]` detail). Spots *list/glance* lives on
  Home (`home-tab.md`, locked #11); the Map renders them in place.
- **Sport arm control** (header control, not a sub-tab — Decision, obvious call: keeps the
  map full-bleed): pre-armed by the Home deep link, else last-used; consumes the same
  recent/pinned-activities preference as Training's picker and Home's element picker.
  Switchable freely before record — the deep link's choice is a default, not a lock
  (home-tab-spec).
- Arming a sport loads that element's map layers and Pinned-Spots context (Water arms → river
  spots + gauge context foregrounded). This is mapping-architecture-spec Layer 5: style
  sources toggled by activity identity — one switch, not five maps.
- **Record button** + GPS accuracy chip (acquiring / poor / good).

**Record, live state:** live trace; stats strip (elapsed, distance, current speed/pace per
sport); manual pause/resume (user-initiated = a fact; **no auto-pause** — §4); Stop. When
backgrounded: Android persistent notification ("Recording session / GPS is on until you stop
the session"), iOS background-location pill; no map rendering while backgrounded (battery).

**Record, save state:** Stop → save sheet: confirm activity, optional name/notes, route
association if followed, save or discard (discard confirms). Save writes the session
Observation and silently freezes conditions (§4).

**Explore (post-MVP stub):** Dylan is mid-build on an Explore/"Now" surface not yet documented
in this repo (routes-spec § Surfaces 3). This spec deliberately stubs it: a browse map with
togglable layers (spots, saved routes, own traces; cohort layers Ring-4-gated) and the **route
builder as a mode/layer inside it**. Only the builder's *behavior* is locked (§5); its
placement inside Explore is open (⚑5) — do not design ahead of Dylan's work.

## 3. Components & states

| Component | Notes |
|---|---|
| `MapSurface` | `RouteMap` extended: spots pin layer, live-trace source, optional `guidePath` second line (muted, under the trace), direction arrows + start marker on route lines (research adopt #3) |
| Sport arm control | Registry-driven (`activity.ts`), element-grouped; icons free |
| Record button + accuracy chip | Chip states: acquiring (spinner), poor (>50 m accuracy, honest copy "weak signal — points may scatter"), good |
| Live stats strip | Units via `metersToDisplay` + settings everywhere |
| Save sheet | Activity confirm, name/notes, save/discard |
| Recovery banner | On launch with an orphaned recording: "finish the partial session" (see §4) |
| Spot pin + callout | Tap → spot detail push; creation stays the modal pin picker (pinned-spots P4) until Explore lands, then map long-press becomes a door |

**Empty:** pre-start with zero spots is just a map — no upsell, no "add your first spot" nag
(absent, not empty). Explore with nothing recorded shows the basemap, nothing else.

**Loading:** map style → neutral skeleton; GPS acquiring → chip state, Record disabled until
first fix.

**Permission states:** undetermined → rationale sheet before the OS prompt, using the honest
sentence the research hands us: *"the app cannot see your location except during a session you
started"* — **While Using the App is the only permission ever requested, on both platforms**
(gps-recording-expo §3: no "Always" grant needed). Denied / services off → descriptive state +
settings link, no guilt.

**Tile/key states:** Decision (obvious call, per research): **OpenFreeMap becomes the keyless
default basemap; MapTiler stays the keyed upgrade** (outdoor/topo cartography). One config
change in style resolution; SVG trace fallback remains for the no-native-module case only. No
"map needs a key" dead state anywhere. Offline: recording is unaffected (GPS is receive-only —
worth a help line in Record); tiles render from cache or a blank grid with the trace still
drawn on top.

**Error states:** task-start failure → surfaced plainly, session not silently lost;
observation-write failure at save → buffer retained, retry offered; mocked-location fixes
(Android) → session tagged, not silently accepted.

## 4. Data touchpoints (descriptive — no code here)

- **Sessions (tier 1, sovereign):** Record writes ordinary session Observations with the
  existing `gpsPath` / Sky `track` payload shapes (`GeoPoint[]` is canonical; GeoJSON only at
  the render boundary — mapping-architecture Layer 3). Fidelity = quiet provenance tag
  (phone trace slightly under watch import), never a UI axis. The session's raw fixes are the
  fact: **persist every fix passing a minimal sanity gate; filter/derive at read time**
  (research §5). Never simplify the session trace.
- **Recording buffer (new storage):** the background task appends point batches to a
  crash-safe buffer table with an active-recording marker — SQLite is the recording, React
  state is a cache (research §8). A new table → claims the **next free migration number at
  build time** (chain: 015 reserved `spots_sport` → 016 reserved `routes` → 017+ contested;
  coordinate with the consolidated ledger). Buffer clears on save/discard; on relaunch,
  marker + task check drive recovery.
- **Derived stats (tier 2, computed not stored):** moving vs elapsed derived post-hoc from
  the stored track (no live auto-pause — Decision, obvious call, research §6: record
  everything, derive the reading, show both); distance with its honest band (±2–10% forest,
  ±1–3% open sky); elevation gain from smoothed GPS with hysteresis, band labeled. Barometer
  fusion is a fast-follow — most phones *do* have one; the consolidated gps-mapping-spec
  should adopt the research's correction of its "no barometric altimeter" line (Decision,
  obvious call).
- **Silent conditions snapshot on save:** the Notion Map plan calls this the most compounding
  MVP item. At save, freeze weather at the track's start point/time through the existing
  backdate-correct freeze clients (the Sky-build pattern), stored on the session payload.
  Never touches the live-display path; `conditions_snapshots` stays the insert-only per-spot
  freeze store (pinned-spots rule).
- **Routes:** `routes` table = migration 016, owned by routes-spec P1 (`RoutePoint[]`, no
  timestamps, `visibility` default private from day one). Builder writes `source: 'plotted'`
  (no elevation — honest gap until a DEM source is chosen); save-as-route promotion writes
  `source: 'session'` with the copy RDP-simplified (~5–10 m tolerance; a route is a recipe,
  simplify freely — the session trace, never). Sessions backlink `routeId` in payload JSON —
  no migration. Builder data-model note: design undo/edit around *waypoints* (MVP points ==
  waypoints) so a future `kind: waypoint|derived` lands migration-free (research adopt #5).
- **Spots:** reads `spots` (+ migration 015 sport column) for the pin layer; pin creation
  writes spots via the pinned-spots flows.
- **Sharing/privacy schema:** routes already carry `visibility`. Per-*session* visibility
  scoping is Social's load-bearing seam (`social-tab.md`); Map must not foreclose it and adds
  nothing to it. Privacy zones are a future entity, schema'd nowhere yet — a prerequisite row
  in any Ring-4 plan, and a hard gate (§6).

## 5. Interactions & cross-tab flows

Locked routing, verbatim: **Log Session (Home log bar) opens an Earth/Sky/Water/Body element
picker; Earth/Sky/Water rows lead with most-recent activity, route to Map Record with sport
armed; Body routes to Training template/session selection** (locked #6). **GPS capture lives
on the Map tab (Record mode)** (locked #7). **Routes are created on Map (straight-line builder
etc.), and the route library is browsed on Training. History (logbook) is on Profile; routes
are reusable assets, not history** (locked #8).

- **Home → Record deep link contract:** element + activity id, optional template shape
  (an E/S/W-surface template arms Record with its target), optional `routeId` (start-on-route).
  Until M1/M2 land, Home's interim routing (straight to `log-session` with activity
  pre-selected) applies; Home pass H6 swaps it (`home-tab.md`).
- **Route creation — three doors, one build mode** (locked; routes-spec): (1) "+ New Route"
  from the Training routes list header; (2) tap-in from the Map surface itself; (3)
  save-as-route from a logged session (`log-session.tsx` affordance, routes-spec P2.5 — no map
  dependency; resolves save-prompt timing as *explicit later action from history*). Build mode
  is **tap-to-place waypoints, straight segments, no routing engine, no snap-to-trail** — the
  drawing-cut reversal is on the record, do not re-flag. Builder readout: live distance per
  placed waypoint with Strava-Manual-Mode-style honesty labeling ("distance as plotted —
  trails may be longer"); no elevation number at all. Post-MVP ladder: reverse/close-loop
  helpers (pure geometry), DEM elevation, snap-to-trail (a fresh decision if ever).
- **Follow:** Route detail's "Start session on this route" (Training side) → Record with the
  route preloaded as a **muted second line under the live trace. No off-route detection, no
  alerts, no turn cues — ever.** Finishing tags the session's block with `routeId` (effort
  appears on the route's self-vs-self list). Design vocabulary: phone-screen *watch-breadcrumb*
  navigation — a known pattern, not degraded Komoot (research §1).
- **Spots:** pin tap → spot detail; save-as-spot lives in `log-session.tsx` (pinned-spots P4).
- **Session detail:** map-hero display of a saved trace (one-vs-two-screens open, §9). The
  logbook itself is Profile's (`profile.md`); efforts-under-a-route and sessions-under-a-spot
  are scoped filtered views, not the logbook (resolved by locked #3).
- **Refused, restated:** no mid-run "off your best" push (on-demand pull of own history is
  fine); no stranger leaderboards; cohort course challenges only inside a group's active
  challenge (Ring 4, `social-tab.md`).

## 6. Privacy — the hardest line in the app

- **Body sessions never render on any map surface** — a structural exclusion at the query
  level (map surfaces only ever read E/S/W-dimension sessions), not a toggle a user could
  mis-set.
- **Privacy zones must exist before any route or trace is ever cohort-visible.** Hard gate on
  Ring 4, not a follow-up. Zones are a property of geometry, applied to every capture rung
  (plotted, recorded, imported, reused all reveal the front door equally).
- Visibility is per-object (`private | cohortId`); private-only at MVP everywhere.
- The cohort map (descriptive, pull-only heatmap) is Ring 4; **real-time location/Beacon is a
  separate safety feature, fully deferred, never bundled** into the social map.
- The permission model itself is a privacy feature: While-Using-only, forever (§3 finding) —
  the OS enforces that the app cannot observe location outside a user-started session.

## 7. Build passes (ordered; S/M/L; each independently shippable)

1. **M0 (S) — keyless basemap default.** OpenFreeMap as the no-key fallback in config style
   resolution; MapTiler keyed upgrade. Benefits every existing map surface; zero schema.
2. **M1 (M) — tab shell + Record pre-start.** `app/(tabs)/map.tsx` (zero code today): map +
   spots pin layer + sport arm control + Record button + accuracy chip; Home deep-link
   contract; permission rationale + denied/off states. Recording may still be the foreground
   `useGpsTracker` in this pass — the tab is real, the ceiling known.
3. **M2 (L) — background recording + save.** The MVP big rock: task-based two-layer stack per
   research §2 (with `pausesUpdatesAutomatically: false` explicit — the found-in-source
   gotcha), plugin config + new dev build, recording-buffer migration, kill-resilience +
   partial-session recovery, stop→save writing the Observation, silent conditions snapshot.
   Keep `useGpsTracker`'s API surface, swap internals.
4. **M3 (S) — derived honesty stats.** Moving vs elapsed post-hoc; sanity-gate counters;
   distance band; smoothed elevation gain, band labeled; provenance fidelity tag on save.
5. **M4 (S) — route follow.** `guidePath` on the map component; recorder preload via
   `routeId`; finish-tagging. Requires routes P1/P2 (routes-spec's own track; Training T3
   mounts the list). Ships with the known ceiling if M2 hasn't landed.
6. **M5 (L) — Explore mode v1.** Dylan's in-flight Explore/"Now" design lands here: browse
   map, layer toggles (spots, routes, own traces), map tap-in creation doors. Gated on that
   design being visible — deliberately stubbed here.
7. **M6 (M) — straight-line builder inside Explore.** Routes P3/P4 carried scope: tap-to-place
   (gesture spike → crosshair fallback, shared with Spots P4), undo/clear on a waypoint model,
   live distance + honesty label, save (doors 1+2). Gated on M5 + the upgrade call (⚑3).

**Post-MVP ladder (recorded, not passes):** barometer fusion (after a background-delivery
spike); offline tile packs (route-bbox as the pack unit — Komoot's per-route corridor pattern;
blocked on ⚑4); DEM elevation for plotted routes; proximity effort/spot matching; 3D replay
(mapping-architecture Layer 4½); cohort map + privacy zones (Ring 4).

## 8. Dependencies

- **Home** (`home-tab.md`): H6 swaps interim routing for the real Record deep link — consumes
  M1/M2. Element picker defines the arming params.
- **Training** (`training-tab.md`): T3 (routes shelf) needs routes P1/P2; route detail's
  "Start session on this route" feeds M4. Save-as-route/spot are `log-session.tsx` affordances
  (routes P2.5, pinned-spots P4) — buildable independent of every M pass.
- **Profile** (`profile.md`): session-detail map-hero rendering; logbook is the tap-through
  target from map surfaces.
- **Social** (`social-tab.md`): per-session visibility seam; cohort map + course challenges +
  privacy zones all Ring 4 behind it.
- **Research:** `planning/rework/research/gps-recording-expo.md` (recording stack, permissions,
  resilience — build M2 against its §11 summary) and `routes-implementation.md` (renderer/
  tiles/storage/simplification — M0, M6, offline).
- **Platform track:** Expo SDK 53→56 + MapLibre v10→v11 upgrade (⚑3). M0–M4 are buildable on
  v10; the research lean is upgrade-before-Explore (M5/M6 are gesture/camera-heavy, exactly
  the renamed v11 API surface). AGENTS.md already points at SDK 56 docs.
- **Rebrand track** (locked #13, mechanics only): element-tinted traces/pins consume the new
  `elements.{earth,sky,water,body}` token group — never hardcode Gorge hexes; the Android
  foreground-service notification icon is a brand asset to slot in later.

## 9. ⚑ Flagged concerns (for Dylan)

- **⚑1 `killServiceOnDestroy: false` vs `true`** — does swiping the app away mean "stop
  recording"? Research recommends `false` (industry norm; the persistent notification is the
  consent surface; protects a 3-hour flight from a habitual swipe), but it's a values call.
  iOS swipe-kill honestly ends the recording either way, with partial recovery.
- **⚑2 Battery-optimization exemption prompt** (Android OEM killers) — proposed as a
  contextual one-time ask when the first *long* recording starts. Data-said-something timing,
  not engagement theater — but it is a prompt the user didn't summon; confirm it clears the
  pull-not-push bar.
- **⚑3 SDK 53→56 + MapLibre v10→v11 sequencing** — upgrade before the Explore/builder track
  (research lean), or build on v10 and migrate later? Real work (New Architecture flip;
  healthkit/reanimated compatibility); needs its own decision before M5.
- **⚑4 Offline tile terms** — `OfflineManager.createPack` collides with provider terms
  (MapTiler meters requests; OpenFreeMap's public instance isn't an offline-pack origin).
  Clean end state is self-hosted Protomaps extracts. Decide before any offline-pack pass ships.
- **⚑5 Builder + follow host surface inside Explore is open** (routes-spec ⚑1) — a placement
  deferral pending your Explore design, *not* a scope cut. Everything the builder does is
  locked; only where it lives is open. Don't let it quietly read as "routes got cut."
- **⚑6 Non-GPS Earth/Water starts** (shared with `training-tab.md` ⚑3) — indoor climbing and
  pool swim are E/W by dimension but Map Record is wrong for them. Proposal to react to:
  routing follows the *logging surface*, not the dimension (element picker sends
  non-GPS-surface activities to the logger; Record could equally offer a "log without GPS"
  escape). Touches Home, Training, and this spec.
- Decisions (obvious calls) taken here, listed for the record, not re-raised: union both
  gps-mapping amendments in consolidation; OpenFreeMap keyless default; no live auto-pause
  (derive moving/elapsed); `BestForNavigation` accuracy; store-raw-derive-clean; RDP on
  save-as-route promotion only; adopt the barometer doc correction; no dead Explore toggle at
  MVP; sport arm as a header control, not a sub-tab.

## 10. Open questions

1. **One vs two session-detail screens** (map-hero flip vs separate detail) — Notion Map open
   question; decide when Profile's logbook rendering is designed.
2. **Conditions snapshot source** — Open-Meteo alone vs dual-source at save.
3. **Offline tiles UX** — manual region/route download vs auto-cache of visited areas (both
   downstream of ⚑4).
4. **Explore filter granularity** — element chips vs element×sport.
5. **DEM source for plotted-route elevation** (client-side terrain-RGB decode is the research
   lean) — until chosen, plotted routes honestly show no elevation.
6. **Where exactly follow starts** once Explore exists — via route detail → Record (current
   spec) or directly from the Explore layer (routes-spec left this open).
7. **Recording-buffer migration number** — claim the next free (≥017) at build time against
   the consolidated ledger; several specs hold 017 candidates.
