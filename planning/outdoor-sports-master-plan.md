# Outdoor Sports, GPS & Garmin — Master Plan (v0.1)

*Consolidation doc. On 2026-06-30, three parallel planning sessions landed on three separate branches: the **Garmin connection** dig (`wearable-ingestion-spec.md` § Addendum + backlog updates), the **GPS & mapping** spec (`gps-mapping-spec.md`), and the **outdoor sports** integration research (`outdoor-integrations.md`). This branch merges all three into one workspace, adds the sport-expansion research they each pointed at (climbing, surfing, ski/snow, hiking — see `climbing-apps-research.md` and `outdoor-integrations.md` v0.2), and this doc is the map: how the pieces fit, what's decided, what's flagged for blessing, and the order the work lands in.*

*Companion to `training-logging-spec.md`, `wearable-ingestion-spec.md`, `gps-mapping-spec.md`, `outdoor-integrations.md`, `cohorts-spec.md`, `backlog.md`.*

---

## The story in one paragraph

The Garmin dig found the direct API is **blocked** (program suspended for new applicants + legal-entity requirement) — but also found that the thing a Garmin connection was actually *for* (a run done on the watch auto-appears with its stats) is **already delivered free** by the OS health floor, no gate. What the blocked API withheld was the *route* — and the GPS session solved that from the other direction: **native in-app GPS capture**, a deliberate reversal of "the app is not building a GPS tracker." Native capture makes the route first-party for anything recorded in the app; wearable import demotes to enrichment for activities recorded elsewhere. On top of that, the outdoor research found that every outdoor sport plugs into the same socket — *parse a file or read an open feed locally → emit an Observation → freeze external context on it at log time* — so each new sport is a thin adapter, not a subsystem. Three sessions, one converging conclusion: **the outdoor build needs no gated partner, no backend, and no per-sport architecture.**

---

## How the two models fit together

The Garmin addendum thinks in **layers** (where a route *arrives from*). The GPS spec thinks in a **capture ladder** (what the user *does* to get one). Same machine, two views — here is the joint:

| Wearable addendum (arrival) | GPS spec ladder (capture UX) | Gate | Status |
| :--- | :--- | :--- | :--- |
| **Layer 0 — OS health floor** (HealthKit + Health Connect summaries; Apple Watch / likely Galaxy Watch routes) | **Rung 1 — watch import** | none | Phase 3, in build |
| **Layer 1 — native GPS capture** | **Rung 2 — in-app phone tracking** | none | direction change, ⚑ needs blessing |
| **Layer 2 — manual FIT/GPX/TCX file import** | *(no rung — enriches a rung-1/4 session after the fact)* | none | backlog, small self-contained pass |
| **Layer 3 — direct vendor APIs** (backend; open vendors first, **not** Garmin) | *(feeds rung 1 eventually)* | backend + vendor approval | deferred |
| *(no layer — geometry reuse, not arrival)* | **Rung 3 — reuse a saved route** | none | Phase 6 (routes as first-class) |
| *(no layer — no geometry at all)* | **Rung 4 — manual numbers, no map** | none | exists today (the honest floor) |

The two views are complementary, not competing: layers answer "where does geometry come from," rungs answer "what does the user touch." Every cell that matters is **gate-free and backend-free**. The one place the docs disagree is flagged below (⚑2).

---

## Decided (recorded in the specs, no action needed)

- **Garmin direct API is off the table** — blocked, not deprioritized. Revisit only if the program reopens *and* a legal entity exists. (`wearable-ingestion-spec.md` Addendum)
- **Logging ease from Garmin is already solved** by Layer 0 — summaries sync via Apple Health / Health Connect, poll-on-open, no gate. The blocked API was only ever needed for routes + tier-3 scores. (Addendum, Reframe)
- **No Strava, structurally** — competitor + its ToS is designed to prevent exactly our core thesis (AI reasoning over the timeline). (`wearable-ingestion-spec.md`)
- **Outdoor is an identity grouping, not a new engine.** Logbook-first; stimulus is the exception (gym-shaped work), not the default lens. (`outdoor-integrations.md`)
- **The adapter pattern**: parse file / open feed locally → Observation → freeze context at log time. Tier discipline: instrument readings are tier-1 context; computed scores and modeled weather are tier-2/3, beside the fact, never gating it. (`outdoor-integrations.md`)
- **The map never lies**: a route is imported, recorded, or reused — never fabricated. Routeless sessions read as complete, not broken. (`gps-mapping-spec.md`)
- **Self-vs-self is a mirror; vs-strangers is a scoreboard.** Own-route history: yes. Global segments/KOMs: never. Cohort-scoped course challenges: allowed within `cohorts-spec.md` constraints. (`gps-mapping-spec.md`)
- **Privacy zones are a hard gate** before any route is ever cohort-visible. (`gps-mapping-spec.md`)

---

## ⚑ Flagged for blessing (deliberately not resolved here)

