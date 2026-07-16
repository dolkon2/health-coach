# Forecast F2 — Direct NOAA live observations

*2026-07-15. Branch: `main` (local, not pushed — 5 commits ahead of
`origin/main` for this pass).*

## What was built

Per `planning/rework/tabs/forecast-tab.md` (F2, §3 data table, §6) and the
ground rules in `phase4-session-playbook.md`:

- **NWS client** (`core/src/conditions/nws.ts` + `src/lib/conditions/nwsClient.ts`)
  — `api.weather.gov`, free, no key. Chains `/points/{lat},{lng}` → the
  gridpoint's `observationStations` collection → the nearest station
  (haversine, not API list order) → that station's `/observations/latest`.
  Unit-honest: wind only read when `unitCode` is one this file can convert
  to knots (km/h or m/s), temp only when `degC`. User-Agent attached per
  NWS's usage policy (extended `fetchJson`'s shared deps with an optional
  `headers` map for this — every other caller unaffected).
- **Synoptic/MesoWest client** (`core/src/conditions/synoptic.ts` +
  `src/lib/conditions/synopticClient.ts`) — free tier (5k req/mo), the
  ODOT/WSDOT road-station gap-fill for where NWS's own network is sparse.
  Missing token → null with **zero fetches fired**, same pattern as
  `config.ts`'s `mapTilerUrl`. Radius/recency query params derive from a
  new shared `observationThresholds.ts` (split out to avoid a circular
  import with `liveObservation.ts`) rather than a second, independently
  hardcoded pair of numbers.
- **`fetchLiveObservationForSpot`** (`src/lib/conditions/liveObservation.ts`)
  — the combinator: NWS first, Synoptic only when NWS has nothing usable
  within `MAX_STATION_RADIUS_KM` (50, placeholder) or fresh within
  `STALE_READING_CUTOFF_MIN` (90, placeholder). 10-minute TTL cache mirroring
  `current.ts`'s shape, keyed by spot id — bounds both the Synoptic budget
  (one lookup per spot view, cached) and NWS refetching on screen refocus.
- **UI**: `WindForecastCard` (`ForecastPanelCard.tsx`) renders the live
  reading in its own bordered "LIVE — station" block below the model
  chart — station name, distance, and reading age always together, never
  blended into the forecast's avg/gust numbers. `liveWindLabel`
  (`forecastPanels.ts`) formats it distinctly from the forecast's
  `windHeaderLabel` ("X avg / Y gust kt" vs "X avg, gusting Y kt") so the
  two registers read as different even before styling. `windLullKts` stays
  plumbed through the type but always undefined this pass — neither source's
  common variable set exposes a standard lull field.
