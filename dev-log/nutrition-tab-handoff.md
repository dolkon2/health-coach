# Nutrition Tab — handoff, 2026-06-28

(Ring 2 + all post-smoke-test follow-ups MERGED to main; Nutrition-tab Pass 0 spec committed.)

**Worktree:** `~/Projects/health-coach-nutrition`, branch **`nutrition-tab`** (off main).
Run git via `-C` against that path. **Toolchain:** Expo SDK 53 / TS 5.8.3 / jest-expo 53.
Do NOT reinstall node_modules. Run app: `npx expo start -c --port 8083`, press i (a dev
server may already be running). Dylan reviews each pass live on the iOS sim.

## State

- **main @ `c2bf330` (LOCAL — not pushed).** Ring 2 + follow-ups all merged: Today's
  food + honest daily total (`dailyTotals`, null≠0 cross-meal), per-meal tz times
  (`localTimeLabel`), food names (`FoodItem.description` + `MealTemplate.name` via
  migration 004), USDA search ranking (`usdaDataTypeRank`: Foundation/SR > Branded),
  swipe-to-delete meals, per-item breakdown (`itemMacroSummary`) + tap-to-expand,
  edit-a-meal (`useFoodLog(editId)` → `updateObservation`), live macro preview
  (`scaleMacros` + `selectFood`), + fixes: hero calorie clip, USDA Atwater energy
  fallback (quirk 22 — Foundation foods omit nutrient 208), keyboard-aware scroll,
  named delete confirm, re-log inherits saved name. **jest 125 / tsc 0.**
- **branch `nutrition-tab` @ `69e97d1`:** Pass 0 = the spec doc only.

## Authority

`planning/nutrition-tab-plan.md` (READ FIRST) + `CLAUDE.md` (constitution) +
`planning/food-logging-spec.md`. Per-pass notes in `dev-log/`; quirks in
`dev-log/quirks.md` (1–22).

## Locked decisions (Dylan, 2026-06-28)

- **Mirror-first — NO prescriptive targets in v1.** Goals come later via the benchmark
  mechanic (Phase 5), as declared intent the tab reflects — never nags/streaks.
- **Energy balance IS surfaced — as a tier-3 MODELED estimate WITH error band.** The
  2.6 `ExpenditureReport` gets its first UI here; never gospel; null intake excluded.
- **Inline per-item delete lives in the TAB's meal view, NOT on Today.**
- **Today glance = daily total + COMPACT meal list (tap → edit) + Log food.** No
  breakdown/expand/inline-delete on Today.

## NEXT — Pass 1 (tab scaffold + Today slim + today-in-full)

Each pass: plan files → jest green → `tsc` LAST → single-concern commit + dev-log note.

1. **Add the Nutrition tab** to `app/(tabs)/_layout.tsx` (alongside Today/Training/
   Reflect) — match the tab bar's icon/label convention. New screen `app/(tabs)/
   nutrition.tsx`.
2. **Slim Today** (`app/(tabs)/index.tsx`): keep the `dailyTotals` card + a COMPACT
   today's-meals list (name + time + macro line + fidelity dot, tap → `/log-food`
   `editId`) + Log food. **Remove** the tap-to-expand breakdown + `expandedFood`
   state from Today (depth moves to the tab).
3. **Tab "today in full"** (`nutrition.tsx`): the day's meals with per-item breakdown
   (reuse `itemMacroSummary`), **inline per-item delete** (the one net-new bit — see
   below), tap-to-edit (→ `/log-food` `editId`). Reuse `useTodayObservations`
   (`foodEntriesToday`) + `dailyTotals`.
4. Saved-meals management folds in here or a small follow-up.

**Inline per-item delete (net-new, make it a TESTED pure fn):** add
`removeItemFromMeal(payload, index)` to `src/lib/foodLog.ts` → returns the meal's
updated `FoodEntryPayload` with that item dropped and macros re-rolled
(`rollupMacros`), or `null` if it was the last item. The tab calls `updateObservation`
with the rebuilt meal, or `deleteObservation` when it returns null. Unit-test it
(macros re-roll; null≠0 preserved; last-item → null).

**Reuse (all on main):** `dailyTotals`, `itemMacroSummary`, `scaleMacros`,
`FidelityTreatment`/`fidelityTreatment`, `useFoodLog(editId)`, `localTimeLabel`,
`foodEntriesToday`, `updateObservation`/`deleteObservation`.

## Then

- **Pass 2 — History** (past local days, per-day totals, tap → day detail).
- **Pass 3 — Energy balance** (wire `estimateExpenditure` to day-keyed intake +
  weigh-ins; render intake vs expenditure w/ error band + confidence).
- **Pass 4 — Trends** (intake over time, Reflect chart idiom, custom SVG, no library).

## Honesty (binds)

null≠0 (never inferred); fidelity = a visual tier, never a number; energy balance =
tier-3 modeled w/ error band, never overwrites tier-1; NO targets/nags/streaks/
gamification (mirror, not coach).

## Discipline (Dylan — [[feedback-commit-and-review-discipline]], [[feedback-verify-order]])

Single-concern commits (+ `Co-Authored-By` trailer); HARD review checkpoints — show
diffs/mocks and WAIT for go, he reviews on the sim each pass; flag don't reinterpret;
plan files before writing; `tsc` LAST after tests. He's non-technical — explain
plainly, MOCK UI changes (the visualize tool worked well), checkpoint before
committing UX/core/migration changes. Distrust suspiciously-clean merges (the last
merge silently duplicated app.json's `extra` — caught on inspection).

## Other worktrees — don't disturb

`~/Projects/health-coach` = main / **Garmin** (has uncommitted-then-committed
`withFmtFix` `2676eee`); `~/Projects/health-coach-training` (`phase-4-training`) =
ready to merge. Don't run parallel CC sessions on one folder; don't reinstall
node_modules. **main is local-only — push only if Dylan asks.**

## Merge

`nutrition-tab` → `main` when the tab is solid + sim-verified (to merge, the main
worktree must be clean — commit/stash any Garmin WIP first).
