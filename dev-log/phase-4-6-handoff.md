# Handoff — Training tab: Phase 4 (built) + Phase 6 plan-tab (spec'd)

*Written 2026-06-28 to resume in a fresh session. Self-contained: read this top to
bottom and you can pick up cold. The worktree also auto-loads `CLAUDE.md` and the
specs in `planning/`.*

---

## TL;DR — where we are

Two threads, two different states:

1. **Phase 4 Training-tab core cut — BUILT, committed, green.** The logger is now the
   three-layer model (activity identity → surface → engine modality) with five real
   surfaces. Done and on the branch.
2. **Phase 6 Plan-tab — SPEC'd, NOT built.** Today's session turned the "Training tab
   should be a *planning* surface" conversation into a locked vision doc
   (`planning/phase-6-plan-tab-spec.md`). This is design only. No code, no build plan
   yet — and the spec says *do not build ahead of a blessed pass-by-pass plan*.

One Phase-4 fast-follow (**Pass 3c**) is still pending; the rest of the enrichment
layer (Passes 4/7/8) is deferred and now partly entangled with Phase 6 (see below).

---

## ⚠️ Environment — read before touching anything

- **Worktree:** `/Users/dolkoan/Projects/health-coach-training` · **branch:**
  `phase-4-training` · clean · **6 commits ahead of local `main`.**
- **Three worktrees share one repo** (parallel-session hazard is real — it already
  corrupted node_modules once):
  - `~/Projects/health-coach` — `main` (Garmin/wearable + nutrition Pass 1 merged)
  - `~/Projects/health-coach-nutrition` — Ring 2 food logging
  - `~/Projects/health-coach-training` — **this one**, `phase-4-training`
- **Do NOT** run `rm -rf node_modules`, `npm audit fix`, or `expo install --fix`. Deps
  are correct. If you must install, use **`npm install --legacy-peer-deps`** (HealthKit
  needs it).
- **Expo SDK 53**, TS 5.8.3. Don't "upgrade to fix" anything — the SDK was
  deliberately rolled back to 53 (commit `ac7f62d`).
- **Dev server:** `npx expo start` — port **8082 is usually taken by the nutrition
  worktree**, so it'll prompt; use **8085** (`npx expo start --port 8085`). In
  non-interactive runs pass the port explicitly or it skips the server.
- **Simulator Expo Go must be the SDK-53 build.** The simulator's default Expo Go is
  SDK 56 and will refuse the project ("incompatible with this version of Expo Go").
  The SDK-53 build (2.33.17) is cached at
  `~/.expo/ios-simulator-app-cache/` — install that one.
- **Rest-timer notifications need a dev client, not Expo Go.** In Expo Go you'll see
  `Cannot find native module 'ExpoPushTokenManager'` and a "removed from Expo Go"
  warning — that's expected. The timer's JS/math/tests are verified; the actual
  notification *firing* only works after an on-device `expo run:ios` dev-client build.
  Not a bug.

---

## Thread 1 — Phase 4 core cut (BUILT)

**Status: tsc 0, jest 87/87** — last verified after Pass 6. Only markdown docs have
landed since (the Phase-6 spec + a backlog edit), so the green status holds; re-run to
be sure (commands at the bottom).

The three-layer model is live. The logger switches its body on the resolved **surface**
(not the raw modality), and the activity the user picked is stored as an identity
label. Five surfaces shipped: **gym, GPS, climbing, swim, practice** (+ a footer-only
"other").

What each pass delivered (full detail in `dev-log/phase-4-pass-*.md`):

- **Pass 2** — surface-driven logger + activity identity + honest GPS fidelity
  (manual GPS drops to ~0.5; gym stays high). `activity?` added to `SessionPayload`.
- **Pass 3a** — timestamped sets → **derived gym duration**. Duration falls out of the
  first→last `completedAt` spread (`core/src/sessionTiming.ts`); batch-entered/clustered
  sets → **null duration + low fidelity, never fabricated**. `durationMin` is now
  optional on the payload.
- **Pass 3b** — live rest timer with local notifications (pure math in
  `src/lib/restTimer.ts`, hook `src/hooks/useRestTimer.ts`, banner
  `src/components/RestTimer.tsx`). User-started utility, **not** a nudge.
- **Pass 5** — swimming surface: pool (laps × length = distance, fidelity ~0.85) vs
  open-water (estimate, ~0.5); contributes real energy-system minutes to the ledger.
- **Pass 6** — practice surface (yoga/pilates/mobility): duration + effort + optional
  style; **contributes nothing fabricated** to volume/energy bars (sessionIds-only,
  like climb/hike).

**Key files touched:** `core/src/observation.ts` (data contract),
`core/src/stimulus.ts` (reveal() made block-driven; swim energy minutes),
`core/src/sessionTiming.ts` (new), `src/lib/session.ts` (form model: surfaces,
fidelity table, build/invert), `app/log-session.tsx` (surface-switched body),
`app/(tabs)/training.tsx` (routes `?activity=`), plus the rest-timer trio and tests.

