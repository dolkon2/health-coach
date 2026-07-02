# Outdoor Sports — Integration Research (v0.2)

*Research notes / feasibility appendix to `training-logging-spec.md`. Captures the data-source landscape for the outdoor sports so the build sessions start with the homework done. This is a reference dump, not a build spec — no machinery committed here, just what's reachable and how it maps onto the constitution.*

*v0.1 (2026-06-30) covered paragliding, whitewater kayaking, wing foiling / downwind, and mountain biking. v0.2 (2026-07-01) extends the same pattern to surfing, ski/snowboard, hiking/trail/rucking, the OS-health-floor coverage audit, and the sports-gap triage — resolving v0.1's open question #5. Climbing got its own doc (`climbing-apps-research.md`); a one-paragraph digest lives here. Every load-bearing data-access claim in the v0.2 sections was adversarially fact-checked against live endpoints on 2026-07-01.*

*Companion to `wearable-ingestion-spec.md` (which owns the general GPS-import road: Garmin / HealthKit / Health Connect / file import) and `data-model.md` (the Observation contract).*

---

## Framing (decided this session)

- **Outdoor is an identity grouping, not a new engine.** Same logger as general training; "Outdoor" clusters the sports (climb, surf, hike, paraglide, kayak, MTB…) so those communities feel seen. It is *not* new architecture. Same instinct as the customizable headline row in `training-logging-spec.md`.
- **Logbook first, stimulus second — for almost everything.** Strava is a logbook and that's most of the value: record it happened, see your history, share it (Ring 4). Training-load/stimulus is the *exception* (gym, structured strength), not the default lens. Paragliding is the clearest case — near-zero metabolic load, huge experience/skill event; it belongs in the logbook, not the stimulus ledger.
- **Outdoor needs to extend to many more sports over time.** The value of the pattern below is that each new sport is a small adapter, not a new subsystem.
- **No Strava.** It's a competitor and a structural dependency risk (already rejected in `wearable-ingestion-spec.md` on AI-compliance + dependency grounds). Not used as an import source.
- **Garmin integration has to happen.** Treated as a must, not a maybe. See `wearable-ingestion-spec.md`: summaries come free via HealthKit now; GPS routes (FIT files) need the Garmin Connect Developer Program + a backend, shipping when the backend ships. The "is the program open?" status was the weakest finding in this research and is flagged for a dedicated dig (see Open Questions). *(Update 2026-06-30: dig done — program **blocked** for new applicants + legal-entity requirement; logging ease already delivered gate-free by the OS floor. See `wearable-ingestion-spec.md` § Addendum.)*

---

## The recurring pattern (the actually-useful finding)

All four sports independently landed on the **same architecture**, and every fragile/gated option was the one to avoid:

> **Parse a file or read an open feed locally → emit an Observation → freeze any external context onto that Observation at log time.**

Why "freeze at log time" matters and fits the constitution:
- You never depend on a third party being up when the user later reads old history.
- You store **what happened**, not a prediction — pure mirror.
- It drops straight into the existing schema with `source` + `tier` + `fidelity`, no special-casing.

Tier mapping (consistent across all four):

| Data | Tier | Notes |
| :-- | :-- | :-- |
| IGC track, USGS gauge reading, NDBC buoy, live wind-station reading | **1 — measured** | A recorded/instrument fact. Sovereign. |
| Computed XC distance/triangle score, Open-Meteo model values | **2/3 — derived/modeled** | Sits *beside* the tier-1 fact. Never gates, scores, or contradicts the logged session. |

Constitution guardrail that kept recurring: **conditions are context attached to a tier-1 session, never a score and never a "should I go" push.** Live readings are fine as **pull** (open a spot, see the gauge); a "conditions are great, go send it" notification is the forbidden push.

---

## Per-sport feasibility

### Paragliding — cleanest of the four

**Build on IGC files, not XContest.**

