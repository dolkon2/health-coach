# Dimension: Earth — build session log (2026-07-05)

Branch `dimension/earth`, worktree `~/Projects/health-coach-earth`. Baseline at start: 485 jest / 48 suites green, tsc clean, main @ `e68e473`.

Scope (Dylan, 2026-07-05): tech integrations + API connections, not UI (redesign in flight). Sports: Climbing, Running, Trail Running, Cycling, MTB, Hiking, Skiing. Gear = shared base entity + per-sport spec blocks. Running/Trail-run = two activities sharing capture. Crag pin = auto-GPS, editable, no trace.

## Pass plan

| Pass | Concern | Commit |
|------|---------|--------|
| E1 | Gear/quiver entity (M010, core type, derived mileage, session gearIds, minimal picker) | |
| E2 | eleSource labeling on GeoPoint + elevationGainSource on EnduranceBlock | |
| E3 | Conditions freeze: Open-Meteo / SNOTEL / avalanche.org clients + snapshot on save | |
| E4 | Climbing: ladder fields, sandbag grades, crag pin | |
| E5 | Climbing CSV import: BoardLib first, 8a.nu best-effort | |
| E6 | HealthKit workout + HKWorkoutRoute ingestion (run/ride/hike) | |
| E7 | Skiing bespoke: SkiingBlock, HK per-run segments, snow/avy freeze, private-by-default | |
| E8 | Computation libs: GAP (Minetti), MTB descent segmentation, hiking fields | |

## ⚑ Decisions made at unresolved forks (flag-once ledger)

⚑ **E-1 tsSec semantics.** mapping-architecture-spec.md:106-108 pins `tsSec` = seconds-since-start; every live writer + persisted row stores Unix epoch. Decision: **stored payload stays Unix epoch** (back-compat, no discriminator exists to tell rebased from epoch rows apart); rebasing happens only inside a future processed `Track`. The spec line should be amended when track.ts lands.

⚑ **E-2 Freeze timing.** "Frozen at log time, never backfilled" was motivated by NDBC's 45-day rolloff. Earth sources (Open-Meteo, SNOTEL) are archival. Decision: **best-effort fetch at save with a short timeout; offline → session saves without conditions, no retry queue this pass.** A later fetch pinned to `occurredAt` against an archival source would be honest, but is deferred rather than silently added.

⚑ **E-3 Conditions payload.** No spec defines the shape. Decision: `conditions?: ConditionsSnapshot` on SessionPayload — open struct, per-domain optional sub-objects (weather/snow/avalanche for Earth), each reading carrying `source`, `tier` (instrument=1, modeled/forecast=3), `fetchedAt`; avalanche additionally `issuedAt`/`expiresAt` so staleness is visible forever. Water/Sky add their own sub-objects — same low-conflict pattern as SessionPayload blocks.

⚑ **E-4 Gear mileage is derived-on-read**, never a stored odometer (outcome-measured ethos). Components are child gear rows (`parentId` → bike); a component accrues from sessions tagging its **parent** from the component's `acquiredAt` forward. Service thresholds are user-set facts displayed descriptively ("612 km — past your 500 km mark"); no alerts, no push.

⚑ **E-5 Crag pin stored inline** as `location? {lat,lng,name?}` on ClimbingBlock, not as a Spot row — the blessed Spot primitive is the right eventual home but is a cross-dimension entity (Water hangs gauges off it); building it unilaterally on this branch invites a merge collision. Promote pin → Spot when Spot lands. Device pin is the session's location fact; an OpenBeta lat/lon is route metadata and never overwrites it.

⚑ **E-6 NP + power series deferred.** No power data exists in the model (no FIT parser, HK power series ingestion not in this scope). Building `np.ts` now = dead code tested against nothing real. Deferred with the cycling power ingestion pass.

⚑ **E-7 GAP model = Minetti energy-cost curve** (published, error band documentable) rather than Strava's proprietary fit. Output labeled estimated. Error band noted in the module doc.

⚑ **E-8 HK-vs-manual dedupe.** wearable-ingestion-spec covers Garmin-vs-Watch only. Decision: HK ingest **skips** a workout whose time window overlaps an existing session of the same modality family (manual is sovereign; the user logged it). Documented in normalizeWorkouts.

