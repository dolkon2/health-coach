# Phase 4 — Training Tab: pass-by-pass build plan

*Status: planned, decisions locked 2026-06-27. No code yet. Supersedes the
`game-plan-and-prompts.md` legend's 3-pass Phase-4 placeholder — this is the
output of the HALT / logging deep-dive gate.*

## Context

Phase 1 shipped a *minimal* logger: a single `app/log-session.tsx` modal launched
from Today, switching on `modality` (gym / run / ride / climb / paddle / hike /
other), with freeform exercise names + a pattern-memory helper, a basic climb
form, and a **manually-entered required duration**. `training-logging-spec.md`
describes the real target: a three-layer model (identity → surface → engine), an
activity picker, five logging surfaces, an exercise library searched by muscle
group, session templates, and identity tags — all housed in a dedicated
**Training tab** that doesn't exist yet (only Today + Reflect do).

## Scope (locked)

The roadmap budgeted 3 passes; the full spec is 8. We ship the **core cut** now and
fast-follow the enrichment layer:

- **Core cut — build now: Passes 1, 2, 3, 5, 6.** Training tab (history + log entry
  point) + the four spec-complete surfaces shipped clean (gym with real timing, GPS,
  swim, practice).
- **Fast-follow — deferred: Passes 4, 7, 8.** Exercise library, session templates,
  identity tags. They deepen quality but don't block the surfaces. Pass numbers are
  kept as-is (4/7/8) so the breakdown stays stable.

So gym sessions still feed the stimulus ledger during the core cut, a **minimal
static exercise seed** (not the full library) ships inside Pass 3 — see that pass.

### Global guardrails (every pass honors)
- Feeds the **existing** stimulus ledger (`core/src/stimulus.ts`) — `reveal()` and
  `computeWeeklyStimulus()`. No new engine outputs unless a surface genuinely adds one.
- **Descriptive only.** No gamification, no streaks, no nudges, no pushed/"recommended
  for you" content. The rest timer is a user-started utility, not a notification nudge.
- **Honest fidelity/tier.** Manual = lower fidelity than synced; never fabricate a
  number a surface can't truthfully report (matches the climb/hike sessionIds-only
  treatment already in the ledger). Fidelity falls out of the *structure* of what was
  captured, never from a self-report dial.
- **Climbing is NOT in scope.** The existing minimal climb form rides the new surface
  router unchanged; the richer climbing surface stays a backlog research item (Kaya /
  Crux / Toplogger / Mountain Project, indoor-vs-outdoor, MP import — in `backlog.md`).
- **Training tab is not a planning surface yet.** Program structure / scheduling /
  planned-workouts→Today is **Phase 6** and needs its own spec session (see `backlog.md`).

### Technical seam that keeps passes light
SQLite stores `payload` as a JSON column, so **new `SessionPayload` fields need no SQL
migration** — only new top-level entities do. The whole core cut (1, 2, 3, 5, 6) is
type + UI changes; the deferred passes (4 library, 7 templates) are the only ones that
add tables/migrations.

---

## Pass 1 — Activity registry + surface routing + Training tab shell  · CORE

**Concern:** Stand up the three-layer model's identity↔surface map and the Training
tab as the new logging home + session history. No form internals change yet; the
picker can route to the existing modal by mapping activity→modality for now.

- **Scope:** An `Activity` registry (id, label, icon, `surface`, nearest engine
  `modality`, default energySystem/identityTags) where many identities point at few
  surfaces. The Training tab renders the user's **activity list** (a persisted, ordered
  id list in settings — seeded with sensible defaults; the deferred onboarding "what do
  you do?" flow will populate it later) + a **"More"** long tail, and a **session
  history** list below (reuse `SessionCard` + `stimulus.reveal()`).
- **Files:** `src/lib/activity.ts` (new registry), `app/(tabs)/training.tsx` (new),
  `app/(tabs)/_layout.tsx` (add 3rd tab + lucide icon), `src/hooks/useSessionHistory.ts`
  (new; windowed query via `src/storage/observations.ts`). Reuse `SessionCard`,
  `ChipSelect`, `Screen`.
- **Decided:** Today keeps a one-tap **quick-log shortcut** for unplanned sessions. The
  Training tab is **session history + the log entry point**, NOT a planning surface yet.
