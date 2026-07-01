# Phase 3 Pass 2 — HealthKit/Wearable Integration (Rebase + Merge)

## What this is

Branch `phase-3-pass-2` has ~1,300 lines of tested HealthKit/wearable code that was written before the training and nutrition-redesign work landed on main. It needs rebasing onto current main, conflict resolution, and on-device verification before merging.

## What's on the branch (the good stuff — keep all of it)

Six commits of wearable code, bottom-up:

1. **WearableSource interface + persistent connection state** (`1053fa4`)
   - `src/lib/wearable.ts` — platform-agnostic interface (steps + sleep readers)
   - `src/lib/healthkit/state.ts` — key-value persistence for connected/backfilled flags

2. **HealthKit reader** (`c7d13c8`)
   - `src/lib/healthkit/reader.ts` — iOS-only, reads steps + sleep from HealthKit
   - `src/lib/healthkit/index.ts` — platform switch (real reader on iOS, stub elsewhere)

3. **Normalize raw samples into Observations** (`a42bf93`)
   - `src/lib/healthkit/normalize.ts` — raw HK samples to typed Observations
   - `src/lib/__tests__/healthkitNormalize.test.ts` — 12 tests

4. **Backfill + daily-poll ingest layer** (`376c783`)
   - `src/lib/healthkit/ingest.ts` — 90-day backfill on first connect, daily poll after
   - `src/lib/healthkit/sourcePrecedence.ts` — source ranking (Garmin > iPhone)
   - `src/storage/__tests__/healthkitIngest.test.ts` — 3 tests

5. **React hook for sync** (`1053fa4` + `19c3fc4`)
   - `src/hooks/useWearableSync.ts` — connect/sync/status hook
   - `src/components/StepsCard.tsx` — glance card for daily steps
   - `src/components/SleepCard.tsx` — glance card for sleep

6. **Today screen wiring** (`19c3fc4`)
   - `app/(tabs)/index.tsx` — StepsCard + SleepCard below food, Apple Health CTA
   - `src/hooks/useTodayObservations.ts` — returns `stepsToday` + `sleepToday`

7. **Migration 005** — `wearable_state` table (key/value for connected + backfill flags)

## What the branch also carries (already on main — will drop during rebase)

The bottom 6 commits are old nutrition Pass 2.5 work (datetimepicker, When? picker, any-day logging). These are already on main via the logger-redesign merge. They should auto-drop or conflict-resolve to main's version during rebase.

## Rebase plan

```bash
# From the main worktree:
git checkout phase-3-pass-2
git rebase main
```

### Expected conflicts and how to resolve them

| File | Conflict reason | Resolution |
|------|----------------|------------|
| `app/(tabs)/index.tsx` | Both branches changed the Today screen. Branch adds StepsCard/SleepCard/CTA. Main added training session cards + food totals layout. | **Keep main's layout, add the wearable imports + StepsCard/SleepCard/CTA section from the branch.** The wearable block goes after the food section. |
| `src/components/index.ts` | Branch exports StepsCard + SleepCard. Main exports RestTimer + other new components. | **Keep main's exports, add StepsCard + SleepCard.** |
| `src/hooks/useTodayObservations.ts` | Branch adds `stepsToday` + `sleepToday` returns. Main may have changed the hook shape. | **Add the two new fields to whatever main's version looks like.** |
| `src/storage/migrations/index.ts` | Branch has migration005 as `wearable_state`. Main's highest is 004. | **Clean merge — just add the import + array entry for 005_wearable_state.** |
| `app/log-food.tsx`, `src/hooks/useFoodLog.ts`, `app/(tabs)/nutrition.tsx` | Old Pass 2.5 versions vs main's logger-redesign versions. | **Take main's version entirely.** The branch's nutrition code is superseded. |
| `src/lib/date.ts`, `src/lib/__tests__/date.test.ts` | Both added helpers. | **Keep main's version, check if the branch added anything unique (unlikely).** |

### Post-rebase checklist

- [ ] `npx jest` — all tests pass (baseline is 165 on main; branch adds 15 → expect ~180)
- [ ] `npx tsc --noEmit` — clean
- [ ] Verify `StepsCard` and `SleepCard` render on simulator (will show empty/CTA state since no HealthKit in sim)
- [ ] On-device dev-client build to test real HealthKit: `npx expo run:ios --device`
- [ ] Test the Apple Health CTA → permission prompt → backfill flow on real device

## Current main baseline

- HEAD: `258cb56` (merge: USDA search relevance scoring)
- SDK: Expo 53 / TypeScript 5.8.3
- Tests: 18 suites / 165 passing
- Dev server: port 8084
- Migration ceiling: 004 (meal_template_name)

## Dependencies

The branch uses `expo-healthkit` which should already be in `package.json` on main. If not:
```bash
npm install expo-healthkit --legacy-peer-deps
```

HealthKit requires a **dev-client build** (not Expo Go) to work on a real device. The `expo-dev-client` package and iOS `bundleIdentifier` are already configured on main.

## Boundaries

- Do NOT touch the nutrition logger, training tab, or template library code — those are done and merged.
- Do NOT change the data model or Observation schema — the wearable code writes standard Observations via existing storage.
- The wearable code is read-only from HealthKit — it never writes back.
- Source precedence (Garmin > iPhone) is baked into `sourcePrecedence.ts` — don't change the ranking without discussion.
