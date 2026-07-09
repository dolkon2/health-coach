# Handoff — Body dimension build (continue from Build-B/Build-C)

*Bootstrap for continuing the Body-dimension build on `~/Projects/health-coach-body`,
branch `dimension/body`. Authored 2026-07-05 mid-build, from an overnight session with
Dylan (Fable, ultracode). Source of truth for the full pass-by-pass plan is
`planning/dimension-body-build.md` v1.1 (already critique-hardened by a 3-lens
adversarial review — read it before touching anything, it supersedes the summary below
if they ever disagree). Orientation context: `planning/dimension-body-session.md`.*

## Where this came from

Body is one of four dimensions (Earth/Sky/Water/Body) being built in parallel, each in
its own worktree/branch, per `planning/four-dimensions-framework.md`. Body =
"anything where the point is the instrument, not the terrain" — Gym, Calisthenics,
Yoga, Mobility, Dance, Breathwork, PT. Research (8 parallel agents), a build spec, and
an adversarial 3-lens critique (constitution / codebase-fit / scope+data) all preceded
the build — see `planning/dimension-body-build.md`'s changelog for what the critique
caught (a HealthKit sync-version contradiction, an invalid ObservationPayload shape,
martial-arts-removal data loss, a fabrication-pressure bug in breathwork validation,
and more — all fixed in v1.1 before any P4+ code was written).

## What's landed so far (as of this doc, `dimension/body` @ `09aab50` + P3 in flight)

**P1a — Gym schema** (`39e6b27`, `42fdfe8`): `LiftingBlock.sets` gained optional
`holdSec`/`exerciseId`; stimulus aggregates hold sets into per-pattern counts +
`holdSecByPattern`, zero fabricated volume; `martial-arts` deprecated (not removed —
historic sessions still resolve/edit losslessly); `breathwork` + `pt` added to the
activity registry.

**P1b — Practice schema** (`a3ae456`, `8427c1e`, `c246355`): `PracticeBlock` gained
`styleId`/`contextTag`/`bodyAreas`; `SessionPayload` gained a `breathwork` block and
`painAreas`; `SubjectivePayload.metric` extended with `'pain'`/`'protocolTick'` (NOT
new ObservationKinds — the critique caught this distinction); new `romReading`
ObservationKind mirroring `weighIn`; user protocols in the M009 settings tenant with
uuid-keyed exercises and a daily tick toggle; breathwork sessions can save with
`durationMin: null` when rounds are logged (no fabricated duration).

**P2 — Seed data** (`8d196ad`, `8e699f8`, `f559e36`, `279a9af`, `83a1d0d`): Free
Exercise DB vendored (873 exercises, Unlicense, pinned commit `5197c055`) with
movement-pattern derivation (135 hand-reviewed + 738 prefilled-editable),
`pickerScope`, `entryType`; 13-chain/71-step calisthenics skill-ladder dataset
(hand-built — no API exists for this, see `ladders-notes.md` for every leverage-factor's
estimation basis and sources); 48 yoga poses (MIT, 3 upstream data corrections applied
in loader code) + SVGs snapshotted to `assets/yoga-poses/`; 8-pattern breathwork
library incl. WHM retention; yoga/dance/mobility/ROM-test taxonomies.

**All 17 commits jest-green + tsc-clean at time of commit.** 32 ⚑ judgment calls
recorded in `dev-log/body-build-flags.md` — read it, nothing there is a silent
reinterpretation of the spec.

**P3 is PARTIALLY done — session ended here, closed out cleanly (2026-07-05 evening).**
Item 1 of 5 (the exercise picker query layer: `src/lib/exercisePicker.ts` — normalized
search, gym/calisthenics picker datasets, hand-assigned ladder-step patterns) landed in
`7fa11f0`, complete/tested/green. **The build agent running P3 stopped on its own after
that — no error, no completion notification, it just stopped appearing in the
background-task registry.** Root cause unknown; flagged in `dev-log/body-build-flags.md`
as something to watch for on future overnight passes. Items 2-5 of P3 were never
started.

## What's next — follow `planning/dimension-body-build.md` in order

