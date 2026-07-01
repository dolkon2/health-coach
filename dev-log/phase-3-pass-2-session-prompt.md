# Phase 3 Pass 2 — Session Prompt

Paste this into a fresh Claude Code session opened at `~/Projects/health-coach`:

---

## Session goal

Rebase branch `phase-3-pass-2` onto current `main`, resolve conflicts, verify tests pass, and merge. This branch has ~1,300 lines of tested HealthKit/wearable integration code (Apple Health steps + sleep import) that was written before the training and nutrition work landed on main.

## Bootstrap

1. Read `dev-log/phase-3-pass-2-rebase-handoff.md` — it has the full conflict map, resolution guide, and post-rebase checklist.
2. Read `CLAUDE.md` for project conventions.
3. Check the current state: `git log --oneline -5 main` and `git log main..phase-3-pass-2 --oneline`.

## What to do

1. **Rebase `phase-3-pass-2` onto `main`.** The bottom 6 commits are old nutrition work already on main — they should auto-drop or resolve to main's version. The top 6 commits are the wearable code to keep.

2. **Resolve conflicts** using the table in the handoff doc. Key points:
   - `app/(tabs)/index.tsx`: keep main's layout, graft in the wearable imports + StepsCard/SleepCard/CTA block
   - `src/storage/migrations/index.ts`: add 005_wearable_state (slot is free)
   - Nutrition files (`log-food.tsx`, `useFoodLog.ts`, `nutrition.tsx`): take main's version entirely

3. **Verify:**
   - `npx jest` — expect ~180 tests (main has 165, branch adds 15)
   - `npx tsc --noEmit` — must be clean
   - Run the dev server (`npx expo start --port 8084`) and check Today screen shows the Apple Health CTA in the simulator

4. **Merge into main** with `--no-ff` and a descriptive merge commit.

5. **Push** to origin after merge.

## Rules

- SDK 53, TypeScript 5.8.3. Use `npm install --legacy-peer-deps` if adding deps.
- Don't touch nutrition logger, training tab, or template code — those are done.
- Run tsc LAST, after all tests pass.
- Single-concern commits if you need intermediate steps during rebase.
- The dev server runs on port 8084. Don't start additional servers.
- The Screen.tsx headspace fix (`paddingTop: theme.spacing[4]` instead of `insets.top + theme.spacing[4]`) is an uncommitted change on main — don't revert it.

## After merge

The wearable code reads from HealthKit but can't be tested in the simulator (no Apple Health). To verify on a real device: `npx expo run:ios --device` (needs phone plugged in + Apple developer account in Xcode). This is optional for the rebase session — the CTA and empty-state cards should render fine in sim.
