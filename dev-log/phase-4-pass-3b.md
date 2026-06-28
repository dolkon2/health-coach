# Phase 4, Pass 3b — Live gym session: set-completion + rest timer

**Goal:** Make a gym session genuinely *lived* — duration derived from when sets
are finished, and an auto-starting rest timer that alerts when rest is up. Built on
this branch (worktree split) as two single-concern commits.
(planning/phase-4-training-plan.md, Pass 3)

Verified green: **tsc** exit 0, **jest 79/79** (Expo SDK 53, TS 5.8.3).

## Commit A — live set-completion → gym duration is fully derived (`305ff1a`)

- **Per-set ✓ affordance** (`SetDoneButton` in `app/log-session.tsx`) stamps the
  set's `completedAt`; the session duration is derived from that spread (Pass 3a's
  `deriveSessionDuration`). The gym surface's manual Duration field is gone,
  replaced by a "timed from your sets" hint.
- **`durationMin` is now optional** (`core/src/observation.ts`) — a gym session
  whose spread is unknowable (batch/clustered) carries *no* duration rather than a
  fabricated 0 (constitution: null ≠ 0). `validateSessionForm` drops the gym
  duration requirement; the builder omits it when underived. Non-gym surfaces still
  carry a manual, validated duration.
- **Null-safe reads** — `reveal()` lines, the energy-system ledger, and the
  SessionCard meta all guard the now-optional duration.

## Commit B — rest timer with local notifications (this commit)

- **`expo-notifications@~0.31.5`** installed (SDK-53 pin, `--legacy-peer-deps`) and
  added to `app.json` plugins alongside the existing HealthKit entry.
- **Pure timer math** `src/lib/restTimer.ts` (`restRemainingSec` / `isRestComplete`
  / `formatRest`) — unit-tested (`restTimer.test.ts`, 5 cases).
- **`useRestTimer`** hook — finishing a set auto-starts the rest; it ticks an
  on-screen countdown and schedules a `TIME_INTERVAL` local notification so the
  alert fires with the phone down. All Notifications calls are best-effort (a denied
  permission just means no buzz; the in-app countdown still runs). No
  `setNotificationHandler` — the in-app banner is the foreground feedback, the
  notification covers background.
- **`RestTimer`** banner (tap to skip), rendered in the gym body while resting.
- **Settings** gains `restTimerSec` (default 120) — the timer starts from it.

## Constitution / decisions

- Duration falls out of structure, never declared; batch = absent, never 0.
- The rest timer is a **user-started utility** (begins only on a set-done tap), not
  a pushed nudge — pull, not push.

## ⚠️ Verification caveat

JS, types and the pure timer math are verified here (tsc 0, jest 79/79). The
notification actually *firing* needs a dev-client rebuild on device — it cannot be
exercised from this environment. Smoke-test on device: log a gym set, tap ✓, confirm
the countdown runs and a "Rest complete" notification fires after the configured rest
(background the app to see it).

## Follow-ups

- Recording *actual* rest taken per set (gap to the next set-done) is deferred — the
  timer is the utility; per-set rest history is a later refinement.
- A Settings screen to edit `restTimerSec` (currently a fixed default).