- **XContest has no usable public API.** An `api.dev` endpoint exists but is partner-gated (negotiate by email, terms unconfirmed). The "XContest API" in search results is a third-party *scraper reseller* (parse.bot) that breaks when XContest changes its HTML — avoid. The ecosystem is built around *uploading* IGC to XContest, not pulling it back out.
- **IGC is the real surface and it's excellent.** FAI-standard plain-text tracklog. B-records carry UTC time, lat/lng, and *both* baro + GPS altitude per fix → duration, max altitude, and gain compute directly, offline, no network.
- **The user's app = FlySkyHy** ("I Fly Sky High" → FlySkyHy, iOS). Exports signed IGC (and already computes its own triangle distances). Other exporters: XCTrack (Android), SeeYou Navigator / Oudie (Naviter — the "CU Navigator"), XCSoar, Skytraxx, Syride, Flymaster. IGC is universal across all of them.
- **Libraries (on-device, plain TS — fits `core/`):**
  - `igc-parser` (Turbo87) — **MIT.** Parses headers + B-records into `{ time, latitude, longitude, valid, pressureAltitude, gpsAltitude }`. https://github.com/Turbo87/igc-parser
  - `igc-xc-score` (mmomtchev) — **LGPL-v3.** Computes free distance + flat/FAI triangle using **XContest's own scoring rules** (also FFVL/FAI/XCLeague). Node + browser. Consumes igc-parser's output. https://github.com/mmomtchev/igc-xc-score
- **License note:** `igc-xc-score` is LGPL-v3 — fine as an unmodified npm dependency; obligations attach only if forked/modified. Conscious-decision flag since the rest of `core/` is ours. *(User leaning OK with it.)*
- **Mapping:** IGC track → tier-1 Session; computed XC distance/triangle → tier-2 derived figure with confidence.

### Whitewater kayaking — strong open path

**Goal is logbook enrichment: tag a saved run with the flow at the time it was paddled.**

- **USGS Water Services = the foundation (US).** Free, **no API key, no auth, no hard rate limit**, JSON.
  - Param codes: `00060` = discharge (CFS), `00065` = gauge height (ft).
  - Instantaneous values back to **Oct 2007** at ~15-min resolution → query the exact flow at a run's timestamp with a tight `startDT`/`endDT` window.
  - Legacy host (workhorse today): `https://waterservices.usgs.gov/nwis/iv/`. Modern OGC-API replacement rolling out: `https://api.waterdata.usgs.gov/`. **Abstract the host — USGS is mid-migration.**
  - Example: `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=09504500&parameterCd=00060,00065`
- **American Whitewater = the run→gauge mapping + "runnable range" context.** ~6,000 US runs, each correlated to a gauge with low/med/high recommended-flow bands (`R0–R9`). This is the "is 800 CFS low or huge for *this* run" judgement USGS alone can't give.
  - **No officially supported public API**, but the stack is open-source (`AmericanWhitewater/wh2o-api`, `wh2o-vue`) and the JSON that powers their SPA is reachable. Treat as **undocumented** — cache aggressively, check ToS, and ideally use it once to *seed the user's gauge↔run mapping*, after which it's pure USGS lookups forever.
- **RiverApp (riverapp.net) = the "Forever/River app" the user meant. Confirmed: it runs on NOAA data and has no public API.** This is a *good* tell — it means RiverApp has no secret sauce; you can replicate the part worth having (flow at saved runs) directly off the same free NOAA/USGS feeds. Not integrable, not needed.
- **International:** fragmented per country. UK is easy (Environment Agency Real-Time flood-monitoring API, Open Government Licence, no registration: `https://environment.data.gov.uk/flood-monitoring/`). Broadest semi-open international option is `whitewater.guide` (GraphQL endpoint, partly CC-licensed) — verify terms.
- **No MCP server exists** for USGS, AW, RiverApp, or whitewater.guide — thin adapter either way.
- **Mapping:** flow reading frozen onto the Session at log time = tier-1 fact with source + high fidelity.

### Wing foiling / downwind — live wind gauges are the headline

