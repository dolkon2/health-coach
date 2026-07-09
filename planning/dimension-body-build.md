# Body Dimension — Build Spec (v1.1, 2026-07-05)

> Executes the plan in `dimension-body-session.md`. v1.1 incorporates all findings from a
> 3-lens adversarial critique (constitution / codebase-fit / scope+data) of v1.0.
> Research inputs live in the session scratchpad at
> `/private/tmp/claude-502/-Users-dolkoan-Claude-Set-up/8a4d77b1-8ce9-4d4e-b051-5df9c2e04327/scratchpad/body-research/`
> (referenced below as `RESEARCH/`). The architecture briefing (`RESEARCH/architecture/briefing.md`)
> is REQUIRED READING for every build pass — file:line anchors + 13 landmines.
> Every judgment call carries a ⚑; build passes append new ⚑ flags to
> `dev-log/body-build-flags.md` (create on first use), never silently reinterpret.

## Ground rules (all passes)

- Worktree `~/Projects/health-coach-body`, branch `dimension/body` ONLY. Never touch main,
  other worktrees, or other branches. Commit; never push (orchestrator pushes at wrap).
- Constitution: descriptive by default, prescriptive only on request; no gamification;
  fidelity/capture-tiers are FOOD-ONLY — training sessions are facts. Never fabricate
  values (null ≠ 0); never rewrite what the user logged.
- Verify order per pass: write code → write/extend tests → `npx jest` green → `npx tsc --noEmit`
  clean LAST → single-concern commit(s). Trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Migrations: append-only; ONLY P8 adds one (version 10). Payload-JSON additions are
  optional-only and need NO migration (briefing §3).
- UI work is FUNCTIONAL only — match existing idioms; the Gorge redesign owns polish.

## P1a — Gym-side schema + registry (schema + form model, NO new UI)

- `LiftingBlock.sets` (observation.ts:158-170) inline set object gains optional
  `holdSec?: number` and `exerciseId?: string` (Free Exercise DB slug). NOT a discriminated
  union. `exercise` string stays the stored fact; movementPattern STAYS REQUIRED.
- A set is filled if reps>0 OR holdSec>0: `isSetFilled` (session.ts:202-206), `SetDraft`,
  `buildLifting` (265-284), inverse, validation all branch. Round-trip tests.
- Stimulus (stimulus.ts:102 AND :155 together): hold sets count toward per-pattern SET COUNTS
  plus a new honest `holdSecByPattern` aggregate; they contribute ZERO to volumeLoadKg. ⚑
- Registry: add `deprecated?: true` to `Activity`; mark `martial-arts` deprecated (NOT removed —
  activityById still resolves so historic sessions display AND edit-round-trip losslessly;
  removal would drop their practice block via the surface-'other' fallback, session.ts:160-166 +
  387). Filter deprecated from `headlineActivities`/`moreActivities` (activity.ts:100-108).
  Add `breathwork` and `pt` activities (practice surface, modality `mobility` ⚑ — identity-level
  distinctness is what matters; Dance keeps its own modality per 6463cea). Update the
  activity.test.ts partition/reference tests (incl. :68-72 martial-arts references).
- Bodyweight+load: NO new field. `weightKg` on a bodyweight movement = ADDED external load
  (0 = strict bodyweight). ⚑ Assisted variations are distinct ladder steps, not negative weights.
  %BW normalization happens at analysis time via trend bodyweight.

## P1b — Practice-side schema (schema + form model, NO new UI)

- `PracticeBlock` (observation.ts:212-218) gains optional: `styleId?: string` (taxonomy id;
  free-text `style` stays), `contextTag?: 'class'|'social'|'practice'|'rehearsal'|'performance'`,
  `bodyAreas?: Array<{ zoneId: string; side?: 'left'|'right'|'both'; tightness?: 1|2|3|4|5 }>`.
- `SessionPayload` gains optional `breathwork?: { patternId?: string; cycles?: number;
  rounds?: Array<{ retentionSeconds: number; breathsCount?: number }>; capture?: 'stopwatch'|'manual' }`
  (per `RESEARCH/breathwork/retention-capture-model.ts`; `capture` is provenance only — never a
  tier/weight; best/avg retention derived at render, never stored) and optional
  `painAreas?: Array<{ zoneId: string; side?: 'left'|'right'|'both'; pain: number /* 0-10 */ }>`.