Per the working rule — flag, don't reinterpret — these are queued for Dylan, in priority order:

1. **⚑ The native-GPS direction change itself.** `backlog.md` records it as "DIRECTION CHANGE, decision pending" and requires it be *blessed and written into* `training-logging-spec.md` § Outdoor / GPS before building. `gps-mapping-spec.md` is effectively that spec (rung 2 is first-class, pull-only, spine-checked) — but the ⚠ in `training-logging-spec.md` still stands and the section hasn't been rewritten. **Blessing = say yes, rewrite that section, drop the ⚠.** Everything GPS-shaped downstream sequences off this.
2. **⚑ Stale Garmin wording inside `gps-mapping-spec.md`.** Its rung 1 and timeline table still say Garmin routes arrive via "the backend + Connect Activity API" / "Garmin route via FIT files (rides Ring 3/4 backend)" — written a minute before the Garmin addendum landed. The addendum's finding supersedes: the direct API is blocked, and FIT import is a *client-side manual* path (Layer 2), no backend. Small text fix, but it touches a contract-adjacent doc, so it rides along when ⚑1 is blessed rather than being edited silently.
3. **⚑ `igc-xc-score` is LGPL-v3.** Fine as an unmodified npm dependency; obligations attach only if forked. User leaning yes — confirm and note it, or pick a different triangle-scorer later. (`outdoor-integrations.md`)
4. **⚑ The "Spot / saved place" primitive.** Whitewater (gauge ↔ run mapping), wing (named spots with wind gauges), and now surf (named breaks with buoy + tide) and ski (named areas with SNOTEL/avalanche zone) all want a lightweight user-owned *place* that conditions hang off. Four sports asking is a pattern: this is the one new primitive the outdoor work implies. Recommend blessing it as a small entity (id + name + latlng + linked condition sources), same spirit as `Route`. (`outdoor-integrations.md` open Q4, now heavier)
5. **⚑ `Route` entity vs `GpsTemplateShape` upgrade** — decide in the Phase 6 build plan (gps spec open Q2; likely a distinct `Route` entity referenced by templates and sessions).
6. **⚑ In-app tracking placement** — Phase 3 fast-follow vs Phase 4 GPS-surface enrichment (gps spec open Q1; resolve when the Phase 3 map render lands).

---

## Sport expansion — the new work on this branch

*The three June-30 sessions each pointed at the same next step: extend the pattern to the sports it hasn't absorbed yet. `training-logging-spec.md` has carried "deep dive into climbing apps before finalizing the climbing surface" since v0.1; `outdoor-integrations.md` open Q5 listed climbing, surfing, hiking, ski. That research is now done (2026-07-01, this branch — 7 research tracks, 42 load-bearing claims adversarially fact-checked against live endpoints). Full detail: `climbing-apps-research.md` + `outdoor-integrations.md` v0.2. The read-across:*

**1. The pattern held everywhere.** Climbing, surfing, ski, hiking, rucking, rowing — every sport slots into *parse a file / read an open feed → Observation → freeze context at log time* with zero new architecture. The three-layer model (identity label → logging surface → engine tag) absorbed all of it; the whole audit produced exactly **one new field** (`load_kg` for rucking), **one already-flagged primitive** (Spot/place), and **one deferred surface pressure** (racket-sport match records).

**2. The specialty-app world validated the constitution, negatively.** KAYA paywalls your attempt history; Crimpd paywalls CSV export of your own data; Stokt lets your climb library expire if a gym stops paying; Carv has no export at all; Snoww's cloud died and stranded users' histories; **Kilter's backend was shut off mid-lawsuit in March 2026 and logbooks went dark overnight**. Every one of these is an argument the product already makes: local-first, freeze-at-log-time, your data is yours. The honest private logbook isn't a nice-to-have in these communities — it's the thing the incumbents keep taking hostage.

**3. What's actually reachable, verified live (2026-07-01):**

| Sport | Import path (gate-free) | Conditions / reference data (free) | OS floor gives |
| :--- | :--- | :--- | :--- |
| Climbing | Mountain Project CSV tick export; 8a.nu CSV; BoardLib CSV (Aurora boards) | OpenBeta route DB (CC0 GraphQL) + sandbag grade lib (MIT) | envelope only (HR/time; no grades, no bouldering split) |
| Surfing | HealthKit (Dawn Patrol + native watch write into it) | NDBC buoys + CO-OPS tides + Open-Meteo marine (era5_ocean to 1950) | envelope only (no wave count — app-native field) |
| Ski / snow | HealthKit; Slopes GPX/KMZ (+ Jan-2026 bulk export) | avalanche.org API + SNOTEL REST + OpenSkiMap (ODbL) | **rich**: per-run vertical, speeds, slope grade (Apple) |
| Hike / ruck | HealthKit; GPX from AllTrails (free acct) / Gaia / CalTopo | OSM Overpass trail names (needs descriptive User-Agent) + USFS trails + NWS/Open-Meteo | rich (route + elevation); no load field anywhere — ours |
| Rowing / erg | Concept2 Logbook API — the one genuinely open specialty API found (OAuth2, no rate limits, stroke-level data, verified-vs-manual flag ≈ our fidelity) | — | rowing + rowing-machine types both exist |
| Paragliding (v0.1) | IGC files (igc-parser MIT) | — | iOS: nothing (`.other`); Android: `PARAGLIDING` exists |
| Whitewater (v0.1) | GPS/FIT | USGS gauges (no key) + American Whitewater mapping | lumped into paddling |