**The interesting feature here is real-time wind readings at a spot (gauges), not modeled swell.** Pull-based: open a spot, see what the wind is doing now. (Stays constitution-clean as long as it's pull, never a push.)

- **Live wind-station sources (the iKitesurf / Gorge-style gauges):**
  - **WeatherFlow Tempest API** — the network *behind* iKitesurf/iWindsurf/SailFlow, i.e. exactly the dense local coverage in places like the Columbia Gorge. Free **personal access token** (tempestwx.com → Settings → Data Authorizations). REST + WebSocket, station wind speed/dir/gust. **Caveat: personal/non-commercial use only — the proprietary dense sites aren't ours to redistribute in a shipped product.** Good for *your own* logbook now; needs a license to ship broadly. https://weatherflow.github.io/Tempest/api/
  - **Synoptic Data / Mesonet API** — the best *open* route to local/agency wind sensors (RAWS, airports, port sensors), lat/lng-queryable, free academic/personal tier. https://synopticdata.com
  - **NDBC buoys** — free, no key; report wind where buoys exist (coastal). https://www.ndbc.noaa.gov/data/realtime2/{STATION}.txt
- **Modeled fallback (gap-filler, global):** **Open-Meteo** — free, no key, takes lat/lng + time directly, returns wind (Forecast/Historical APIs; wind history via ERA5 back to 1940) and swell (Marine API: wave/swell height, period, direction). Stored as **modeled** (lower tier). https://open-meteo.com/en/docs/marine-weather-api
  - Caveat: marine **wave** archive is only a few years deep (wind history is deep) — verify `start_date` floor before relying on it for old sessions.
- **The honest hard case — inland/fetch-driven venues (the Gorge downwinder):** no ocean swell to model, and ocean buoys don't reach. For those spots it's **station wind only** (Tempest / Synoptic), no swell — set expectations honestly; don't promise swell tagging that can't be delivered.
- **Skip** Windy (forecast-shaped, opaque pricing, storage restrictions), Surfline (no official API, ToS-gray), Stormglass (clean but 10 req/day free, then paid — only if consolidating later).
- **Mapping:** live gauge reading = tier-1 measured wind; Open-Meteo = tier-3 modeled, beside it, never gating.

### Mountain biking — needs almost nothing special

**MTB is "a Ride with a mountain sub-type."** Every file format records the GPS track; the sport tag is the only MTB-specific bit.

- **General GPS import road is owned by `wearable-ingestion-spec.md`:** HealthKit/Health Connect for summaries + Apple Watch routes now; **Garmin** Connect Activity API (FIT files) for full routes when the backend ships. **No Strava** (competitor + AI-compliance/dependency risk).
- **File import is the universal floor (always works, zero gatekeeping):**
  - GPX + TCX → `@tmcw/togeojson` (BSD-2, zero-dep, browser-safe, preserves HR/power extensions). https://www.npmjs.com/package/@tmcw/togeojson
  - FIT → `fit-file-parser` (MIT). **Avoid `@garmin/fitsdk`** — proprietary FIT Protocol License, no redistribution.
  - Every platform (Garmin, Wahoo, Apple Health export, even Trailforks ridelogs) exports one of GPX/FIT/TCX.
- **Trailforks API = dead end for this case.** Partner-gated, "not usually granted to students and individuals for personal projects," share-alike clause blocks commercial use. The only MTB-unique data (trail names, conditions) is the one source not worth betting on. https://www.trailforks.com/about/api/
- **Mapping:** GPS track → tier-1 Session, `modality: ride`, sub-type `mountain`; feeds the stimulus ledger like any ride (aerobic/glycolytic).

### Climbing — full research in `climbing-apps-research.md` (v0.2)

**The digest:** fifteen apps converged on one core ascent record (route ref, grade-as-entered + system tag, personal grade opinion beside consensus, two-axis style, attempts, stars, comment) — adopt it. Gate-free import paths verified live: **Mountain Project per-user CSV tick export** (API dead since 2020, but the export survives, no auth), **8a.nu/Vertical-Life free CSV export** (the de facto interchange format), **BoardLib CSV** for Aurora boards (Tension; Kilter died with the March 2026 Aurora split — logbooks stranded mid-flight, the loudest vindication of freeze-at-log-time yet). Route reference: **OpenBeta** (CC0, free GraphQL, no key) + **@openbeta/sandbag** (MIT, TypeScript, client-side grade conversion). theCrag/KAYA/Lattice are import formats or nothing — never dependencies. HealthKit `.climbing` = envelope only (no grades, no bouldering split). One spec tension flagged: the market wants per-climb + optional per-attempt granularity for indoor bouldering; `training-logging-spec.md` currently says session-level only — resolve at surface finalization.

### Surfing — the conditions stack is free; the wave count needs provenance

**Goal: session logbook (spot, board, wave count) + a frozen conditions snapshot (swell, tide, wind) at log time.**

- **Specialty apps converged** on the same session record: spot, in/out times, wave count, top speed, longest ride (feet AND seconds), distance paddled, board. That's our surface, plus the conditions snapshot and a note.
- **Surfline is a walled garden** — no public API (staff-confirmed), ToS bans scraping; unofficial wrappers are violations. No dependency, period. **Dawn Patrol** (the reference Apple Watch surf app) writes workouts to Apple Health — so our HealthKit floor ingests its sessions (duration/HR/calories/route) for free; wave count does NOT cross HealthKit, ever (no such data type).
- **Apple Watch native**: `HKWorkoutActivityType.surfingSports` exists (an umbrella: surf + kite + windsurf) with a first-party watch mode, but captures HR/time only — no waves, no route. So: **HealthKit envelope + ~10-second app-native detail entry** (wave count, board) is the model, same as climbing.
- **Wave-count provenance is the honest move**: hand-counted vs watch-counted vs unknown, recorded on the field (Rip Curl exposes a detection-sensitivity dial — auto-counts are tier-2 derived, fidelity = detection method).
- **The gate-free conditions stack (all verified live 2026-07-01):**
  - **NOAA NDBC buoys** — free, no auth: `ndbc.noaa.gov/data/realtime2/{station}.txt` (met + wave height/period/direction) and `{station}.spec` (swell/wind-wave split). Fixed-width text, trivial client-side parse. Realtime rolls off at **45 days** — a hard argument for freezing at log time, not backfilling later. Tier 1.
  - **NOAA CO-OPS tides** — free, keyless JSON; predictions ≤10yr per request; US stations only; NOAA throttles volume under load (space requests). Observed level = tier 1; harmonic predictions = tier 3 at high fidelity.
  - **Open-Meteo Marine** — free, no key; **default archive only reaches Oct 2021** — pass `models=era5_ocean` for hourly waves back to **1950 in practice** (docs claim 1940; 1940–49 returns nulls; 0.5° grid, coarse near coast). Tier 3 modeled, the gap-filler.
  - Wind: NDBC where a buoy is near (tier 1), Open-Meteo otherwise (tier 3). Onshore/offshore is the surf-relevant fact.
  - **Skip Stormglass** — aggregates what the free stack already provides, keyed + quota'd.
- **Mapping:** HealthKit envelope + user detail = tier-1 session; auto wave metrics = tier 2; frozen buoy/tide = tier 1, modeled wave/wind = tier 3, all stamped with source + station distance.

### Ski / snowboard — the richest OS floor of any sport here

**Goal: day-session logbook (runs, vertical, speeds) + touring as its own sub-type + frozen snow/avalanche context.**

- **HealthKit is unusually generous**: Apple Watch downhill workouts arrive with **per-run segment events** carrying avg/max speed, alpine slope grade, and elevation descended (`HKMetadataKeyAlpineSlopeGrade` etc.), plus `distanceDownhillSnowSports` per run — verified against Apple's live docs. The ski logbook substantially **populates itself** from the OS floor, zero vendor work. (Health Connect is weaker: a single undifferentiated `SKIING` type, no per-run metadata — discipline is a user tag on Android.)
- **Slopes** (category leader): no API, but exports GPX ×3 variants / KMZ / backup per recording **plus bulk "export all recordings" since Jan 2026**; writes calories + backcountry uphill segments to HealthKit. **Ski Tracks**: local-first, account-free, 15 years old — the philosophical neighbor; exports GPX/KMZ + writes HealthKit. **Snoww is dead** (cloud gone ~2024, histories stranded — same lesson as Kilter). **Carv**: prescriptive technique scoring, no export — the anti-mirror; ignore.
- **Touring/backcountry must be a distinct sub-type**: the skin up is gym-shaped aerobic work (vertical gain, duration, HR → stimulus ledger); the descent is pure logbook. Slopes and Mtn Tracks both treat uphill as first-class — so do we.
- **Frozen context, all free, verified live:** **avalanche.org v2 API** (no auth, GeoJSON zone polygons, danger level + travel advice + issue/expiry — a *forecast*, so tier 3, frozen WITH its expiry timestamp so staleness is visible forever); **SNOTEL via NRCS AWDB REST** (no key, snow depth/SWE/temp from ~900 western-US stations — tier 1, fidelity decays with distance from the trailhead, record station id); **OpenSkiMap** (ODbL, daily GeoJSON/GeoPackage dumps, ~7,000 areas / ~96,000 named runs — bundle a stripped snapshot client-side for resort/run naming; raw runs file is 234 MB, strip to names+geometry).
- **Mapping:** track/vertical/HR = tier 1; run/lift/skin segmentation + run counts = tier 2; avalanche rating = tier 3 frozen with expiry; phone-GPS max speed is spike-prone — fidelity note.

### Hiking / trail running / rucking — one adapter (trail names), one field (load)

**Goal: the GPS surface already covers it; what's missing is honest naming + conditions, and rucking's load field.**

- **Trail naming is gate-free via OSM Overpass** (verified live): query `route=hiking` relations + named paths around trace points, freeze matched name + OSM id at log time. Fair-use ~10k queries/day; **must send a descriptive User-Agent** (generic UAs get 406 since April 2026). Fidelity reflects match ambiguity. **USFS trails** (free ArcGIS REST + bulk GeoJSON, 86k trails) enriches official names inside national forests; Nominatim (1 req/s) for locality fallback.
- **AllTrails**: no public API (DataDome-protected; a community scraper MCP was shut down Jan 2026), but **GPX export needs only a free account** (not AllTrails+ — corrected in verification) and it writes workouts to HealthKit — both honest paths. **Borrow its one-tap condition-tag taxonomy** (muddy / snow / ice / bugs / rocky / overgrown / washed-out) — cheap structured context, frozen at log time, exactly our pattern. **Gaia**: everything-exportable (GPX/KML/GeoJSON, bulk) — the posture to match for our own export story. **Komoot**: post-acquisition paywall creep (device sync gated for new accounts; GPX export requires the region unlocked) — the case study in third-party dependency rot; borrow only its per-tour **surface-type % breakdown** (paved/gravel/singletrack, derivable client-side from OSM — a genuinely useful tier-2 summary). **FarOut**: walled garden, but its timestamped waypoint condition reports ("spring flowing 6/28") are the purest freeze-at-log-time UX in the wild. **Trailforks: reject** (approval-gated, share-alike terms incompatible).
- **Rucking is a field, not a surface**: `load_kg` first-class on a GPS session + optional gear snapshot (RUCKR freezes the exact rucksack/plates onto each session — our pattern applied to equipment). **No OS support anywhere** — verified: neither HealthKit nor Health Connect has a rucking type or any carried-weight field (rucking apps write plain hiking/walking workouts) — so the load field is ours or nobody's. Load-adjusted calorie models (Pandolf) = tier 3, labeled.
- **Mapping:** trace/HR = tier 1 (fidelity by device); trail name = tier-1 context with match-ambiguity fidelity; condition tags + load = tier-1 self-report; surface %, per-gear mileage = tier 2; forecasts + load-model calories = tier 3.

---

## The OS health floor at a glance (verified against Apple/Android docs, 2026-07-01)

What the free ingestion floor actually delivers per sport — this table is why the adapter list above is so short:

| Sport | iOS enum | Watch 1st-party | What arrives free | Android (Health Connect) |
| :-- | :-- | :-- | :-- | :-- |
| Run / ride / hike | native types | rich | HR, GPS route, distance, elevation; cycling power/cadence | ✅ (no MTB/trail split either OS) |
| Downhill ski / snowboard | `.downhillSkiing` / `.snowboarding` | **rich** (watchOS 11: + distance/route map) | **per-run segments: vertical, speeds, slope grade** | single `SKIING` type, no per-run detail |
| XC ski / skating / rowing | dedicated types | rich since watchOS 11 | distance + speed types (iOS 18) | `ROWING` **and** `ROWING_MACHINE` (better split than Apple) |
| Swim (pool / OWS) | `.swimming` + location metadata | rich | strokes, SWOLF, water temp (Ultra) | separate `SWIMMING_POOL` / `_OPEN_WATER` types |
| Climbing | `.climbing` (no bouldering split) | envelope only | HR + duration; **no grades/attempts ever** | `ROCK_CLIMBING` |
| Surfing | `.surfingSports` (umbrella incl. kite/windsurf) | envelope only | HR + duration; **no wave count ever** | `SURFING` |
| Kayak / SUP / canoe | `.paddleSports` (lumped, no whitewater) | envelope only — **no GPS distance/map even in watchOS 26** (third-party apps fill this) | HR + duration | `PADDLING` (lumped) |
| Paragliding | **nothing** → `.other` + our subtype tag | nothing | manual/IGC only (v0.1 section stands) | `PARAGLIDING` exists (!) |
| Kitesurf / wingfoil | inside `.surfingSports` | nothing dedicated | HR + duration | **nothing** → other |
| Skateboard | `.skatingSports` (incl. skateboarding) | generic | HR + duration | generic `SKATING` |
| Rucking | **nothing** (apps write hiking/walking) | n/a | no load field on either OS | nothing |

Two build consequences: **(1)** every ingested workout needs an app-side sub-discipline tag (user-set, tier-1 self-report) — the OS enum can suggest, never determine (bouldering-vs-rope, MTB-vs-road, whitewater-vs-flat, tour-vs-resort all live only in our tag). **(2)** On Android, reading another app's `ExerciseRoute` triggers a per-route consent dialog — fetch routes in-foreground during import and freeze them onto the Observation immediately, or risk never getting them.

---

## Sports-gap triage (vs Strava's 56 sport types, Garmin's 100+, Apple's 84)

The three-layer model makes most of this trivial — a new sport = identity label + surface pointer + energy tag. The triage:

**Add now (labels on existing surfaces, minutes each):**
- **Walk** — the single biggest gap; every rival has it; pure GPS surface. (Also where rucking's sessions land when imported.)
- **Ruck** — GPS surface + the `load_kg` field (the one new field this whole audit produced).
- **Row (water), canoe, SUP, sail, windsurf, kitesurf** — GPS surface labels.
- **Ski touring, snowshoe, XC ski, ice/inline skate** — GPS surface labels (touring gets the sub-type treatment above).
- **Open-water swim** — already specced as GPS-shaped; add the conditions freeze (same buoy/tide stack as surf).
- **Martial arts / BJJ, dance** — practice surface + optional key-value attributes (gi/no-gi, rounds, sparring %). The BJJ apps (Marune etc.) are attribute-rich duration logs with no export — nothing to integrate, everything to imitate.
- **Row-erg** — gym-adjacent: distance/time pieces + stroke rate. Maps onto the interval shape the pool-swim surface already implies; label now, richer later via Concept2.

**Add later (real work, clearly scoped):**
- **Concept2 Logbook adapter** — the one genuinely open specialty API found anywhere in this audit (verified: free OAuth2, granular scopes, currently no rate limits, webhooks; splits + stroke-by-stroke data; their verified-vs-manual flag maps 1:1 onto our fidelity field). Needs OAuth via Expo AuthSession (no backend) — our first OAuth adapter, so it carries setup cost; do it when erg users exist.
- **Triathlon as composition** — multisport FIT files encode each leg as its own session message (transitions too); parent Observation (tier-2 composition) + child sessions. A parser extension to the existing FIT plan, not a new format — newer Garmin files need timestamp-based record slicing.
- **Racket sports (tennis / padel / pickleball) — the one real new-surface pressure.** Huge communities (padel ~19M players), no open player-facing data ecosystem (Playtomic's API is club-gated and booking-centric; SwingVision's ceiling is a user-initiated xlsx). A match record (opponent, score, W/L, optional shot detail) doesn't fit any existing surface. Ship as practice-duration labels now; decide on a match surface only if racket users materialize.
- **International conditions parity** — Avalanche Canada + EAWS (Europe, open CAAML), UK river gauges (v0.1), global buoys. Same freeze pattern, later phases.

**Skip (deliberate):**
- **Golf** — saturated with closed specialists (Arccos/18Birdies/TheGrint, no export APIs); the training-relevant part (a round is a 10 km walk) is a GPS label away if ever wanted. No scorecard surface.
- **Hunting / fishing, team-sport match stats, SwingVision/Playtomic integrations** — out of scope; the practice surface catches the training component.

---

## Open questions / next sessions

These are deliberately *not* resolved here — flagged so a future session picks them up with context.

1. ✅ **"Whole mapping structure" — RESOLVED (2026-06-30) by splitting the two readings:** the *literal maps* reading became its own spec (`gps-mapping-spec.md` — capture ladder, routes as first-class, map display, cohort map); the *source→Observation mapping* reading is this doc's adapter pattern, now exercised across eleven sports.
2. ✅ **Garmin deep-dive — RESOLVED (2026-06-30): blocked.** Program suspended for new applicants + legal-entity requirement; logging ease already delivered by the OS floor; route handled by native GPS capture + Layer-2 file import. Full findings: `wearable-ingestion-spec.md` § Addendum.
3. **`igc-xc-score` LGPL-v3 dependency** — confirm comfort (user leaning yes). Fine unmodified; matters only if forked.
4. **Spot / saved-place concept — now four sports heavy.** Whitewater (gauge↔run), wing (spots with wind gauges), surf (breaks with buoy + tide station), ski (areas/zones with SNOTEL + avalanche zone) all want a lightweight user-owned "place" the conditions hang off. It's the one new primitive the outdoor integrations imply, and v0.2 doubled the demand. Recommend blessing it — see `outdoor-sports-master-plan.md` ⚑4.
5. ✅ **Extensibility list — RESOLVED (2026-07-01) by v0.2 of this doc** + `climbing-apps-research.md`: climbing, surfing, ski/snow, hiking/trail/rucking researched; OS-floor audit + sports-gap triage added. Remaining follow-ups now live in `backlog.md` and the master plan.
6. **Climbing surface finalization** — the research is done; the surface decision (per-climb + optional per-attempt for indoor bouldering, revising `training-logging-spec.md` § Climbing) needs a blessing pass. See `climbing-apps-research.md` ⚑1.
7. **Racket-sport match surface** — the one genuine new-surface pressure found by the gap audit. Deliberately deferred; practice-duration labels in the meantime.

---

## Sources (key)

- Paragliding: [IGC format](https://xp-soaring.github.io/igc_file_format/igc_format_2008.html) · [igc-parser](https://github.com/Turbo87/igc-parser) · [igc-xc-score](https://github.com/mmomtchev/igc-xc-score) · [FlySkyHy](http://flyskyhy.com/features.html)
- Whitewater: [USGS IV API](https://waterservices.usgs.gov/docs/instantaneous-values/instantaneous-values-details/) · [USGS modern API](https://api.waterdata.usgs.gov/docs/) · [AW wh2o-api](https://github.com/AmericanWhitewater/wh2o-api) · [RiverApp](https://www.riverapp.net/en) · [whitewater.guide](https://whitewater.guide/graphql) · [UK EA API](https://environment.data.gov.uk/flood-monitoring/doc/reference)
- Wind/swell: [NDBC realtime](https://www.ndbc.noaa.gov/faq/rt_data_access.shtml) · [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api) · [WeatherFlow Tempest](https://weatherflow.github.io/Tempest/api/) · [Synoptic Data](https://synopticdata.com)
- MTB / GPS: [togeojson](https://www.npmjs.com/package/@tmcw/togeojson) · [fit-file-parser](https://www.npmjs.com/package/fit-file-parser) · [Trailforks API](https://www.trailforks.com/about/api/)
- Climbing (v0.2): see `climbing-apps-research.md` sources — [OpenBeta](https://openbeta.io) · [@openbeta/sandbag](https://github.com/OpenBeta/sandbag) · [BoardLib](https://github.com/lemeryfertitta/BoardLib) · [MP tick export](https://www.mountainproject.com)
- Surf (v0.2): [NDBC realtime](https://www.ndbc.noaa.gov/faq/rt_data_access.shtml) · [CO-OPS tides API](https://api.tidesandcurrents.noaa.gov/api/prod/) · [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api) · [Smartfin (open surf research)](https://github.com/UCSD-E4E/smartfin)
- Ski (v0.2): [Apple downhill HealthKit docs](https://developer.apple.com/documentation/healthkit/receiving-downhill-skiing-and-snowboarding-data) · [avalanche.org API](https://github.com/NationalAvalancheCenter/Avalanche.org-Public-API-Docs) · [SNOTEL AWDB REST](https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui/index.html) · [OpenSkiMap](https://openskimap.org)
- Hike (v0.2): [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) · [USFS trails](https://data-usfs.hub.arcgis.com) · [Waymarked Trails](https://hiking.waymarkedtrails.org)
- Gap audit (v0.2): [Concept2 Logbook API](https://log.concept2.com/developers/documentation/) · [Strava SportType enum](https://developers.strava.com/swagger/sport_type.json) · [HealthKit workout types](https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype) · [Health Connect ExerciseSessionRecord](https://developer.android.com/health-and-fitness/health-connect)
