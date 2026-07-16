# Explore + Forecasting — research & design thinking (the R7 session)

*Research date: 2026-07-15. This is the dedicated Explore design session R7 parked for
(`phase4-session-playbook.md` 🟥 R7; map-tab.md ⚑5). Research-first per Dylan's framing —
nothing here is built or committed as a decision until Dylan reacts. Inputs: Dylan's voice
notes (Windy/Strava/Wunderground/iKitesurf as references, forecasting rising to a core
feature area, Explore-vs-Forecasting tab thinking, route builder as a sub-feature of Explore),
five parallel web-research sweeps (2026-07-15), `tabs/map-tab.md` §2/§7/⚑5,
`research/routes-implementation.md`, and the shipped conditions module
(`src/lib/conditions/` — Open-Meteo weather + Sky module, USGS gauges, SNOTEL,
avalanche.org map layer, the freeze store, and `current.ts` live display).*

---

## 1. What the references actually do (research findings)

### Windy (Dylan's paragliding favorite)

- **50+ map overlays** (wind/gust, precip type, new snow, clouds + cloud base, CAPE,
  Thermals, freezing level…), a **pressure-level altitude slider** on the right edge, and
  **one bottom timeline scrubber** that owns time for every layer. Signature particle
  animation shows wind direction at a glance.
- **Tap-anywhere point forecast**: inline numbers → detail meteogram → **Airgram**
  (altitude × time wind-barb grid) → **sounding/skew-T**. The **model-compare view**
  (ECMWF/GFS/ICON/HRRR side by side) is arguably its most-loved feature — model
  *disagreement is itself the forecast* (an uncertain day).
- **Why kiters distrust it**: it visualizes raw model output. A 12-spot accuracy test found
  ECMWF within ±3 kt only ~70% of the time at coastal spots and off by 8+ kt on thermal
  days — sub-grid sea-breeze/gorge effects are invisible to a 9–22 km model. The smooth
  color field *looks* authoritative far past its real resolution: false precision.
- **The 2024–25 redesign backlash** was about layer overload (thumbnail grid of 50 layers)
  and auto-hiding UI. Their own fix: pinned/favorite layers.
- **API terms rule Windy out as a data source**: Point Forecast API is €990/yr, never
  includes ECMWF, requires their logo, and per their own community rulings may not be used
  inside weather-type apps at all. We link out to Windy; we never embed it.

### wxtofly windgrams (the Cliffside link)

- A volunteer-run PNW **RASP/WRF** install (TJ Olney + Jiri Richter): 255 launch sites
  (Gorge sites: **Bingen, Cliffside, Dalles Mountain Ranch**), ~4 km domain, ~2 runs/day,
  4-day outlook.
- A windgram is **time × altitude for one launch**: wind barbs per hour per level
  (green <9 kt / white above — an instant launchability read), lapse-rate background color
  (red unstable → pink/orange "most soaring happens here" → blue stable), thermal-top
  glyphs, cloud glyphs, freezing-level snowflakes. It answers what an hourly surface
  forecast can't: launch window, wind aloft vs launch, thermal strength/height, OD risk.