- **Commit:** `feat(training): activity→surface registry + Training tab shell with history`

## Pass 2 — Surface-driven logger refactor (+ activity identity, honest GPS fidelity)  · CORE

**Concern:** Convert the logger from a `modality` switch to a **`surface`** switch with
the chosen **activity** carried as an identity label. Behavior-preserving for the three
existing surfaces; swim/practice render a "coming next" stub until their passes land.

- **Scope:** `SessionForm` gains `activity` + a surface selector resolved from the
  registry. Add `activity?: string` to `SessionPayload` (JSON — no migration);
  `reveal()` prefers `activity` over coarse `modality` for display. Rename the
  "endurance" surface to **GPS**, keep it thin, and drop manual-GPS fidelity to an honest
  ~0.5 (vs gym's 0.95) since there's no wearable yet (wearable import = Phase 3, deferred).
- **Files:** `src/lib/session.ts` (form shape, build/round-trip, fidelity), `app/log-session.tsx`
  (surface switch), `core/src/observation.ts` (+`activity?`), `core/src/stimulus.ts`
  (`reveal()` label), `src/lib/__tests__/session.test.ts` (round-trip).
- **Decided:** The picker shows the user's **own activity list** (from the settings list
  Pass 1 persists; onboarding seeds it later). Each activity **identity** maps to a
  logging surface **under the hood** — the user never picks a "surface." Identity is a
  separate concept from engine `modality`: "Calisthenics" and "strength training" are
  both identities that route to the **gym** surface. The router is invisible plumbing.
- **Commit:** `refactor(training): surface-driven logger + activity identity + honest GPS fidelity`

## Pass 3 — Gym live session: timestamped sets → derived duration + rest timer  · CORE  ⚑

**Concern:** Replace the manually-declared required duration with **structure-derived**
duration and add the **auto-starting rest timer**. Resolves quirk #8.

- **Decided (the model):** **Live-timestamped sets.** Each set carries a completion
  timestamp; session `durationMin` is **derived from the spread between the first and
  last set** — never entered. The rest timer **auto-starts on set completion**, fires a
  local notification when the configured rest elapses, and records actual rest on the set.
  A **batch-entered** session (timestamps clustered together) yields **low / null duration
  fidelity, detected from the spread** — not asked for. **No manual duration fallback, no
  stopwatch.** This is the fidelity field falling out of the structure again.