- `SubjectivePayload` (observation.ts:278-283) is EXTENDED, not bypassed — NO new members join
  ObservationPayload for pain/ticks: `metric` union gains `'pain' | 'protocolTick'`; the value
  comment widens to admit 0 (pain 0-10, 0 = pain-free reading, distinct from absent); new
  optional fields `zoneId?: string; side?: 'left'|'right'|'both'` (pain) and
  `protocolId?: string; exerciseId?: string` (ticks, `value: 1` = tick by convention).
  Standalone flare-up = a subjective observation with metric 'pain'.
- Protocols (PT): settings-KV blob (M009 table) `{ protocols: Array<{ id: string /* uuid */,
  name, archivedAt?: string, exercises: Array<{ id: string, name, targetPerWeek: number }> }> }`
  — ids are stable; names denormalized for display; archived never deleted (pt-model.md).
  Ticks store protocolId+exerciseId; ONE tick per exercise per civil day, re-tap untoggles
  (deletes the tick observation). Types + settings accessors this pass; UI in P7b.
  FDA wellness naming rules from pt-model.md are BINDING (no rehab*/rx*/compliance names).
- New ObservationKind `'romReading'`, payload `{ testId: string; side?: 'left'|'right';
  value: number; unit: string }` — mirrors weighIn end-to-end (storage/serialize/read path). ⚑
- `validateSessionForm` (session.ts:231-234): a session whose payload carries breathwork.rounds
  (≥1 round) is VALID with durationMin null — rounds-present is the filled criterion for
  breathwork, mirroring gym's derived-duration exemption (never force a fabricated duration).
  Round-trip test for a duration-less manual breathwork session.
- SessionForm threading for ALL P1b fields: emptySessionForm defaults, buildSessionObservation
  conditional spreads (practice branch keyed on activity id for breathwork fields),
  sessionFormFromObservation inverses (edit path restores rounds), validation. Breathwork logs
  through SessionForm on the practice surface (NOT a standalone bypass screen) so the edit path
  stays unified. Round-trip tests per field.

## P2 — Seed data (vendor into `src/data/` with typed loaders + integrity tests)

- **Free Exercise DB** (verified Unlicense, pin commit 5197c055): vendor
  `RESEARCH/free-exercise-db/exercises.trimmed.json` with vendor-time additions:
  (a) patch the 14 null-equipment strength/plyo records to `body only`;
  (b) `movementPattern` on every entry via a committed, auditable derivation table
      (mechanic+force+primaryMuscles); hand-review the ~100 most common lifts;
      add `patternReviewed: boolean` — reviewed entries auto-fill silently, UNreviewed entries
      PREFILL but stay visibly editable in the picker flow; rows with mechanic AND force both
      null derive to 'other', never a guess. ⚑ records the reviewed/unreviewed split;
  (c) `pickerScope: 'gym'|'calisthenics'|'both'|'hidden'` — stretching + the 13 SMR entries +
      category=='cardio' (14 rows, not set-loggable) → hidden ⚑; 'other'-equipment strength rows
      stay 'gym' DELIBERATELY; integrity test asserts every entry has an intentional scope;
  (d) `entryType?: 'reps'|'duration'` seeded from force==='static' + the hand-review pass
      (drives the duration-set auto-toggle in P3).
- **Calisthenics ladders**: vendor `RESEARCH/calisthenics/ladders.json` (13 chains, 71 steps,
  `loadable` KEPT ⚑) + ladders-notes.md as companion doc. Integrity tests: unique ids,
  referential coherence, monotone factors except documented loadable-continuity steps.