- **Feasibility verdict: we can build an honest windgram from Open-Meteo alone.** The free
  API serves pressure-level wind/temp/RH/cloud from 1000 hPa up, plus
  `boundary_layer_height`, CAPE, lifted index, freezing level — with **HRRR 3 km selected
  inside CONUS** (close to wxtofly's 4 km). One HTTPS call per lat/lng, chartable
  client-side. What we'd honestly lack: the 1.3 km nests, and RASP's derived W* thermal
  velocity (approximate from BL height + lapse rate, or omit — never fabricate).
- The comparable paid tools (XCSkies ~$40/yr, SkySight $89/yr) are US-covered; the free
  ones (Meteo-Parapente, Burnair, XCTherm, Paraglidable) are Europe-only. A free US
  windgram-per-spot is genuinely rare air.

### Strava (the Explore reference)

- Maps tab = **one full-screen map + a mode dropdown (Routes / Segments / heatmaps) + a
  sport picker + a draggable bottom sheet** of suggestions. Minimal chrome, swappable
  content layer — the exact shape Dylan's "top-level nav switcher + layers held on the
  right" gestures at.
- Heatmaps: global (k-anonymity ≥5 athletes, 13-month window, monthly refresh, privacy
  zones excluded at the pipeline — the 2018 military-base lesson), personal (private,
  all-time), weekly ("is this trail currently ridden"), night. Layers stack.
- **Strava has zero forecast integration** — nothing predictive anywhere. Past-weather
  stamps on finished activities only (and third parties like Klimat fill even that).
  **Forecast-on-the-map is white space**, and our app already freezes conditions onto
  every session — we're structurally ahead of them on the data.
- Their most-hated moves: paywalling the core planning loop, zoom-gating the heatmap,
  mobile/web feature asymmetry. Not our economics, but the lesson stands: don't gate the
  map itself.

### Wunderground (the rain/snow reference)

- Moat = 250k personal weather stations; presentation is the copyable part:
  **probability AND amount together** ("80% / 0.45 in"), **windowed accumulation
  headlines** ("0.6 in in the next 24 h"), a rain/snow/mixed phase toggle, calendar
  month-grid for trip planning, and "Smart Forecasts" (user-defined good-conditions
  thresholds highlighting *when to go*).
- Snow lesson: valley-floor snow forecasts are why skiers use OpenSnow — **elevation-aware
  forecasting (or at least labeling the forecast point's elevation)** matters more than
  radar polish. Open-Meteo takes an elevation parameter; our Sky spots have altitudes.
- Free stack replicating the core: **Open-Meteo** precip/snow/probability (already our
  client), **NWS gridpoints** `snowfallAmount` for US cross-check, **RainViewer** free
  radar tiles (past 2 h + nowcast frames) as a MapLibre overlay — attribution required,
  personal-scale terms fine.

### iKitesurf / WeatherFlow (the live-wind reference)

- The moat is **launch-sited physical anemometers**: ~19 stations in the Gorge alone
  (Rooster Rock, the Hatch, Event Site, Doug's, Rowena, Maryhill…), many on mid-river
  channel markers, minute-cadence. The community workflow: model forecast the night
  before, **live meters to answer "is it on right now"** before driving. That data is
  paywalled (Pro $119.99/yr) and **not legally licensable into our app**.
- Presentation conventions we must respect: **lull / average / gust, always three numbers**
  ("22 (18–28)"), the green/blue/red three-trace observed graph with the forecast curve
  continuing past "now", direction spoken as *from* ("gusting 35 from the west"),
  **visible reading age** ("3 min ago" — a stale sensor is no data), threshold-based
  mental models ("alert me at 18+ from 225–315°").
- Free live-obs alternatives for the Gorge: NWS ASOS (KDLS, KTTD, 4S2 — airports, not
  launches), **Synoptic/MesoWest free tier** (170k stations incl. ODOT/WSDOT road stations
  along I-84 — the corridor gradient), Iowa Mesonet history. **Honest gap: nothing free
  reads the wind at the Hatch.** We show model forecasts labeled as models, free public
  stations where they exist, and never pretend either is a launch-side meter.

---

## 2. The proposed shape (for Dylan to react to)

### 2a. Three modes on the Map tab, one switcher — not new shell tabs

**Record | Explore | Forecast** as peer modes of the Map tab, on a single mode switcher —
the "top-level nav switcher" from Dylan's note, read as the Map tab's internal top-level
(the 5-tab shell stays locked; Strava proves one map surface with swappable content modes
carries this cleanly). This *amends map-tab.md §2's "two modes only"* to three.

Why Forecast is a peer **mode**, not a layer inside Explore (upgrading R7's earlier
"two separate layers" color, in the direction Dylan's newer note points):

- **Different core objects.** Explore browses *geography you've made* (spots, routes, your
  traces — and someday friends'). Forecast browses *the atmosphere ahead* (a time
  dimension Explore doesn't have — it needs a timeline scrubber; Explore doesn't).
- **Different chrome.** Forecast owns a time scrubber and a layer set of weather fields;
  Explore owns creation doors and asset layers. Mixing both into one layers rail is how
  Windy got to 50 toggles.
- They **cross-link** instead: tap a spot in Explore → its detail already shows current
  conditions (shipped); a Forecast day → "your sessions on days like this" (§2d).

The switcher itself: the existing `SegmentedControl` pattern (Training, Nutrition,
Benchmarks all use it) floating over the map under the header chrome. Record's live state
hides the switcher (you don't mode-switch mid-recording; the recording survives navigation
per M2 regardless).

**Landing mode open question (🟥 E1):** today the tab lands on Record. "Explore as the
baseline" reads like Explore becomes the landing once it exists, with Record one tap away.
Genuine product call — Record-first serves "I'm at the trailhead," Explore-first serves
"where should I go." Lean: **Explore-first once it ships** (recording is deliberate;
browsing is the resting state), but this is Dylan's call.

### 2b. Layers: a right-side rail, curated per mode — never a catalogue

Dylan's instinct (overlays "held on the right") matches both Windy's desktop rail and the
research's clearest anti-pattern warning (Windy's 50-layer thumbnail grid). Concretely:

- A **layers button top-right under the header cluster** opening a compact vertical rail of
  toggle chips, per mode:
  - **Explore layers:** Spots (default on) · Saved routes · My traces · *(Ring 4, gated
    stubs, not rendered: Friends' routes, Cohort heatmap)*
  - **Forecast layers:** Wind (arrows now, particles later) · Rain/Radar (RainViewer) ·
    Snow · Thermals/BL (Sky) · Avalanche zones (adapter already shipped) · River gauges
    (Water)
- **Sport-aware defaults, not sport-locked**: arming Sky pre-toggles Wind+Thermals; Water
  pre-toggles Wind+Gauges — the mapping-architecture "one switch, not five maps" rule
  extended to weather. Everything stays manually toggleable.
- Cap the visible set (~6 per mode). New layers earn a slot or wait.

### 2c. Explore v1 = M5 scope (buildable now; the build prompt is §4)

The browse map, per map-tab.md §7 M5, now unstubbed:

1. **Mode switcher appears** (second mode exists — the no-dead-toggle rule is satisfied).
2. **Spots layer**: the existing pin layer, shared with Record.
3. **Saved-routes layer**: route polylines with start markers + direction arrows
   (routes-research adopt #3), tap → route detail. Element-tinted via tokens.
4. **My-traces layer**: every E/S/W session with a track, rendered as low-opacity
   overlaid polylines — the honest personal heatmap v1 (density-weighted rendering is a
   ladder item, not a blocker). **Body is excluded structurally at the query** — the map
   data source only ever selects E/S/W dimensions (map-tab §6), not a filter flag.
5. **Creation doors**: map **long-press → "New spot here"** (the deferred map-pin picker
   from pinned-spots P4 finally lands; reuses `new-spot.tsx`), and the same door gains
   "Start a route here" when M6 arrives. Carries the shared tap-gesture spike (crosshair
   fallback stays specced).
6. **Built to host the builder**: Explore's layer/door architecture treats build-mode as a
   takeover state — entering the builder suspends browse layers and hands the surface to
   M6. Nothing of the builder itself ships in M5.

Not in v1: cohort anything (Ring 4 + privacy zones hard gate), suggested routes
(population-derived push — refused per constitution), global heatmap (no population data,
don't want it), offline packs (⚑R8 stands).

### 2c-bis. The spot is the spine (Dylan, 2026-07-15 — the reframe)

Dylan's clarification puts the **pinned spot at the center of forecasting**, not the map
mode: *"the ability to see what you want to see forecasted for that spot — maybe it's just
rain or shine, maybe just wind, maybe full meteo layers, maybe tagging a river gauge."*
This is the unifying insight and it simplifies the architecture:

- **Forecast is primarily an extension of spot detail, not only a separate map mode.** A
  pinned spot stops being just a pin and becomes a **configurable forecast dashboard**:
  the user picks which panels that spot shows — wind (lull/avg/gust + graph), rain/shine
  (precip % + accumulation + temp over hours), full meteo (the airgram/windgram), river
  gauge (already wired via `gaugeSiteId`). A kite spot shows wind; a hiking spot shows
  rain/temp; a paragliding site shows the full airgram; a kayak run shows the gauge.
- **Per-spot config rides `spot.meta` — no migration** (verified: `Spot.meta?:
  Record<string, unknown>` already exists, read through typed helpers that return
  `undefined` for unrecorded facts — the "absence never fabricated" pattern). A
  `forecastPanels?: string[]` (or richer object) in `meta`, read through a typed helper,
  with a **sport-derived default** (feedForSport already maps sport → conditions feed;
  extend it to sport → default panel set) so an untagged/unconfigured spot still shows
  something sensible. Same obvious-call shape as `RoutePoint.kind` and Sections.
- **The Forecast map mode becomes the browse/discover layer on top of this**, not the
  whole feature: tap anywhere → the same point-forecast the spot dashboard renders;
  the wind color overlay + scrubber are for "where's the wind today" exploration. This
  is the cleaner split — spot detail answers "what's my spot doing," the map mode answers
  "where should I go."

### 2d. Forecast mode — sketch + ladder (its own spec/build track, after Dylan reacts)

*Distilled into a build-ready spec 2026-07-15: `tabs/forecast-tab.md` — read that for the
per-spot panel config, the NOAA direct-observations connection, component list, and F1–F5
build passes. What follows here stays as the research narrative; the spec is authoritative
for build order. **⚠️ The spec RENUMBERED the F-passes** (spec: F1 dashboard / F2 NOAA obs
/ F3 windgram / F4 map mode / F5 ladder — this section's original F2="map mode" and
F4="wind arrows" are superseded; when any doc says F-something, the spec's numbering wins).*

**Spot-first, not field-first.** Windy's field painting is beautiful and misleading at
spot zoom; our unit of meaning is the pinned spot. Forecast v1 = the map with spot pins
where **tap → a real point forecast**, plus at most one honest field overlay. Ladder:

- **F1 — Spot forecast page** (no map work): extend the Open-Meteo client from
  current-conditions to hourly/daily forecast. Wind as **lull/avg/gust three numbers +
  three-trace graph** (community-standard encoding), precip as **probability × amount**
  with windowed accumulation headlines ("0.6 in next 24 h"), temp, per-sport emphasis
  (feedForSport pattern). Model + run time + elevation labeled on every readout; >72 h
  visually faded. Where a free public station is near (NWS/Synoptic), show its live
  reading beside the model with its age — never blended.
- **F2 — Forecast map mode**: the mode itself + timeline scrubber + RainViewer radar
  overlay (the one field layer that's observed truth, not model paint) + spot pins
  showing forecast-at-scrub-time.
- **F3 — Windgram for Sky spots**: the Open-Meteo pressure-level chart (§1). Hours ×
  altitude, wind barbs color-thresholded, lapse-rate shading, BL-height line,
  freezing-level line, model/resolution/run stamped on the chart. This is the Cliffside
  answer, for any spot, free.
- **F4 — Wind-arrow overlay**: sampled Open-Meteo grid → MapLibre symbol layer of
  direction arrows colored by speed, at gorge-relevant zooms. (Particle animation:
  ladder — custom v11 layer, real work, pure delight.)
- **F5 — "Days like this" (the differentiator)**: the forecast day's conditions matched
  against the **conditions already frozen on every saved session** (Water-build
  similar-conditions query, generalized) → "you've flown Cliffside on 6 days like
  Saturday; here's what you flew and what you rode" — sessions, routes, **and gear**
  (session gear refs already exist: the "what kit at 35 gusting west at the Hatch" query
  is a read model over shipped data). No competitor has this; Strava's white space + our
  freeze architecture.
- **Ladder beyond**: particle wind, Smart-Forecast-style "good window" highlighting
  (descriptive threshold match, user-set — constitution-compatible), NWS snowfall
  cross-check, model-compare rows.

**Dylan's Windy/Wunderground screenshots (2026-07-15) — concrete presentation references
for the Forecast spec.** Five phone shots confirming what he wants ported:
- *Wind map + overlay* (Windy PNW + Pacific): the color-speed field (calm→windy ramp) +
  animated white **streamlines**, tap-crosshair → point header (`Wind · ECMWF, Surface ·
  N mph ↓dir` + Forecast/Sounding tabs), favorited-spot hearts, **bottom time scrubber** +
  speed legend. → F2/F4. **Design fork (🟥 E6):** the animated particle streamlines are a
  real WebGL custom-layer build (v11-feasible, open impls exist) = delight-ladder, NOT v1;
  a static color field is cheaper but is exactly the false-precision blob kiters distrust.
  Recommended F2 v1 = **wind arrows on a coarse grid + RainViewer radar (observed, honest)
  + tap-to-forecast**, color-field/streamlines as a later "make it beautiful" pass —
  unless the overlay aesthetic is a priority, in which case slot the static field earlier
  and keep only the animation on the ladder. Brand note: Windy's field pops on its DARK
  canvas; over our light Gorge basemap it needs a real design look, not a straight copy.
- *Point meteogram* (Windy Bingen): hours × rows table — temp, rain, wind, **gust row
  color-coded green→amber (13→21)**, wind-dir arrows, Red Flag warnings, `model: ECMWF`
  labeled. → F1. **Steal the gust color-coding verbatim** (the number that picks kite/wing
  size; honesty-first done right). All fields are Open-Meteo.
- *Airgram* (Windy): time × altitude wind barbs + lapse-rate color bands + model row
  (ECMWF/GFS/ICON/NAM/**HRRR**/HRDPS + Compare). This is the wxtofly windgram in Windy's
  skin — HRRR in the row confirms our free high-res US model. → F3.
- *Wunderground rain*: Day/Hour/Summary tabs, per-day cards with **precip % AND
  accumulation together** (41% / 0.00"), temp+feels-like dual line, precip-probability
  area chart w/ scrubber readout. → F1 rain half. All Open-Meteo.
- Windy's chart/table panels render LIGHT even over its dark map → they fit our light
  theme natively; only the map overlay is the dark-vs-light design question.
- **Model + "Compare forecasts"** labeling is on-brand for *this* app specifically —
  showing model disagreement is the honest version of a forecast; Open-Meteo serves
  GFS/HRRR/ICON so compare-rows are a real ladder item, not vaporware.
- **🟥 E3 — wind-threshold alerts** (iKitesurf's most-loved feature) are **push** —
  same constitutional bar as R6 (gear reminders): data-said-something, user-set,
  one-shot? Genuinely contestable; nothing in F1–F5 depends on it. Rule it before any
  alert mechanics are specced.

### 2e. Route builder + Sections (placement answer for ⚑5 / R1's parked half)

- **Builder placement confirmed as designed**: a sub-feature of Explore — entered via the
  creation doors (map long-press / "+ New Route" from Training T3 deep-linking into Map
  build mode), and it **takes over the surface as its own temporary mode** while active
  (Dylan's "enough weight to resurface as its own mode when activated" — architecturally a
  takeover state within Explore, not a fourth switcher entry). M6/P4-9 scope unchanged:
  straight-line, tap-to-place waypoints, no engine, honesty labels, no elevation number.
- **Sections (R1: named timed stretches within a route)**: live on the Route, not the map
  modes. Defined in the builder or on route detail as a **named range between two
  waypoints** (`sections: [{name, startIdx, endIdx}]` riding the routes JSON column —
  no migration, same trick as `RoutePoint.kind`). Displayed as tinted sub-segments on the
  route line; per-section self-times derived by matching your efforts' traces against the
  range (post-M6 pass). Friend-time comparison on a section is **Ring 4** (it's the
  social mirror carve-out, counts-only-on-shared per the social plan) — the primitive
  ships self-vs-self. Not in M5 or M6 v1; specced when the builder lands.

### 2f. Decisions taken here (obvious calls, on the record)

- Windy is a link-out reference, never a data source or embed (terms, §1).
- Open-Meteo stays the forecast backbone (already shipped, pressure-level capable, free
  tier fits a personal app — re-examine at any commercial turn); RainViewer for radar
  tiles; NWS/Synoptic for US live obs where present.
- My-traces v1 = overlaid low-opacity polylines, not a computed heatmap.
- Forecast presentation adopts the community conventions verbatim: lull/avg/gust, wind
  *from*, probability×amount, visible data age, model+run labeling, >72 h fade.
- No suggested routes, no global heatmap, no forecast paywall theater — constitution and
  research agree.

---

## 3. 🟥 Open questions for Dylan (the genuinely-yours calls)

- **E1 — Map tab landing mode once Explore exists**: keep Record-first, or Explore
  becomes the resting state with Record one tap away? (Lean: Explore-first; see §2a.)
- **E2 — Switcher form**: 3-segment control always visible over the map vs Strava-style
  compact dropdown? (Lean: SegmentedControl — matches the app's shipped pattern; confirm
  it doesn't crowd the header cluster + sport arm on small screens at build time.)
- **✅ E3 — Forecast alerts: DEFERRED, 2026-07-15.** Dylan: "no notifications yet."
  Nothing in F1–F4 builds or depends on alerts; the constitutional ruling (may this ever
  notify, same bar as R6) stays open for whenever alerts are actually proposed.
- **E4 — Forecast mode's place in the build order**: F1 (spot forecast page) is small,
  independent of M5/M6, and buildable immediately after this doc is reviewed — pull it
  forward, or finish the Explore/builder track (M5→M6) first? (Lean: M5 → F1 → M6 —
  F1 is the highest daily-use-per-effort item on this page.)
- **E5 — Confirm the Sections reading** in §2e (route-JSON ranges, self-times first,
  friend-compare Ring 4) before it's specced into the M6 prompt.
- **✅ E6 — Forecast map overlay ambition: RESOLVED 2026-07-15.** Dylan: the wind
  color/streamline overlay "can be a v2 for sure." Map mode v1 = arrows + RainViewer
  radar (spec F4); color-field + particle streamlines = the v2 ladder, bundling the
  light-basemap design question with it.

## 4. Draft build prompt — P4-8 / M5 Explore v1

*Hand to a build session only after this doc is reviewed and E1/E2 are answered. Model:
**Sonnet with you around, or a Fable overnight run** — it's display + navigation work
(no schema, no migration), which fits overnight autonomy; the one judgment-heavy spot is
the long-press gesture spike, which Fable can sim-verify per the P4-7 tap-through
precedent. If you want the gesture behavior watched live, run Sonnet in the day.*

```
Read planning/rework/phase4-session-playbook.md, planning/rework/tabs/map-tab.md (§2, §7
M5, ⚑5), planning/rework/research/explore-forecasting-research.md (§2 — the reviewed
design; §2c is this session's scope), planning/rework/research/routes-implementation.md,
app/(tabs)/map.tsx, src/components/**/RouteMap.tsx, and the latest handoff in dev-log/.

Build M5, Explore mode v1, on the v11 stack. Decisions already made: [Record|Explore|
Forecast → E1/E2 answers here — landing mode + switcher form]; Forecast is a peer mode
but ships EMPTY this pass (mode present only if E2 says show it; no forecast features).
Scope: (1) the mode switcher on the Map tab (SegmentedControl pattern, hidden during a
live recording); (2) Explore browse map with a right-side layers rail — Spots (shared
with Record), Saved routes (polylines + start marker + direction arrows, element-tinted
via tokens, tap → route detail), My traces (all E/S/W sessions with tracks as low-opacity
polylines; Body excluded STRUCTURALLY in the query — map sources only ever select E/S/W);
(3) creation door: map long-press → "New spot here" feeding the existing new-spot form
with coordinates (run the shared gesture spike; keep the crosshair-button fallback);
(4) architecture only for the future builder takeover state (M6) — an explicit mode-state
seam, no builder UI. Cohort layers: gated stubs in code comments, nothing rendered.
No migration (display + navigation only). Sport-aware layer defaults per the research
doc §2b. Single-concern commits; flag (⚑) don't reinterpret.
Finish: full jest, tsc LAST, /code-review, sim smoke test (mode switch both ways, every
layer toggled on real DB data, long-press → new spot round-trip, verify a Body session
never renders), then status-sync + dev-log-closeout skills, and write me a handoff
prompt for P4-9 (the builder). Do not push without asking me.
```

*After M5: P4-9 (builder, prompt already in the playbook — add §2e's Sections
future-proofing note), then the Forecast track (F1–F5, §2d) gets its own spec pass
against this doc once E3/E4 are answered.*