---

## Thread 2 — Phase 6 Plan-tab (SPEC'd, not built)

**Doc:** `planning/phase-6-plan-tab-spec.md` (v0.1). **`backlog.md`** Phase-6 entry now
points at it. Committed as `0c87d25`.

This is the spec session `backlog.md` had been gating ("needs its own spec session
before any build"). The vision, locked:

- **Training tab = your training, planned or not** — a **week view** + a **library** of
  saved shapes. Same surface the backlog called "Plan tab"; **no fourth tab**. IA stays:
  **Today** = log in the moment · **Training** = plan · **Reflect** = the mirror.
- **The week is the anchor** — each day holds **Planned / Logged / Empty**; empty is
  neutral (no nag).
- **The library = saved shapes, any surface** (Push Day, Tuesday kayak, run route,
  vinyasa) = the `SessionTemplate` from `training-logging-spec.md`, generalized. **Ships
  EMPTY, user-authored only** — the constitutional line (no app programs, ever).
- **Connected flow** — planned item → tap → **live session** (reuses the Phase-4
  set/rest machinery) → Finish → Reflect. Same landing as an unplanned log; planned
  carries `templateId` for planned-vs-actual (a mirror, never a grade).
- **Three plan flavors coexist:** **placed** workouts (PPL split on days) · **cadence**
  goals ("run 3×/week" — counted, not placed) · **open** activities (no target). The
  hybrid week = placed + counted + open, one view.
- **Cadence goals ARE benchmarks** (`benchmarks-spec.md`), not a second system — they
  use its freeform-text + consistency-counter (count-not-streak) model. This also
  **answers that spec's open question**: a benchmark *can* be spawned contextually from
  the Training tab.

**Open questions (must resolve before a build plan — listed at the bottom of the
spec):** week-view shape (7-day strip vs agenda vs multi-week) · recurrence (a split
repeats — how, without the app owning a rigid program) · placement granularity
(day vs day+time) · routes-as-sub-shape (inside `SessionTemplate` or beside it) ·
planned-vs-actual surfacing · cadence cap & double-count bookkeeping.

---

## What's pending / the decisions in front of Dylan

1. **Phase-4 Pass 3c — static exercise seed + autocomplete** (the one remaining
   open task). ~80–100 curated exercises tagged with muscle group + movement pattern;
   gym name autocomplete that auto-fills the pattern. Was in the original Phase-4 scope,
   deferred as nice-to-have. Small, self-contained, buildable now.
2. **Merge `phase-4-training` → `main`.** The core cut is green and done. This is a
   clean merge candidate whenever Dylan wants the Training surfaces on main. (Left to
   Dylan / the main session — watch the parallel-worktree hazard.)
3. **Phase 6 build** — *blocked on the spec's open questions.* The next step is a
   **build-plan session** (resolve week-view shape + recurrence first), not code.
   Note: the library **is** the deferred **Pass 7 `SessionTemplate`** entity — so
   Phase 6 and Pass 7 are now one effort, and rich gym templates also want **Pass 4**
   (exercise library). Light templates (kayak/run/practice) need neither.

**Suggested next move:** either knock out Pass 3c (quick, finishes Phase 4 clean), or
start the Phase-6 build-plan by resolving the week-view + recurrence open questions.
Both are reasonable; it's Dylan's call which to pick up.

---

## Verify / run (commands)

From `/Users/dolkoan/Projects/health-coach-training`:

- **Types:** `npx tsc --noEmit` (run LAST, after any test files — house rule)
- **Tests:** `npx jest`
- **App:** `npx expo start --port 8085` then `i` for the simulator (ensure SDK-53 Expo
  Go per the env note above).

---

## Constitution — the non-negotiables (every build honors)

Descriptive, not prescriptive · **no gamification / no streaks** (a count is fine, a
streak with celebration/loss-aversion is not) · **pull, not push** (nothing surfaced
unprompted; no "you haven't run this week" ping) · **fidelity-first / honest** (never
fabricate a number a surface can't truthfully report) · **null ≠ 0** · **library is
user-authored only** (the app ships no programs). Spine rules 5 (gamification), 6
(pull-not-push), 7 (goals are yours) are the roots; `benchmarks-spec.md` and
`phase-6-plan-tab-spec.md` carry the details.

---

## Reference — the docs to read in a new session

- `planning/phase-6-plan-tab-spec.md` — the new vision (Thread 2).
- `planning/training-logging-spec.md` — the logging surfaces + `SessionTemplate`.
- `planning/benchmarks-spec.md` — the goal/cadence model + consistency counters.
- `planning/phase-4-training-plan.md` — the Phase-4 pass plan (built).
- `dev-log/phase-4-pass-*.md` — per-pass build notes.
- `planning/backlog.md` — deferred items (Phase-4 fast-follows, Phase-6).