- **Yoga poses** (MIT, attribution in meta): vendor `RESEARCH/yoga/poses.json` WITH local
  patches (Bridge → Backbend/Chest Opening + Beginner; Sivasana→Savasana, Svsnssana→Svanasana),
  commented as corrections to upstream. Commit the 48 SVGs under `assets/yoga-poses/` (~340 KB)
  for durability ⚑ (author's personal cloudinary — snapshot or lose it). PNGs stay unvendored.
  ⚑ The pose reference FEATURE (browse surface, difficulty/category display) is deferred to the
  redesign — this round vendors data only.
- **Breathwork patterns**: vendor `RESEARCH/breathwork/patterns.json` (8 patterns; WHM retention
  phase `untimed` + `capture:'retention'`; cautions are non-negotiable copy).
- **Taxonomies**: vendor yoga-styles.json, dance-taxonomy.json (incl. barre `hkOverride`),
  mobility-zones.json (10 zones), rom-tests.json (8 tests; the `validated` flag must survive to
  the display layer ⚑). Free-text style escape hatch stays available everywhere.

## P3 — Exercise picker + ghosting + ladder engine

- Library module over the vendored seed: normalized search (lowercase, strip punctuation,
  collapse whitespace), pickerScope filters (gym vs calisthenics get their OWN datasets),
  ranked prefix>substring. (Strong/Hevy ALIAS TABLE IS NOT HERE — it lives in P5 with its
  consumers and fixtures.)
- Ghost resolver: extend `useExercisePatternMemory`'s reload walk (briefing §6,
  useExercisePatternMemory.ts:41-48) to `{ pattern, lastSets }` keyed on normalized exercise
  name (+exerciseId when present); add `lastSets()` beside `suggest()`. Ghost = last session's
  sets rendered as placeholders in GymExerciseEditor (Strong-style). Library pick fills
  exercise+exerciseId and auto-fills movementPattern (silent when patternReviewed, prefilled-
  editable otherwise).
- Duration-set entry UI: hold-seconds field via per-exercise toggle; auto-on when the ladder
  step or library `entryType` is 'duration'; manual toggle otherwise.
- Ladder engine (pure core fn + hook): per-chain leverage-weighted trend; within-metric
  lf×reps / lf×seconds; cross-metric chains use ladder-position (stepIndex + min(1,
  achieved/threshold)); LOADABLE steps interpolate position on effectiveLeverage
  = lf × (trendBW + weightKg)/trendBW between the step's factor and the next step's factor
  (continuous at +0 kg, keeps rising with load — per ladders-notes.md, NOT raw stepIndex);
  L-sit 'achieved' may use accumulated seconds per the notes. Tests over the weighted-dip and
  L-sit chains specifically. Current-step resolver + minimal chain view on Training tap-in ⚑.