**4. Sports to add.** Add-now labels (minutes each, no code): **walk, ruck (+load field), row, canoe, SUP, sail, windsurf, kitesurf, ski touring, snowshoe, XC ski, skate, open-water swim, martial arts/BJJ, dance, row-erg.** Add-later: Concept2 OAuth adapter, triathlon-as-composition (multisport FIT parser extension), racket match surface (the one expensive case — practice labels until demand shows). Skip: golf scorecard, hunting/fishing, team match stats.

**5. Sub-discipline tags are load-bearing.** The OS floor lumps aggressively (`.paddleSports` = kayak+SUP+canoe; one `SKIING` on Android; `.climbing` with no bouldering split; `.surfingSports` includes kitesurf). Every ingested workout needs an app-side sub-discipline tag — user-set, tier-1 — that the OS enum suggests but never determines. This is cheap (it's the identity layer doing its job) but must be in the ingestion adapter's design from day one.

---

## Build sequence (proposed, weaves into existing phases — nothing new jumps the queue)

| When | What | Why there |
| :--- | :--- | :--- |
| **Phase 3** (in build) | Layer 0 ingestion (HealthKit reader + Apple Watch routes) — unchanged; add the **sub-discipline tag** to the adapter design; fetch-and-freeze routes in-foreground (Health Connect consent lesson) | already specced; the research only sharpens it |
| **Phase 3 fast-follow** | ⚑1 blessing → **native GPS capture** chunk (`gps-mapping-spec.md` rung 2) | unblocks the watchless route path; placement itself is ⚑6 |
| **Small self-contained passes** (slot anywhere after Phase 3) | **FIT/GPX/TCX file import** (Layer 2 — one parser, covers Garmin/Slopes/Gaia/AllTrails exports); **climbing CSV importers** (MP, 8a.nu, BoardLib) + OpenBeta tagging; **conditions-freeze adapters** (buoy/tide, SNOTEL/avalanche, Overpass trail names, USGS gauges from v0.1) — each is a thin, independent adapter | the whole point of the pattern: none of these block anything, each lands alone |
| **Phase 4** (templates) | **Climbing surface finalization** (⚑ in `climbing-apps-research.md`) — the research it was waiting on is done; hangboard assessments wire into benchmarks | the backlog already placed it here |
| **Phase 6** (Plan tab) | **Routes as first-class** (`Route` entity, follow/compare, ⚑5) | resolves that spec's routes-as-sub-shape question |
| **Phase 8** (cohorts) | Cohort map + course challenges, **privacy zones first** | per `gps-mapping-spec.md` |
| **Backend era** (whenever it exists) | Layer 3 vendor APIs (open vendors first — Fitbit/Polar/Oura; **not** Garmin); Concept2 can come earlier since it needs no backend | per the addendum |
| **Anytime** | Add-now sport labels + `load_kg` + activity-picker additions | five-minute identity-layer config |

---

## Open questions index (everything ⚑, one place)

| # | Question | Lives in | Blocks |
| :-- | :--- | :--- | :--- |
| 1 | Bless the native-GPS direction change + rewrite `training-logging-spec.md` § Outdoor/GPS | backlog / gps-mapping-spec | the native-capture build |
| 2 | Fix stale Garmin wording in `gps-mapping-spec.md` (rung 1 + timeline) | this doc ⚑2 | nothing (rides with #1) |
| 3 | `igc-xc-score` LGPL-v3 comfort | outdoor-integrations Q3 | paragliding scoring only |
| 4 | Spot/place primitive (4 sports now want it) | outdoor-integrations Q4 | conditions-freeze adapters (partially) |
| 5 | `Route` entity vs `GpsTemplateShape` upgrade | gps-mapping-spec Q2 | Phase 6 build plan |
| 6 | In-app tracking placement (Phase 3 fast-follow vs Phase 4) | gps-mapping-spec Q1 | scheduling only |
| 7 | Climbing surface finalization (per-climb + per-attempt ladder vs current session-only stance) | climbing-apps-research ⚑1 | climbing logging build |
| 8 | Climbing import scope for the first pass (MP + 8a.nu + BoardLib recommended) | climbing-apps-research ⚑2 | climbing import build |
| 9 | Racket-sport match surface — build ever? | outdoor-integrations Q7 | nothing (deferred by design) |
| 10 | Terrain/DEM elevation source; MapLibre vs Mapbox | gps-mapping-spec Q3–4 | map display build |