- Extracted `nearestTo()` into `core/geo.ts` (the "pick the closest
  candidate by haversine" reduction both new clients need) rather than a
  third copy of that loop.

**No migration.** **No map work.** **No notifications** (E3 stays deferred).

## Verification

- **jest:** 142 suites / **1443 tests** pass (up from F1's 135/1399 — all
  new: `conditionsNws.test.ts`, `conditionsSynoptic.test.ts`, `geo.test.ts`,
  `nwsClient.test.ts`, `synopticClient.test.ts`, `synopticClientNoToken.test.ts`,
  `liveObservation.test.ts`, plus extensions to `forecastPanels.test.ts`).
- **tsc --noEmit:** 0 errors.
- **`/code-review` (high effort, 8 finder angles + 5-agent verify pass):**
  12 candidates survived verification. Fixed:
  - `WindForecastCard`'s early-return "Forecast unavailable" fired before
    the `observed` prop was ever considered, silently dropping a valid live
    station reading whenever the model forecast lacked wind data — the
    early return now only fires when BOTH are absent.
  - `isUsable()` rejected any reading whose timestamp looked even slightly
    "in the future" (device clock skew, not an NTP-disciplined server)
    with zero tolerance — clamped to 0 instead of rejecting.
  - Synoptic's server-side search radius (25 mi ≈ 40.2 km) was tighter
    than the app's own 50 km usability cutoff and hardcoded independently
    — a usable 40–50 km station could never even reach `isUsable()`. Now
    derived from the shared `MAX_STATION_RADIUS_KM`.
  - `parseSynopticLatest` picked the "freshest" observation via a plain
    lexicographic string sort, which mis-orders two ISO timestamps of
    differing precision — switched to comparing parsed epoch time.
  - Two reuse/cleanup findings applied in-scope: extracted `nearestTo()`
    (was duplicated verbatim between the two new clients) and cleaned up
    `nws.ts`'s verbose inline type-narrowing to match `usgs.ts`'s
    cast-once style.
  - Three findings explicitly **not fixed** (would touch previously-shipped
    F1 files outside this diff's single concern — flagged as future
    consolidation instead): `finite()` triple-duplicated across
    `nws.ts`/`synoptic.ts` vs. `forecast.ts`/`usgs.ts`'s `parseValue`;
    `liveObservation.ts`'s TTL cache duplicating `current.ts`'s shape;
    NWS's points→stations chain not cached separately from the 10-min
    observation TTL (2 extra round-trips per refresh — real but low
    severity, NWS has no request quota).
  - Two findings judged **no change needed**: `windLullKts` staying
    undefined is intentional, documented scaffolding, not dead code; and
    centralizing the `SYNOPTIC_TOKEN` guard like `mapTilerUrl` would be a
    premature abstraction for the one call site that exists today.
- **Sim (iPhone 17 simulator, real device DB, seeded via direct SQLite
  insert, deep-linked via `xcrun simctl openurl`):** a spot at Hood River
  4S2's real coordinates resolved the ACTUAL live NWS station — "Ken
  Jernstedt Airfield," 1.8 km away, 26 min old — rendered correctly beside
  the model forecast in its own block; a remote mid-Pacific spot correctly
  showed **no live line at all** (honest absence — the model forecast still
  rendered independently). No Synoptic token is configured in this
  environment, so that fallback path is untested live; the no-token
  short-circuit (zero fetches) is unit-tested. No runtime errors in either
  screenshot. Test spots deleted after; Home confirmed back to its
  original single-spot ("White Slmon") state.

## ⚑ Flags

- **⚑1 (carried from F1) — Gust color-step thresholds (13/21 kt)** still a
  placeholder, untouched this pass.
- **⚑2 — `MAX_STATION_RADIUS_KM` (50 km) and `STALE_READING_CUTOFF_MIN`
  (90 min) are placeholders**, same "flag a number, don't invent a silent
  rule" convention as F1's gust thresholds. Confirm these, or that they're
  fine, before they're load-bearing for anything else — Synoptic's query
  params now derive from them, so a future change here also moves Synoptic.
- **⚑3 — Synoptic's response shape (`synoptic.ts`/`synopticClient.ts`) is
  best-effort against the public v2 docs, not live-verified.** This
  session has no real Synoptic token to test against (`EXPO_PUBLIC_SYNOPTIC_TOKEN`
  unset in this environment) — register one and re-verify field names
  (`STATION`, `UNITS`, `OBSERVATIONS.<var>_value_1`) against a real
  response before trusting this path in production.
- **⚑4 — NWS single-nearest-station design.** If the nearest station is
  offline while a second-nearest one is reporting, this degrades to "no
  live reading" rather than trying the next station. Reasonable MVP scope
  (mirrors `usgsClient`'s single-site fetch); revisit if that proves
  common.
- **⚑5 — A spot's coordinate-change cache staleness is theoretically
  possible but currently unreachable.** `liveObservation.ts`'s 10-min cache
  is keyed by `spot.id` only, not coordinates — if a future edit-location
  flow (P3, unshipped) lets a user move a spot, the cache could serve the
  old location's reading for up to 10 minutes. Not fixed now (nothing can
  trigger it today); worth a look once P3 ships.

## Not done / deferred

- F3 (windgram/Meteo panel), F4 (Forecast map mode / Explore crosshair
  reuse), F5 ladder — unchanged from F1's list.
- ⚑2 of F1 (persistable "zero panels" state) and ⚑4 (no TTL cache on the
  model forecast fetch) — both still open, untouched this pass.
- The three skipped code-review findings above (§ Verification).
- Live verification of the Synoptic path (⚑3).
- Push/merge — not requested; `main` is 5 commits ahead of `origin/main`
  for this pass.

## Safe to leave as-is?

Yes. Branch is green (jest/tsc clean), `/code-review` findings applied and
re-verified, sim-tested with a genuine live network round-trip against the
real NWS API (not a mock) confirming the whole chain end-to-end, honest
absence confirmed for a station-less location, sim left in its original
state. The five open flags are documented placeholders/judgment calls, not
regressions — ⚑3 (Synoptic unverified) is the one worth prioritizing before
this path is trusted in front of real users, since it's the one piece with
zero live-network confirmation.
