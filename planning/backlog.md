# Backlog

*Deferred items, open constraints, and known quirks — scattered across the planning docs and dev-log, collected here so nothing slips. One item per line, grouped by where it lands. Not a roadmap — the build sequence still lives in `game-plan-and-prompts.md` and the phase specs.*

---

## Phase 2 / Ring 2 (nutrition)

- Supersede pattern for editing sessions — deferred from Pass 6 logging deep-dive, lands here. `supersede` already exists for weigh-ins (`storage/observations.ts`); sessions need the same affordance. (game-plan-and-prompts.md HALT)
- Delete-a-session affordance on Today's session cards. (game-plan-and-prompts.md HALT)
- Earned-fidelity mechanic for food logging — direction unspecified, but the fidelity-as-first-class principle wants something more than a static field. (constitution principle 3, product-overview.md)
- Composite meals — should `FoodEntryPayload` support `items: FoodEntryPayload[]` for ingredient-built meals? Phase 1 keeps it flat. (data-model.md open question)
- iCloud / encrypted SQLite backup — losing 6 months of data to a phone wipe would suck. (phase-1-build-spec.md open question)
- Progress photo storage — `kind: 'progressPhoto'` Observation with file path in payload? Settings feature, not Phase 1. (data-model.md open question)

---

## Phase 3 (HealthKit / Health Connect / Garmin ingestion)

- Garmin Connect partner program research — open constraint. Partner access shape determines what's possible client-side.
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

- Benchmarks input UX — two-step domain → specific-thing is directionally right but needs design exploration / prototyping. (benchmarks-spec.md open question)
- Active benchmark cap — "not infinite" is decided; the exact number is a design-feel call. (benchmarks-spec.md open question)
- Milestone data model lightness — do they carry their own target values or are they just named markers on the benchmark's data dimension? (benchmarks-spec.md open question)
- Benchmark creation timing — dedicated flow only, or contextual spawn from e.g. the Training tab? (benchmarks-spec.md open question)
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

- AI parser replaces keyword mapper for benchmark input — natural language ("climb 5.12") instead of menu navigation. Same underlying data model. (benchmarks-spec.md)

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
