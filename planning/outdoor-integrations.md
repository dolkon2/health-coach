# Outdoor Sports — Integration Research (v0.1)

*Research notes / feasibility appendix to `training-logging-spec.md`. Captures the data-source landscape for the outdoor sports (paragliding, whitewater kayaking, wing foiling / downwind, mountain biking) so the build sessions start with the homework done. This is a reference dump, not a build spec — no machinery committed here, just what's reachable and how it maps onto the constitution.*

*Companion to `wearable-ingestion-spec.md` (which owns the general GPS-import road: Garmin / HealthKit / Health Connect / file import) and `data-model.md` (the Observation contract).*

---

## Framing (decided this session)

- **Outdoor is an identity grouping, not a new engine.** Same logger as general training; "Outdoor" clusters the sports (climb, surf, hike, paraglide, kayak, MTB…) so those communities feel seen. It is *not* new architecture. Same instinct as the customizable headline row in `training-logging-spec.md`.
- **Logbook first, stimulus second — for almost everything.** Strava is a logbook and that's most of the value: record it happened, see your history, share it (Ring 4). Training-load/stimulus is the *exception* (gym, structured strength), not the default lens. Paragliding is the clearest case — near-zero metabolic load, huge experience/skill event; it belongs in the logbook, not the stimulus ledger.
- **Outdoor needs to extend to many more sports over time.** The value of the pattern below is that each new sport is a small adapter, not a new subsystem.
- **No Strava.** It's a competitor and a structural dependency risk (already rejected in `wearable-ingestion-spec.md` on AI-compliance + dependency grounds). Not used as an import source.
- **Garmin integration has to happen.** Treated as a must, not a maybe. See `wearable-ingestion-spec.md`: summaries come free via HealthKit now; GPS routes (FIT files) need the Garmin Connect Developer Program + a backend, shipping when the backend ships. The "is the program open?" status was the weakest finding in this research and is flagged for a dedicated dig (see Open Questions).

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

---

## Open questions / next sessions

These are deliberately *not* resolved here — flagged so a future session picks them up with context.

1. **"Whole mapping structure" — two readings, both real work, user to disambiguate:**
   - **Literal maps** — a geospatial layer rendering flights, river runs, downwind lines, trails on a map (tile provider, offline maps, route draw/save). A genuine new pillar; deserves its own spec pass.
   - **Source→Observation mapping** — the adapter taxonomy that makes "build out for even more sports" cheap (each new sport = a small normalizer emitting Observations). This is what keeps the outdoor section extensible.
2. **Garmin deep-dive (must-have, weakest current finding).** Confirm current Developer Program status (the "program appears closed to new applicants" claim rests on forum signals, not official confirmation), the FIT-export bridge as the interim path, and exact partner-access requirements. See `wearable-ingestion-spec.md` GPS Route Strategy for what's already decided.
3. **`igc-xc-score` LGPL-v3 dependency** — confirm comfort (user leaning yes). Fine unmodified; matters only if forked.
4. **Spot / saved-run concept** — whitewater (gauge↔run mapping) and wing (named spots with gauges) both want a lightweight user-owned "place" the conditions hang off. Not a heavy schema addition, but it's the one new primitive the outdoor integrations imply. Decide if/when it earns its place.
5. **Extensibility list** — climbing (Mountain Project import — already flagged in `training-logging-spec.md`), surfing, hiking, ski/snowboard, etc. The pattern above should absorb each as a thin adapter; confirm as they come up.

---

## Sources (key)

- Paragliding: [IGC format](https://xp-soaring.github.io/igc_file_format/igc_format_2008.html) · [igc-parser](https://github.com/Turbo87/igc-parser) · [igc-xc-score](https://github.com/mmomtchev/igc-xc-score) · [FlySkyHy](http://flyskyhy.com/features.html)
- Whitewater: [USGS IV API](https://waterservices.usgs.gov/docs/instantaneous-values/instantaneous-values-details/) · [USGS modern API](https://api.waterdata.usgs.gov/docs/) · [AW wh2o-api](https://github.com/AmericanWhitewater/wh2o-api) · [RiverApp](https://www.riverapp.net/en) · [whitewater.guide](https://whitewater.guide/graphql) · [UK EA API](https://environment.data.gov.uk/flood-monitoring/doc/reference)
- Wind/swell: [NDBC realtime](https://www.ndbc.noaa.gov/faq/rt_data_access.shtml) · [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api) · [WeatherFlow Tempest](https://weatherflow.github.io/Tempest/api/) · [Synoptic Data](https://synopticdata.com)
- MTB / GPS: [togeojson](https://www.npmjs.com/package/@tmcw/togeojson) · [fit-file-parser](https://www.npmjs.com/package/fit-file-parser) · [Trailforks API](https://www.trailforks.com/about/api/)