⚑ **E-9 eleSource per adapter**: expo-location → `gps`; GPX `<ele>` → `gps` (device unknowable — understate, never overstate); HKWorkoutRoute point altitude → `gps` (Watch fuses baro but Apple doesn't tag it; claiming barometric would fabricate certainty). `barometric` is reserved for sources that declare it: HK `elevationAscended` metadata → `elevationGainSource: 'barometric'` on EnduranceBlock.

⚑ **E-10 Backcountry privacy** = `private?: boolean` on SessionPayload, set true when resort-vs-backcountry flag = backcountry. Single-user app today; the field is the honest placeholder sharing must honor later (payload JSON → no migration).

⚑ **E-11 Migration numbers.** This branch takes **010 (gear)**. dimension/body, /sky, /water exist and the runner is append-only by integer — two branches claiming 010 breaks the merge. Suggested rule for Dylan: earth reserves 010–012; sky/water/body coordinate before merging to main.

⚑ **E-12 CSV parsing hand-rolled** (minimal RFC4180 in core, fixture-tested) per the prefer-adding-nothing rule; `@openbeta/sandbag` IS added (MIT, zero deps, the grade authority we shouldn't rebuild). 8a.nu columns are undocumented anywhere — parser is built tolerant, from web-researched samples, flagged if confidence is low.

⚑ **E-13 Errata**: dimension-earth-session.md:40 says "ClimbingData … no sends summary, no grades" — the type is `ClimbingBlock` and it already has `sends[{grade,attempts,sent,route?}]` + `totalProblems` (observation.ts:179-183). Ladder level 2 is mostly built; level 3 is an extension.

## Pass log

(appended per pass)

### E1 — Gear/quiver entity (2026-07-05)

Built end to end, uncommitted (left dirty for review). 507 jest / 51 suites green (was 485/48), tsc clean.

- `core/src/gear.ts` — GearCategory (Earth arms; other dimensions extend on their branches), Gear = base ∩ per-category spec arm (Shoe/Boot/Bike/BikeComponent/Ski), `deriveGearTotals` (derived-on-read ⚑ E-4; component inherits parent-bike sessions gated by acquiredAt; distinct-civil-day counting in the SESSION'S OWN tz via `localDayOf` — GearSessionLike carries `tz`, and the acquiredAt gate compares local days, not UTC slices (review fix 2026-07-05; the first cut sliced UTC); distance/duration undefined-not-0), `gearStatusLine` (descriptive marks only). Re-exported from core index.
- Migration `010_gear` (⚑ E-11 numbering) + `src/storage/gear.ts` CRUD (retire ≠ delete; corrupt spec JSON → absent spec, never a throw).
- `SessionPayload.gearIds?` + SessionForm plumbing (written only when non-empty; absent hydrates to []). Activity registry: gearCategories on run/trail-run (shoes), hike/walk/ruck/snowshoe (boots+shoes), ride/mtb (bike), ski/snowboard/ski-touring/xc-ski (skis).
- `app/gear.tsx` spartan modal (list grouped by category + status lines, add form, Retire) off Settings; log-session footer gains a multi-select gear chip row, rendered only when the activity declares categories AND matching active gear exists.
- Note: the add form omits an acquiredAt field this pass (core supports it; a component added mid-life inherits all parent history until an install date can be entered — surface it with the UI redesign).

#### E1 review fixes (2026-07-05, pre-commit)

- `deriveGearTotals` counted days and gated acquiredAt by UTC slice — now tz-aware (`localDayOf`, `tz` on GearSessionLike); tests cover the PST evening-session cases both directions.
- `pickActivity` kept stale gearIds across an activity switch while the chip row filtered them invisible — now pruned via `pruneGearIdsForCategories` (lib/session.ts, tested).
- Quiver retire stamped the UTC calendar date into a LocalDate field — now `todayLocalDate()`.
- Quiver screen rendered "0 sessions" off a failed/unfinished observation read — now: no status line until the read lands, and a failed read surfaces "Could not read session history — totals unavailable." (a failed read is not an empty record).

### E2 — elevation source labeling (2026-07-05)

Built, uncommitted. 527 jest / 53 suites green (baseline 513/51), tsc clean.

- `core/src/observation.ts`: `GeoPoint.eleSource?` + `EnduranceBlock.elevationGainSource?` with named exported unions (`ElevationSource` incl. reserved `'none'`, `ElevationGainSource` incl. `'manual'`); precedence + never-label-without-a-value rules in the doc comments. Types only — no runtime, no migration; pre-E2 rows hydrate with both keys absent (tested).
- Writers (⚑ E-9): `useGpsTracker` fix→GeoPoint mapping extracted to exported pure `locationToGeoPoint` (altitude → `eleSource:'gps'`; no altitude → neither key, never `'none'` on write); `gpxImport.parsePoint` stamps `'gps'` on `<ele>` points only.
- `lib/session.ts`: endurance slice threads `elevationGainSource`; build writes it only alongside a written `elevationGainM`; inverse restores it (absent → absent). New pure reducer `applyElevationGainEdit`: any direct edit → `'manual'` (even over a `'gps'` prefill); cleared/unparsable → both keys removed.
- `app/log-session.tsx`: GPX import + live capture stamp `'gps'` with the prefilled gain; route-attached caption gains "elevation: GPS / barometric / terrain model / entered by hand" (muted dataSm line, shown only when known). **Deviation:** the form had NO elevation-gain input at all (`elevationGainM` was prefill-only), so the design's edit→manual path had nothing to hang on — added an "Elevation gain (m, optional)" Field to the GPS card wired through the reducer (existing Field component, no new components). Number-pad, whole metres.
- `barometric`/`dem` have no writer yet by design — `barometric` arrives with HK `elevationAscended` in E6; `dem` with a future correction pass.

#### E2 review fixes (2026-07-05, pre-commit)

Four confirmed findings (all verified against the code; the empty-`<ele>` parser behavior reproduced live against fast-xml-parser before fixing). 538 jest / 53 suites green, tsc clean.

- **Import carryover fabricated provenance** — `importGpxFile` spread `...f.endurance`, so importing a second, `<ele>`-less GPX kept the previous file's `elevationGainM` + `'gps'` label (and a stale `captureMeta`) attached to the NEW route. Extracted pure `enduranceWithRoute` (lib/session.ts) — rebuilds the slice, never spreads; both the import path and `applyCapturedRoute` now go through it, so gain/source/meta come exclusively from the incoming route while hand-entered avgHr/energySystem/distance survive. Tested (sessionGpxImport.test.ts).
- **Empty `<ele></ele>` → fabricated sea-level point** — fast-xml-parser yields `''` for an empty tag and `Number('')` is 0, so `parsePoint` minted `eleM: 0, eleSource: 'gps'` and the phantom point exploded the hysteresis gain (repro: 1500→''→1510 gave +1510, not +10). Now a reading requires a non-empty numeric string (null ≠ 0). Tested.
- **`<rtept>` elevations stamped `'gps'`** — a planned `<rte>`'s `<ele>` values are planner/terrain-model output no device ever measured; `'gps'` overstated (the direction ⚑ E-9 forbids). `parsePoint` now stamps `'gps'` for `<trkpt>` only; `GpxImportResult` carries `elevationGainSource: 'gps'` only when the gain came from a recorded `<trk>`, and the log-session prefill uses the parser's label instead of assuming — an `<rte>` gain saves and displays with no source caption. Tested.
- **Explicit 0 silently erased at build (null ≠ 0)** — the `> 0` gate dropped a typed 0 (`'manual'`) and a measured flat-track 0 (`'gps'`) that the form caption was already displaying as fact, and the reducer accepted negatives that likewise vanished at save. Build now writes a 0 that carries a source (a sourceless 0 still never lands); `applyElevationGainEdit` treats negatives as cleared (gain is a non-negative accumulator) and keeps 0 as a declared flat session. Tested incl. round-trip.

### E3 — conditions freeze (2026-07-05)

Built end to end, uncommitted. 578 jest / 59 suites green (E2 baseline 538/53), tsc clean. All client tests run against the real captured API responses (recon 2026-07-05) via injected fetchImpl — zero live network in CI.

- `core/src/conditions.ts` — ConditionsProvenance (tier 1|3 per outdoor-integrations.md:32-37, source, fetchedAt), WeatherConditions (tier 3, 'open-meteo', modelHourUtc audit trail), SnowConditions (tier 1, 'snotel:<triplet>', distanceKm recorded so staleness-by-distance stays visible per :127), AvalancheConditions (tier 3, frozen WITH issue/expiry; danger_level -1 "no rating" is a valid frozen fact), ConditionsSnapshot (open struct — Water/Sky add their own sub-objects on their branches, ⚑ E-3). Plus pure `nearestHourIndex`. `core/src/geo.ts` — the haversine MOVED here (single copy; `lib/geo.ts` now re-exports it) + `haversineKm` + `pointInMultiPolygon` (even-odd ray casting, GeoJSON [lng,lat] flip isolated in one place). Both re-exported from core index.
- `src/lib/conditions/openMeteo.ts` — host recency rule (≤92 days → forecast host w/ computed past_days + freezing_level_height; older → archive host start/end dates, freezing NEVER requested there — the archive returns HTTP 200 with an all-null series, fixture-proven); nearest-hour mapping, null slot → key absent, snowfall unit honored (cm verbatim, mm converted, unknown dropped). `snotel.ts` — no radius param exists on AWDB, so: padded state-bbox table (13 SNOTEL states) → `*:XX:SNTL` wildcard fetch → client-side haversine; east coast → null with zero fetches; values arrays can SKIP days (absent ≠ null ≠ 0 — July melt-out fixture: depth 0 lands as 0, skipped PRCPSA stays absent). `avalancheOrg.ts` — one map-layer GET + point-in-polygon (layer mixes Polygon/MultiPolygon — normalized); start_date/end_date kept VERBATIM as center-local naive strings (no fabricated Z); product endpoint deliberately not called this pass. `freeze.ts` — freezeEarthConditions: never throws, each sub-fetch independently caught AND raced against a per-fetch deadline (default 4000 ms) so a hung socket can't hang save; all-fail → {} treated as absence (⚑ E-2).
- `SessionPayload.conditions?` (observation.ts, type-only import — no runtime cycle) + form plumbing: `endurance.conditionsMeta` rides like captureMeta/importMeta; build writes payload.conditions only WITH an attached route; inverse restores absent → absent; enduranceWithRoute drops a prior route's frozen sky (new geometry starts honest).
- `app/log-session.tsx` — weather-only wiring this pass (snow/avalanche join the ski surface in E7): route attach (GPX import + live capture) fires the freeze best-effort with the first track point + route start (fallback now); the snapshot lands only if the SAME route (identity check) is still on the form; a save that wins the race simply has no conditions. Live path uses global fetch via the injected-deps default (foodBarcode pattern). No conditions UI this pass (redesign in flight; pull-only context, nothing prescriptive anywhere).
- Fixtures copied into `src/lib/conditions/__fixtures__/` (8 files): open-meteo forecast-past3 / archive-2026-06-05 / archive-freezing-all-null (the HTTP-200 silent-null capture) / error-bogus-variable; snotel stations-or-sntl (all 82 real OR stations) / data-651-march-week / data-651-recent-week (skipped-day capture); avalanche-map-layer-trimmed (4 zones with FULL geometry: Mt Hood 1657, Southern Oregon 1369 null-dates, Newberry 2471 multi-ring, Sierra Madre 2843 — 12 KB, trimmed from the 173 KB live response).
- Deviations from the pass design, with reasoning: (1) pointInMultiPolygon + haversineKm live in `core/src/geo.ts` rather than conditions.ts — they're geometry, not conditions, and geo.ts is where the moved haversine had to land anyway; still "helpers from core". (2) The design's "hole-free multi-ring" polygon test point uses Newberry's 75-pt outer ring (43.72,-121.22) — the fixture's only multi-ring feature; its tiny 4-pt satellite rings are degenerate slivers no point reliably falls in (verified against the live geometry). (3) fetchSnotelConditions returns null (not a value-less husk) when the station reported nothing for the whole day — freezing a station identity with zero readings would be noise, not context; partial days still freeze partially. (4) The ConditionsSnapshot round-trip test lives with the session tests (src/lib/__tests__/session.conditions.test.ts), not duplicated in core — build/inverse are app-side. (5) freeze's dateLocal is optional; snow asked for without it is SKIPPED, never derived from a UTC slice (tz honesty precedent from E1).