- Template upgrade: optional `exerciseId` beside `name` (sessionTemplate.ts's own noted plan).

## P4 — Gym analytics

- e1RM: Epley over WORKING sets only (exclude isWarmup); sets with reps > 12 are EXCLUDED from
  the e1RM series (high-rep Epley is noise) — NEVER clamp reps into the formula; test asserts a
  15-rep set produces no e1RM point. Per-exercise best-of-session series. Brzycki not in v1 ⚑.
- PR detection: descriptive flags computed against history at render/save (nothing derived is
  stored ⚑) — new best e1RM / best reps-at-weight / best single-set volume per exercise.
  Flag-once styling, NO celebration animation.
- Weekly tonnage by muscle group: weight×reps × involvement (primary 1.0, secondary 0.5 ⚑) via
  vendored muscle tags; display groups over the 17-muscle vocab: chest / back (lats+middle+traps) /
  lower back / shoulders / biceps / triceps / forearms / core (abdominals) / quads / hamstrings /
  glutes / adductors+abductors / calves / neck ⚑. Hold sets contribute NO tonnage.
- Surfaces: lift detail (e1RM trend + PRs + recent sessions) from Training tab; weekly tonnage
  view on Training tap-in. Functional only.

## P5 — Strong/Hevy CSV import

- Generic `csv.ts`: delimiter sniff (`,` vs `;` from header), RFC-4180 quotes, utf-8-sig BOM.
- `aliases.ts` module lives HERE (built + tested against the fixtures): rewrite rule
  'Bench Press (Barbell)' → 'barbell bench press' + ~50 hand aliases for top lifts.
- Strong mapper (variants A+B via header-alias table, never positional): localized non-English
  headers → clear "re-export in English" error v1 ⚑; units: variant B trusts per-row unit
  columns, variant A → one confirm (kg/lb) prefilled by heuristic (≥250 ⇒ lb; plate-increment
  spacing), never silent ⚑; Set Order 'W' → isWarmup; 'D'/'F' (and Hevy failure/dropset) import
  as working sets WITH the marker appended to the set/session note (format-spec.md:114) so the
  logged fact survives ⚑; RPE → rir = 10−RPE, derivation noted in the import report ⚑;
  planks/timed rows → holdSec sets; cardio-in-workout rows skipped WITH per-category report
  line ⚑; 'Rest Timer' + all-zero rows skipped; session = group by (Date, Workout Name),
  Duration string → durationMin, NO per-set completedAt fabrication.
- Dedupe (idempotent re-import) adds NO table: the row hash (date, workout, exercise, set order,
  weight, reps) is stored inside the observation's source/payload JSON at import and re-derived
  from existing 'strong-csv'/'hevy-csv' observations on the next import.
- Exercise resolution: normalized match → aliases → Jaccard ≥0.90 auto / 0.75–0.90 confirm list /
  below → import as custom, pattern 'other', post-import "assign patterns" review sorted by set
  count (never block an import) ⚑.
- Hevy mapper: units from column names, explicit set_type, 0-based set_index; superset_id
  dropped v1 ⚑. Provenance: fileimport format union += 'strong-csv' | 'hevy-csv'.
- Entry point follows the GPX import pattern (src/lib/gpxImport.ts + screen wiring).
- FIXTURES: commit EXACTLY these three synthetic files from RESEARCH/strong-csv/ —
  `samples.csv`, `samples-variant-b-android.csv`, `hevy-sample.csv`. **`refs/` (a real user's
  1,904-row export + third-party parser sources) is research-only and MUST NEVER be committed**
  (public repo; personal data). Large-file coverage → generate synthetic rows in the test.

## P6 — Benchmark dimensions (nutrition seam, briefing §4)

- `{ metric: 'exerciseLoad'; exerciseId?: string; exercise: string }` — the e1RM threshold is
  the OUTCOME face's `direction: 'up'` + `target` (benchmark.ts:115-119), NOT on the dimension.
- `{ metric: 'breathRetention'; statistic: 'best'|'average' }` — suggestion default 'average' ⚑.
- `{ metric: 'romMeasurement'; testId: string; side?: 'left'|'right' }` over romReading
  observations (weigh-in analog).
- `{ metric: 'protocolAdherence'; protocolId: string }` (behavior face; rolling-7d, capped
  per-exercise ratios, unweighted mean, derived never stored).
- useBenchmarkStatuses extensions (enumerate, don't discover mid-pass): outcome-driven session
  fetch with an explicit LONG window for exerciseLoad/breathRetention history (week-start window
  is insufficient, useBenchmarkStatuses.ts:40-45); a kinds:['romReading'] query; a subjective/
  protocolTick query; the isNutritionFace routing predicate (:54-56) learns the new shapes.
- Ladder advancement: OPT-IN benchmark template suggested from the user's current chain step
  threshold; shown in suggest flow only, never auto-created ⚑.
- Behavior faces reuse `{ metric: 'sessionCount', activity }` where possible (zero new machinery).

## P7a — Practice surfaces: yoga / dance / mobility capture UI

- Practice form: styleId picker from taxonomy (yoga/dance) with free-text escape; dance context
  tag chips; mobility body-area multi-select + optional per-area tightness 1–5; reflection note =
  the EXISTING notes field surfaced prominently with a "reflection" prompt on practice surfaces ⚑
  (zero schema). UI-only — P1b already threaded the form model.

## P7b — Breathwork logger + PT surfaces + ROM entry

- Breathwork: pattern picker (bundled library), rounds capture — WHM tap-to-stop stopwatch
  (retentionSeconds, 1s precision) + manual m:ss entry; per-session best/avg display.
  No pacer animation v1 ⚑ (fast-follow per session doc).
- PT: pain areas on any session (chips on the session form); standalone flare-up entry
  (subjective/pain); protocol screen — define in settings UI, daily tick list (re-tap untoggles),
  rolling-7d adherence %, descriptive copy, FDA naming rules binding.
- ROM check-in entry (romReading) from the benchmark/Reflect surface, weigh-in idiom.
- ⚑ Pain-vs-load correlation/Reflect overlay (session doc :114, pt-model.md §4) DEFERRED this
  round per the 3rd-check-in PT narrowing — needs history data + Reflect design; Dylan can veto.

## P8 — HealthKit writes (design doc `RESEARCH/healthkit-write-layer.md` is BINDING)

- `src/lib/healthkit/hkMapping.ts` (pure, numeric enums duplicated — jest-safe) + `writer.ts`
  (dynamic import, non-iOS skip-before-bridge). saveWorkoutSample with `quantities: []`, NO
  totals (modeled energy never enters HK ⚑). Mapping: gym 50 / calisthenics 20 / yoga 57 /
  mobility 62 / dance 78-social-else-77 (barre hkOverride → barre) / pt 33; breathwork =
  mindfulSession category sample value 0, NOT a workout. Yin/restorative mindfulSession
  companion NOT in v1 ⚑.
- Idempotency (per the binding doc — the v1.0 supersedes-chain-depth idea is DEAD: the app
  hard-overwrites, never supersedes, so chain depth is always 0 and HK replace would silently
  no-op): HKSyncIdentifier `healthcoach.obs.<id>` + syncVersion stored in the `hk_exports`
  table (observationId, hkUuid, syncVersion, status, lastAttemptAt), bumped on every re-export.
  ⚑ Seeding choice: epoch-seconds of the write instead of a restart-at-1 counter, so a
  reinstalled app still wins over pre-reinstall samples. Plus HCObservationId metadata +
  HKWasUserEntered + HKTimeZone.
- Lifecycle: write on create, replace on edit (same sync id, bumped version), deleteObjects on
  delete ⚑. `hk_exports` = migration 10 (the ONLY migration this build).
- Opt-in: single global settings toggle ⚑; auth sheet only from the toggle; fire-and-forget
  void-catch after createObservation; skip (never fabricate) when no derivable duration ⚑.
- app.json: honest NSHealthUpdateUsageDescription + FIX the share string (currently claims data
  is "never written back") ⚑ — effective at next prebuild; dev-log notes a fresh dev build is
  needed for the copy (plugin already injects the write entitlement — verify live on sim).
- Echo-suppression rule documented for future activity READS (drop own-bundle samples).

## Deferred this round (⚑ each — recorded so the drops are blessed, not silent)

1. Dance moves checklist (learned→mastered) — gamification-adjacent; needs Dylan's call.
2. Hours-per-style rollups — needs a styleId filter on sessionCount; cheap follow-up.
3. Mobility coverage heatmap — Gorge redesign surface.
4. Yoga gentle-consistency view — Gorge redesign surface.
5. Tonnage benchmark dimension — Goodhart-prone as a target; the VIEW ships in P4.
6. Breathwork HRV/respiratory-rate READS — read-layer round; HRV inflation caveat documented
   (RESEARCH/breathwork/hrv-note.md) and must ship with any future read work.
7. Hevy Pro API ingest — Pro-gated; CSV covers switchers now.
8. Yoga pose-reference browse surface — data vendored in P2; UI to redesign.
9. Pain-vs-load correlation view — see P7b ⚑.

## Pass → workflow mapping

| Group | Passes | Gate |
|---|---|---|
| Build-A (foundation) | P1a → P1b → P2 → P3 | jest+tsc green; orchestrator reviews commits |
| Build-B (engines) | P4 → P5 → P6 | same |
| Build-C (surfaces) | P7a → P7b → P8 | same |
| Review | multi-lens adversarial fan-out → verify → fix | all real findings fixed |
| Wrap | full verify, sim smoke (best-effort), dev-log, flags, push | origin/dimension-body pushed |

Each pass: one agent, sole owner of the tree while it runs; reads this spec + briefing + its
RESEARCH files; appends ⚑ to `dev-log/body-build-flags.md`; commits single-concern with tests
green and tsc clean; reports commit SHAs + deviations.
