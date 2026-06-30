# Backlog

*Deferred items, open constraints, and known quirks — scattered across the planning docs and dev-log, collected here so nothing slips. One item per line, grouped by where it lands. Not a roadmap — the build sequence still lives in `game-plan-and-prompts.md` and the phase specs.*

---

## Phase 2 / Ring 2 (nutrition)

**Next (post live on-device smoke test, 2026-06-28) — priority order. Each: plan files → jest green → tsc clean (last) → single-concern commit + dev-log.** Core engine (passes 2.1–2.6) is built, green, and verified live on the iOS sim (search → USDA → adapter → rollup → fidelity → Log meal all work end-to-end). These are the follow-ups the smoke test surfaced:

1. **Today's food + daily total** — logging persists but nothing surfaces it; Today looks unchanged after "Log meal". Add a "Today's food" section to `app/(tabs)/index.tsx`: today's foodEntry observations (food name + macros + fidelity-tier dot) + a running daily total (cal + P/C/F), nulls excluded (never summed as 0). The loop-closer — top priority.
2. **Food names on items** (resolves quirk 19) — the meal preview + saved-meals picker show `50 g · usda` with no food name, so a saved meal is unreadable. Add `description?: string` to `FoodItem` (flagged core touch in `core/src/observation.ts`; the search candidate + USDA/OFF detail already carry it), populate it in the 2.2 adapters, render it in the preview + picker, and carry a name onto `MealTemplate`.
3. **Search ranking** — USDA results are noisy: typo'd/junk branded entries (e.g. "MILD CHEDDAR SLICEED CHEES") rank above the clean generic "Cheese, Cheddar" (Foundation/SR Legacy). Rank Foundation/SR-Legacy above Branded (or use USDA `dataType`/relevance sort) in `src/lib/foodSearch.ts`. The connection is fine — this is data quality + ordering, which we own.
4. **2.7 barcode** — "will be key" (Dylan). OFF UPC is free/no-auth and the schema reserves `barcode`, but it needs a native scanner dep (`expo-camera` / `react-native-vision-camera`) + a dev build (Expo Go can't run a custom scanner). STOP and confirm the dep + dev-build move before building. (ring2-food-logging-plan.md fast-follow 2.7) → **build plan:** `planning/ring2-camera-build.md` (2.7a/b barcode + 2.8a/b photo; deps + dev-build resolved 2026-06-29).

- Supersede pattern for editing sessions — deferred from Pass 6 logging deep-dive, lands here. `supersede` already exists for weigh-ins (`storage/observations.ts`); sessions need the same affordance. (game-plan-and-prompts.md HALT)
- Delete-a-session affordance on Today's session cards. (game-plan-and-prompts.md HALT)
- Earned-fidelity mechanic for food logging — direction unspecified, but the fidelity-as-first-class principle wants something more than a static field. (constitution principle 3, product-overview.md)
- TDEE cold-start — onboarding ships a standard height/weight/activity calculator as a **transparent low-fidelity placeholder**, overwritten by measured TDEE once the weight trend clears the noise floor; the one spot the app knowingly uses a population formula, labeled as the weak predicted kind. (benchmarks-spec.md v0.3, "TDEE cold-start")
- ✅ Composite meals — DONE in Ring 2 Pass 2.1: `FoodEntryPayload` carries `items: FoodItem[]`, flat macros are their rollup. (data-model.md open question, resolved)
- iCloud / encrypted SQLite backup — losing 6 months of data to a phone wipe would suck. (phase-1-build-spec.md open question)
- Progress photo storage — `kind: 'progressPhoto'` Observation with file path in payload? Settings feature, not Phase 1. (data-model.md open question)

---

## Phase 3 (HealthKit / Health Connect / Garmin ingestion)

*See `wearable-ingestion-spec.md` § Addendum (2026-06-30) for the layered route model these items now sit inside.*

- ✅/⛔ Garmin Connect partner program research — RESOLVED (2026-06-30): **blocked.** Developer Program is suspended for new applicants (access form pulled, no resumption date) *and* requires a legal entity (rejects personal-use). Path B (Garmin direct Activity API) is off the table until both clear. Open Wearables does not bypass it — same per-vendor credentials. (wearable-ingestion-spec.md Addendum)
- FIT/GPX/TCX manual import — NEW, gate-free, platform-agnostic. User exports an activity file from Garmin/Coros/etc; client-side parse attaches the route to the existing session. The one buildable thing that fills the Garmin route gap with no backend and no developer program, on both iOS and Android. Likely a small single-concern pass. (wearable-ingestion-spec.md Addendum, Layer 2)
- Health Connect (Android) is a Layer-0 peer of HealthKit, not a someday-stub — the product spans Android/Samsung users, so the floor is two readers behind the one `WearableSource` interface. Has a first-class `ExerciseRoute` type; Galaxy Watch likely passes routes the way Apple Watch does (verify on-device). Samsung's own direct Data SDK is partner-gated — use Health Connect, not the SDK. (wearable-ingestion-spec.md Addendum, Layer 0)
- HealthKit native build requirement vs Expo Go — open constraint. HealthKit needs a custom dev client / EAS build; Expo Go won't carry it. Decision blocks how the daily-loop dogfooding continues once ingestion lands.
- Garmin / HealthKit deduplication — if both connected, a single run can arrive twice. Adapter layer needs `(source, provider-side ID)` dedupe key + deterministic preference order. Type system already accommodates via `ObservationSource`. (data-model.md open question)
- Hike fields — elevation gain, pace — not captured manually; expected to come from API import. (game-plan-and-prompts.md HALT)
- Manual-fallback fidelity for GPS sessions when no wearable connected. (training-logging-spec.md "Outdoor / GPS")
- iOS-vs-cross-platform decision — deferred until the HealthKit / Health Connect integration layer forces it. (product-overview.md)
- Timezone in `dayKey` (quirk #1) — fix before shipping to other timezones or when sync/import lands. Currently UTC-slice; works for US Pacific/Mountain morning weigh-ins, not for general use.
- Weekly grouping buckets by UTC (quirk #10) — same fix as #1, paired.

---

## Phase 4 (workout templates / library)

- Exercise library API selection — wger vs ExerciseDB vs curated static dataset. Implementation decision for the build phase. (training-logging-spec.md)
- Exercise library data source decision — curated static seed vs wger/ExerciseDB API. Deferred from the Phase 4 core cut: only a minimal ~80–100-exercise static seed (muscle groups + movement patterns pre-tagged, `src/lib/exerciseSeed.ts`) ships in core, for gym autocomplete + pattern pre-tagging so the stimulus ledger isn't blind to gym sessions. Full decision needed before the Pass 4 fast-follow. (phase-4-training-plan.md)
- Climbing app research — Kaya, Crux, Toplogger, Mountain Project deep dive. Indoor vs. outdoor climbing have meaningfully different logging needs; finalize the climbing surface after this. (training-logging-spec.md "Climbing")
- Mountain Project API / data import for outdoor climbing history. (training-logging-spec.md "Climbing")
- Exercise demo / description content — stretch goal on library entries. (training-logging-spec.md "Exercise library")

---

## Phase 5 (Ring 1 full Reflect tab + Benchmarks)

- Benchmarks entry UX — Structured path (v1, deterministic) + Described path (keyword resolver → Haiku-class parser); open risk is how visibly the inferred dimension is confirmed before commit, so the resolver never silently mis-maps. (benchmarks-spec.md v0.3)
- Active benchmark cap — "not infinite" is decided; the exact number is a design-feel call. (benchmarks-spec.md open question)
- Milestone data model lightness — do they carry their own target values or are they just named markers on the benchmark's data dimension? (benchmarks-spec.md open question)
- Benchmark creation timing — onboarding / first-open / lazy-once-data-exists; partly resolved — cadence benchmarks spawn contextually from the Training tab (phase-6-plan-tab-spec.md). (benchmarks-spec.md v0.3)
- Coach door placement — where the summoned coach lives (settings too buried, a nav tab too central). (benchmarks-spec.md v0.3)
- Reflect customization depth — how much of the benchmark-driven dashboard is reorderable/hideable (pull MacroFactor's "Dashboard Customization" article to set the bar). (benchmarks-spec.md v0.3)
- Training tab — planned workouts → Today as to-dos that become logged sessions. Changes Today's model from "what happened" to "what's planned + what happened." (game-plan-and-prompts.md HALT)
- Activity log formatting / presentation on Today and in history. (game-plan-and-prompts.md HALT)
- `reveal()` speaks engine-native units (kg, km), not display units (quirk #6). Pass display unit into `reveal(session, opts)` or convert in UI when the kg/lb mismatch grates.
- Climb / hike / other weeks underrepresented in stimulus ledger bars (quirk #9) — engine already accumulates `byEnergySystem` minutes, currently unused by UI. Eventual fix: energy-system parallel view and/or richer climb data (grade-weighted load).
- Duration required on every session, no start/stop timer (quirk #8) — add timer or make duration optional if logging friction shows up in 2-week use test. (Phase 4 Pass 3 resolves this — live-timestamped sets, duration derived from first→last set spread, no manual entry. phase-4-training-plan.md)
- JSON payload query performance — evaluate before the Phase 5 Reflect tab build. Date/type queries are fine today; querying *inside* session payloads (Reflect drill-downs, AI consultant) will force an indexed-columns vs scan-and-parse decision. (phase-4-training-plan.md)

---

## Phase 6 (Plan tab / scheduling)

- **Spec session done → `phase-6-plan-tab-spec.md` (v0.1, 2026-06-28).** The vision is locked: the Training tab *is* the planning surface (week view + user-authored library), planning is opt-in, the connected flow (template → live session → Finish → Reflect) reuses the Phase-4 machinery, and the three plan flavors (placed workouts / cadence goals / open activities) coexist in one week. Cadence goals resolve to benchmarks (`benchmarks-spec.md`), not a second system. **Still open before a build plan:** week-view shape, recurrence model, placement granularity, routes-as-sub-shape, planned-vs-actual surfacing — see that spec's Open Questions. Do not build ahead of a blessed pass-by-pass plan.
- Original framing (now subsumed by the spec): program structure (recurring splits, multi-week date-anchored blocks, freeform saved-workout stacks), scheduling workouts onto days, the Today ↔ planned-workout handoff, and saved workouts that flex across all surfaces (gym template, cycling route, running route). (phase-4-training-plan.md, game-plan-and-prompts.md)

---

## Phase 7 (Ring 3 AI consultant)

- Described resolver upgrades to a Haiku-class parser for benchmark input — natural language ("climb 5.12") without menu navigation, same data model — **and the summoned coach ships** (prescription-on-request, grounded in the user's data, output user-owned). (benchmarks-spec.md v0.3, "Summoned coach")

---

## Phase 8 / Ring 4 (cohorts)

- Cohort events / challenges connect to benchmark data dimensions; opt-in spawns a personal benchmark on the user's timeline. (benchmarks-spec.md)
- Events discovery surface — two filtering dimensions: local (geography) + benchmark-aligned. Out of scope for initial cohort build, noted so the event data model doesn't foreclose it. (cohorts-spec.md)
- Friend mechanic — mutual vs. asymmetric follow, UX unspecified. (cohorts-spec.md)
- Profile design — deep dive deferred until the core app is running. (cohorts-spec.md)
- Creator cohorts — directional only; decisions deferred. (cohorts-spec.md)

---

## Cross-cutting / unscheduled

- Onboarding activity picker — "what do you do?" sets the initial headline row in the session logger (Run / Ride / Climb / etc.). Not a goal picker, not prescriptive. Lands whenever onboarding becomes a thing — Phase 1 deliberately ships without it. (training-logging-spec.md "Onboarding connection", phase-1-build-spec.md)
- Body-fat fidelity (quirk #5) — weigh-in Observation carries one `fidelity` field; bioimpedance body-fat % shouldn't ride at 1.0. Clean fix = per-field fidelity OR split body-fat into its own Observation. Architecture call, surfaces when body-fat does (Reflect / Phase 2).
- `expo-sqlite` doesn't run on web (quirk #3) — iOS-sim / Expo Go is the Phase-1 target. Revisit only if a web build is ever wanted.
- Cloud sync — first version is local; cloud comes when there's a second device or someone else needs to see the hub. (data-model.md)
- **Native GPS tracking + map — DIRECTION CHANGE (2026-06-30), decision pending.** Reverses the documented "the app is not building a GPS tracker, it ingests from one" principle (training-logging-spec.md § Outdoor / GPS). Plan is to record activities natively. Not a north-star violation (own-run recording is descriptive + pull-based), but it must be blessed and written into training-logging-spec.md before building, not absorbed silently. Once it lands it becomes the primary route source (Layer 1), demoting wearable import + Garmin to enrichment. Build effort is its own thing: background location, battery, map render. (wearable-ingestion-spec.md Addendum, training-logging-spec.md)