- **Exercise seed (folded in here):** Ship a **minimal static seed** — top ~80–100 common
  exercises pre-tagged with muscle groups + movement patterns — as a JSON file backing the
  gym exercise-name autocomplete and auto-suggesting the movement pattern on first use. This
  is **not** the full library (that's the deferred Pass 4); it exists so the stimulus ledger
  isn't blind to gym sessions during the core cut. Shape it forward-compatible with Pass 4's
  library schema so the later table can absorb it.
- **Files:** `core/src/observation.ts` (set `completedAt`; session `startedAt`/`endedAt`;
  derive duration + fidelity-from-spread), `src/lib/session.ts` (timing logic, gym drops the
  manual duration field), `app/log-session.tsx` (set-complete affordance + timer UI),
  `src/hooks/useRestTimer.ts` (new), expo-notifications wiring, `src/components/RestTimer.tsx`
  (new), `src/lib/exerciseSeed.ts` or `assets/exercises.json` (new seed), gym editor wiring,
  reuse `useExercisePatternMemory` as the fallback for off-seed names.
- **Commit:** `feat(training): live gym session — timestamped sets, derived duration, rest timer`

## Pass 4 — Exercise library + muscle-group search  · FAST-FOLLOW (deferred)

**Concern:** The full searchable, pre-populated exercise DB; search by **muscle group**;
engine maps muscle group(s) → **movement pattern**; custom exercises first-class. Expands
Pass 3's minimal seed into a real library.

- **Scope:** New `exercise_library` table + seed import; muscle-group→movement-pattern
  bridge; exercise picker (search by name or muscle group) in the gym editor; custom-
  exercise create flow. Library entries carry identity tags (feeds Pass 8).
- **Files:** `src/storage/migrations/00X_exercise_library.sql`, `src/storage/exercises.ts`,
  `core/src/exerciseMap.ts`, `src/components/ExercisePicker.tsx`, expand `exerciseSeed`.
- **Decision (open, before this pass):** Data source — curated static seed vs wger/ExerciseDB
  API. Deferred to backlog.
- **Commit:** `feat(training): exercise library with muscle-group search + custom exercises`

## Pass 5 — Swimming surface  · CORE

**Concern:** The pool sub-surface + open-water routing to GPS.

- **Scope:** Pool: stroke, intervals/sets, duration, effort. Open-water reuses the GPS
  surface. Add energy-system minutes so swim shows in the stimulus ledger (not sessionIds-only).
- **Decided:** Pool distance is **laps × pool length**, displayed as a **total** — higher
  fidelity than a raw total-distance estimate. Needs a remembered default pool-length setting.
- **Files:** `core/src/observation.ts` (`SwimmingBlock` + `reveal()` case), `core/src/stimulus.ts`
  (energy-system minutes; pool reveal), `src/lib/session.ts` (swim form + build/round-trip),
  `app/log-session.tsx` (swim body), `core/src/__tests__` + `src/lib/__tests__`.
- **Commit:** `feat(training): swimming surface (pool + open-water)`

## Pass 6 — Practice surface  · CORE

**Concern:** Yoga / Pilates / mobility / meditation / breathwork — duration, perceived effort,
style tag, note. No per-pose logging (hostile UX, no correlation value).

- **Scope:** Session-level only: maps to `modality: 'mobility'`; carries a style tag. Engine
  treats it like climb/hike today — appears in `sessionIds`, contributes no fabricated
  pattern/energy volume (honest).
- **Files:** `core/src/observation.ts` (small `practice?: { style }` block + `reveal()` case),
  `core/src/stimulus.ts` (reveal), `src/lib/session.ts`, `app/log-session.tsx`, tests.
- **Decision:** None required (small).
- **Commit:** `feat(training): practice surface (yoga / pilates / mobility)`

## Pass 7 — Session templates (plan → session)  · FAST-FOLLOW (deferred)

**Concern:** A SessionTemplate is a plan without a timestamp; browse → launch → becomes a real
Session prefilled from the plan; the logged session carries `templateId` for planned-vs-actual.
Strictly pull-based. (Distinct from Phase 6 scheduling — this is a saved workout, not a calendar.)

- **Files:** `src/storage/migrations/00X_templates.sql`, `src/storage/templates.ts`,
  `core/src/template.ts`, `app/template-edit.tsx`, `app/(tabs)/training.tsx`, `src/lib/session.ts`.
- **Decision (open):** Template scope for v1 — gym-only (recommended) vs all surfaces.
- **Commit:** `feat(training): session templates — plan without a timestamp, launch into a session`

## Pass 8 — Identity tags + history filtering  · FAST-FOLLOW (deferred)

**Concern:** Identity tags on sessions (inherited from library exercises / activity + user-set),
and a Training-tab history filter ("show all calisthenics sessions"). Descriptive only.

- **Files:** `core/src/observation.ts` (+`identityTags?`), `src/lib/session.ts`,
  `app/(tabs)/training.tsx` (filter), `src/components/SessionCard.tsx` (display).
- **Decision (open):** Tag vocabulary — free-form vs seeded+extensible (recommended).
- **Commit:** `feat(training): identity tags + history filtering`

---

## Stays in backlog (not built here)
- **Climbing surface redesign** + Kaya/Crux/Toplogger/Mountain Project research + MP import.
- **Wearable import** (Garmin / HealthKit / Health Connect) — Phase 3; GPS surface stays
  manual-fallback until then.
- **Onboarding activity picker** ("what do you do?" seeds the Pass-1 activity list) — lands
  when onboarding does.
- **Exercise library data source** (wger/ExerciseDB vs curated seed) — before Pass 4 fast-follow.
- **Phase 6 planning system** — its own spec session before any build.

## Verification (per pass)
- `core/` engine changes: unit tests under `core/src/__tests__` (reveal/stimulus) and the
  `src/lib/__tests__/session.test.ts` form→build→from→build round-trip.
- UI: run the Expo app, log one session per new surface, confirm it lands on Today **and** the
  Training history, and that `reveal()`'s contribution line + the Reflect ledger update.
- Run `tsc` **last**, after test files are written.
- Commit per pass; `git reset --hard` + re-prompt if a pass goes sideways.
