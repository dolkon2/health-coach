# Handoff — Phase 6 Plan Tab: build session kickoff

*Written 2026-06-28. Planning session is done; the build plan is blessed by Dylan.
Next session starts Pass 1. Self-contained: read this top to bottom and pick up
cold.*

---

## TL;DR

Phase 6 turns the Training tab into a planning surface (week view + library of
saved training shapes). The vision is locked in
`planning/phase-6-plan-tab-spec.md`. The pass-by-pass build plan is locked in
`planning/phase-6-plan-tab-build.md` — Dylan approved it in the planning session.

**MVP = Passes 1–3.** Start with Pass 1.

---

## ⚠️ Environment — read before touching anything

- **Worktree:** `/Users/dolkoan/Projects/health-coach-training` · **branch:**
  `phase-4-training` · should be clean · ahead of local `main` (Phase 4 + Phase 6
  spec/plan).
- **Three worktrees share one repo** (parallel-session hazard is real — it has
  corrupted node_modules before):
  - `~/Projects/health-coach` — `main`
  - `~/Projects/health-coach-nutrition` — nutrition work
  - `~/Projects/health-coach-training` — **this one**
- **Do NOT** run `rm -rf node_modules`, `npm audit fix`, or `expo install --fix`.
  If you must install, use **`npm install --legacy-peer-deps`** (HealthKit needs it).
- **Expo SDK 53**, TS 5.8.3. Don't "upgrade to fix" anything.
- **Dev server:** `npx expo start --port 8085` (port 8082 is usually taken by the
  nutrition worktree).
- **Simulator Expo Go must be the SDK-53 build** (2.33.17, cached at
  `~/.expo/ios-simulator-app-cache/`). The default SDK-56 build will refuse the
  project.

---

## What Phase 4 already built (the foundation)

- Training tab shell with session history feed
- Three-layer logging model (identity → surface → engine)
- Five logging surfaces: gym, GPS, climbing, swim, practice
- Timestamped sets → derived gym duration
- Live rest timer (banner + hook + math, tests green)
- `SessionPayload` data contract with `activity?` field
- Honest fidelity throughout (manual GPS ~0.5, gym fully timed, etc.)

**Status:** tsc 0, jest 87/87, on branch `phase-4-training`, 6+ commits ahead of
local main. Only markdown docs added since (Phase 6 spec + plan).

## What's deferred from Phase 4 that Phase 6 touches

- **Pass 4 — exercise library.** Rich gym templates *want* this (autocomplete
  names, muscle-group tags). MVP can ship gym templates with freeform exercise
  name strings and upgrade later.
- **Pass 7 — SessionTemplate entity.** Phase 6 ABSORBS this. The library IS the
  generalized SessionTemplate. Build it in Pass 1 below, not separately.

---

## Phase 6 plan — locked decisions (from the planning session)

1. **Week view** → 7-day horizontal strip, swipe for past/future weeks. **The
   Nutrition tab already uses this pattern** — match its visual language for
   consistency.
2. **MVP cut** → Library + week view + place items + tap-to-log (Passes 1–3).
3. **Recurrence** → templates carry optional day assignments + `isActive` toggle;
   active templates auto-populate new weeks. Deferred to Pass 4.
4. **Granularity** → day only, no time-of-day slots.
5. **Drift display** → session detail only, deferred past MVP. Mid-session
   modification + "update template?" prompt is Pass 6.
6. **Routes** → separate entity (not embedded in templates). Deferred to Pass 8.

**Cadence goals are benchmarks** (per `benchmarks-spec.md`) — Pass 5, post-MVP.
Two open questions to resolve before that pass: active cadence cap +
double-count bookkeeping, and hybrid density.

---

## What this session does: Pass 1

**Concern:** SessionTemplate entity + library CRUD. The data foundation and a
screen to create/browse/edit/delete saved training shapes.

**Ships:**
- `SessionTemplate` SQLite table + TS type. Fields: `id`, `name`, `surface`,
  `activity`, `shape` (JSON column — surface-specific payload), `dayAssignment`
  (optional 0–6), `isActive` (default true), `createdAt`, `updatedAt`.
- Library screen accessible from the Training tab.
- Create flow: pick surface/activity → fill the shape (reuse existing
  log-session form components where possible) → save (no timestamp, no logging).
- Edit and delete.
- Gym templates use freeform exercise name strings for now.

**Verify bar:** Create a "Push Day" gym template (3 exercises with target
sets/reps/weight), a "Park run" GPS template (5k run), and a "Vinyasa" practice
template (60 min). All persist, display in library, can be edited and deleted.
**tsc 0, all tests pass.** (tsc runs LAST, after any new test files.)

---

## Constitution — non-negotiables

- **Library ships empty.** No app-provided programs, no "starter packs," ever.
- Descriptive not prescriptive · no gamification/streaks · pull not push ·
  fidelity-first · null ≠ 0.
- Empty days neutral (no nag, no red).

---

## House rules

- **Plan-then-build for each pass.** State the approach before writing code.
- **Single-concern commits**, only when Dylan asks.
- **tsc LAST** — write any test files first, then run `npx tsc --noEmit`.
- **Flag, don't reinterpret** — if something seems off, ask Dylan.
- **No parallel worktree work** on this folder. If a session is open elsewhere,
  bail.

---

## Reference docs (in order of relevance)

- `planning/phase-6-plan-tab-build.md` — the build plan (just blessed)
- `planning/phase-6-plan-tab-spec.md` — the vision
- `planning/training-logging-spec.md` — surfaces + the original SessionTemplate
  sketch (§ "Session templates")
- `planning/benchmarks-spec.md` — for the cadence pass later
- `dev-log/phase-4-pass-*.md` — how prior passes were structured

---

## Verify / run

From `/Users/dolkoan/Projects/health-coach-training`:

- **Types:** `npx tsc --noEmit` (LAST)
- **Tests:** `npx jest`
- **App:** `npx expo start --port 8085` then `i` for simulator