- **Finish P3**: prev-set ghost resolver (extends `useExercisePatternMemory`), the
  picker UI wired into the gym logger (autocomplete over `exercisePicker.ts`'s
  datasets, already built), duration-set entry UI (hold-seconds toggle), ladder trend
  engine (leverage math — watch the loadable-step and L-sit seams called out in
  `ladders-notes.md`), template `exerciseId` upgrade.
- **Build-B** (the gym-priority chunk Dylan asked to prioritize): **P4** gym analytics
  (e1RM/PR detection/weekly tonnage) → **P5** Strong/Hevy CSV import (format spec +
  fixtures already researched, `RESEARCH/strong-csv/` in the original session's
  scratchpad — re-derive or re-research if that scratchpad is gone) → **P6** benchmark
  dimensions (exerciseLoad/breathRetention/romMeasurement/protocolAdherence, all
  through the existing nutrition seam in `core/src/benchmark.ts`).
- **Build-C**: **P7a** practice capture UI (yoga/dance/mobility) → **P7b** breathwork
  logger + PT screens + ROM entry → **P8** HealthKit writes (design doc was binding;
  if the original scratchpad research doc `healthkit-write-layer.md` is gone, the key
  facts are: `@kingstinct/react-native-healthkit` v14, `saveWorkoutSample` with
  `quantities: []` and no totals, sync via a NEW `hk_exports` table not supersede-chain
  depth — the app hard-overwrites, never supersedes).
- **Review**: multi-lens adversarial critique of the finished build (mirror the
  spec-critique pattern — constitution/codebase-fit/scope lenses), fix real findings.
- **Wrap**: full verify, dev-log summary, push `dimension/body` to origin. **Never
  merge to main or push without Dylan's explicit go-ahead** — that decision is his.

## Cross-cutting risk to flag at merge time (not a build blocker)

Sky's branch claimed migrations 010/011/012 (gear, spot, conditions — see
`~/Projects/health-coach-sky/dev-log/dimension-sky-pass-1.md`); Water already hit a
collision with Sky on migration 010 (see Water's own last commit message — "confirmed
M010 collision with Sky branch, merge must renumber + unify"). Body's P8 (HealthKit
`hk_exports` table) is spec'd as migration 10 in ITS OWN branch context — this WILL
also need renumbering when all four dimension branches converge on main. This is
expected/normal per Water's precedent, not something to solve unilaterally inside the
Body worktree — just don't be surprised by it at merge time.

## Guardrails (hard, unchanged from the build spec)

- Worktree `~/Projects/health-coach-body`, branch `dimension/body` ONLY — never touch
  main or the other three dimension worktrees/branches.
- Constitution: descriptive by default, prescriptive only on request; no gamification;
  fidelity/capture-tiers are FOOD-ONLY (training sessions are facts); null ≠ 0, never
  fabricate; never rewrite what the user logged.
- Verify order: jest full-suite green → `tsc --noEmit` clean LAST → commit.
  Single-concern commits, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  (or the model actually doing the work).
- Judgment calls get a ⚑ line in `dev-log/body-build-flags.md`, never a silent
  reinterpretation of the spec.
- Repo is PUBLIC (`github.com/dolkon2/health-coach`) — never commit secrets or any real
  person's data (the CSV-import fixtures rule in the spec's P5 section is explicit
  about this: only 3 named synthetic files, never the real-user reference export).

## Self-check before calling the Body build "done"

1. Every pass in `planning/dimension-body-build.md` (P1a through P8) is either
   committed or explicitly deferred with a reason in the spec's own deferred-items
   ledger.
2. `dev-log/body-build-flags.md` has an entry for every judgment call — spot-check a
   few against the actual code to confirm they weren't silently widened in a later pass.
3. Full jest suite green, `tsc --noEmit` clean, on the tip of `dimension/body`.
4. Nothing on the food/nutrition side was touched; nothing in another dimension's
   worktree was touched.
5. HealthKit writes are opt-in, fire-and-forget, and never carry modeled (tier-3)
   energy into Apple Health.
6. Pushed to `origin/dimension-body` — but NOT merged to main without Dylan's sign-off.
