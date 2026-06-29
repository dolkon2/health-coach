# Nutrition tab — Pass 2 handoff (History), 2026-06-28

Pass 1 is merged to `main` (local, not pushed). This doc bootstraps a fresh
CC session to build Pass 2 — History (week strip + tap-into-a-past-day).

## Worktree + toolchain

Use `~/Projects/health-coach-nutrition` (the Pass 1 worktree is now stale —
its branch `nutrition-tab` is merged into main). Reset it onto main and
branch fresh; do NOT reinstall node_modules.

```
git -C ~/Projects/health-coach-nutrition fetch
git -C ~/Projects/health-coach-nutrition checkout main
git -C ~/Projects/health-coach-nutrition pull        # local; or just `git reset --hard main` against the shared repo
git -C ~/Projects/health-coach-nutrition checkout -b nutrition-tab-pass-2
```

Run: `npx expo start -c --port 8083`, press `i`. Toolchain: Expo SDK 53,
TS 5.8.3, jest-expo 53. **No parallel CC sessions on one folder** — the
shared node_modules/lockfile corrupts (see `feedback-parallel-sessions`).

## State

- **`main` @ merge commit** — Pass 1 in. Six commits: removeItemFromMeal
  helper (`1e4e223`), Nutrition tab + today-in-full (`306fac4`), Today
  slimmed (`2f4a97c`), Pass 1 dev-log (`b3ec6bb`), mealDisplayName
  (`f0c89b3`), Name-this-meal field (`0396b8e`), dev-log addendum
  (`a07dcc6`), merge commit. jest **135/135**, tsc **0**.
- **`~/Projects/health-coach-training`** — phase-4 training tab, ready to
  merge, leave alone.
- **`main` is local-only.** 51 commits ahead of `origin/main`. Push only
  if Dylan asks.

## Authority

Read these first, in order:
1. `planning/nutrition-tab-plan.md` § **Pass 2 — History**
2. `dev-log/nutrition-tab-pass-1.md` — what shipped + the "Next (Pass 2)"
   section at the bottom (sketches the layout)
3. `CLAUDE.md` + `planning/food-logging-spec.md` (honesty rules)

## Locked decisions for Pass 2 (Dylan, 2026-06-28)

1. **Option B layout** — week strip up top, today highlighted, tap any day
   for that day's view. (We chose A for Pass 1, B for Pass 2 — they
   compose; the day-view rendering Pass 1 built is reused as-is.)
2. **A dot under each day = "food was logged that day"** — a single
   honest signal, not a macro mini-bar (no targets, no progress).
3. **The week strip sits above the daily-total card.** The benchmark
   slot stays just below it (still invisible — Phase 5 fills it).
4. **Scroll-back beyond the visible week** — TBD with Dylan on the
   first checkpoint. Either swipe the strip horizontally, or a quiet
   "← older" affordance below. Don't decide alone.

## What Pass 1 already gave you (reuse, don't rebuild)

- `mealDisplayName(payload)` — honest card title (lib/foodLog.ts)
- `hourBucketLabel(iso, tz?)` — left-gutter time anchor (lib/date.ts)
- `dailyTotals(meals)` — null-honest aggregation (lib/foodLog.ts)
- `removeItemFromMeal(payload, index)` — per-item delete (lib/foodLog.ts)
- `itemMacroSummary(item)` — per-item macro line (lib/foodLog.ts)
- `fidelityTreatment(fidelity)` — visual tier only (lib/foodLog.ts)
- The hour-bucketed meal-card render in `app/(tabs)/nutrition.tsx`
  (~lines 130–250) — factor it out for reuse across today + history days.

## Net-new for Pass 2 (sketch — confirm at the planning checkpoint)

- **Storage query** — fetch foodEntry observations for a given local-day
  window, AND a batch query for "which of these N local days had any
  food logged" (the dots). The tz-aware `localDayOf` /
  `bucketByLocalDay` helpers in `core/src/timeline.ts` are already
  there from Pass 2.6.
- **`<WeekStrip>` component** — 7 day-cells (M/T/W/T/F/S/S + date),
  selected state, dot signal, tap callback. Likely in `src/components/`.
- **Day view extraction** — pull the hour-bucketed meal list out of
  `app/(tabs)/nutrition.tsx` into a reusable piece so today and any
  past day render with the same code.
- **Route shape** — does selecting a past day push a new stack screen
  (`/nutrition/day/[yyyy-mm-dd]`), or stay in-tab with local state?
  Stack screen is cleaner for browser-style "back" affordance. Ask
  Dylan at the planning checkpoint.

## Honesty (binds)

- `null ≠ 0` — a missing macro on a past day stays unknown; never zero.
- Fidelity is a visual tier, never a number.
- No targets, nags, or streaks anywhere — the empty days don't shame.
- The week-strip dot is the ONLY signal of past-day activity; do not
  add a per-day calorie pip or partial-day badge in v1.

## Discipline (carry from Pass 1)

- Single-concern commits, `Co-Authored-By: Claude Opus 4.7
  <noreply@anthropic.com>`.
- **HARD review checkpoints** — show diffs/mocks BEFORE coding the
  layout. Dylan reviews on sim; flag don't reinterpret.
- Plan files before writing. tsc runs LAST after the test files exist.
- Non-technical founder — explain plainly, mock layout/UX changes,
  checkpoint before any UX or core/migration commit.
- **Distrust clean merges** — the prior one silently duplicated
  `app.json`'s `extra` block. Spot-check after merge.

## Suggested first move

Read the three authority docs. Then propose Pass 2 in ~3 commits
(storage query → WeekStrip component → wire-in + day view extraction
→ tests + tsc), MOCK the layout (week strip + a non-today day view),
and wait for Dylan's go before writing any RN code.
