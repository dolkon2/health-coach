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
