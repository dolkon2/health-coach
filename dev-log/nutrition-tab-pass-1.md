# Nutrition tab — Pass 1 — Tab scaffold + today-in-full + Today slimmed

**Goal:** Add the Nutrition tab as the depth surface for food, move the
per-meal breakdown there, add inline per-item delete, and slim Today's food
section back to a glance. Pass 1 in `planning/nutrition-tab-plan.md`.

Option A landed (today-only, time-anchor gutter, benchmark slot reserved
but invisible). Option B (week strip + history) deferred to Pass 2 — the
two compose cleanly per Dylan's "easy to go A → B" sketch.

## What shipped

- **`src/lib/foodLog.ts`** — `removeItemFromMeal(payload, index)` builder.
  Pure; re-rolls all six macros via the existing `rollupMacros` (null
  preserved); returns `null` when removing the meal's last item so the
  caller deletes the whole observation; throws on out-of-range index.
  Fidelity re-blend is the caller's job (it lives on the envelope, not the
  payload). 5 new tests, total foodLog suite 28/28.
- **`src/lib/date.ts`** — `hourBucketLabel(iso, tz?)` returning "10 AM",
  "12 PM", "3 PM". Bucket only — minutes still render inside each row via
  `localTimeLabel`.
- **`app/(tabs)/_layout.tsx`** — `Nutrition` tab inserted between Training
  and Reflect with the lucide `Apple` icon. Order: Today · Training ·
  Nutrition · Reflect.
- **`app/(tabs)/nutrition.tsx`** — new screen. Today's daily-total card
  (reuses `dailyTotals`), then meals grouped by hour-of-day bucket. Each
  meal card: tap → edit, swipe-left → delete the meal; multi-item meals
  expand to per-item rows with `X` on the right per item → confirm →
  `removeItemFromMeal` → `updateObservation` (with re-blended fidelity)
  or `deleteObservation` if the meal had only that item. Empty state
  matches Today's pattern. Benchmark slot reserved above the totals card
  (commented placeholder — Phase 5 fills it).
- **`app/(tabs)/index.tsx`** — Today's food section slimmed: removed the
  `expandedFood` state, the "N items ▾" toggle, and the per-item breakdown
  block. Daily total + compact per-meal row (tap → edit, swipe → delete)
  + `Log food` is all that remains. `itemMacroSummary` import dropped.

## Honesty rules carried

- `null ≠ 0`: the per-item delete re-rolls macros via `rollupMacros`, so
  a remaining partial item correctly drops the rolled macro back to null
  (tested).
- Fidelity stays a visual treatment only — re-blended on every item delete
  so it tracks the meal's actual composition; never displayed as a number.
- No targets, no nags, no progress bars — the slot's reserved but invisible
  until benchmarks (Phase 5) earn it.
- Edits replace, they don't supersede (the existing `updateObservation`
  contract).

## Verification

- `npx jest` → 130/130 (was 125 + 5 new for `removeItemFromMeal`).
- `npx tsc --noEmit` → clean.
- Sim review pending — Dylan on iOS sim.

## Commits

1. `1e4e223` — `feat(nutrition): removeItemFromMeal helper`
2. `306fac4` — `feat(nutrition): add Nutrition tab with today-in-full view`
3. `2f4a97c` — `refactor(today): slim today's food to a glance`

## Next (Pass 2 — History, sketched)

The plan now is Option B's week strip + tap-into-a-past-day, which slots
above the totals card (the benchmark slot stays separate, just below it).
New piece: a "food entries for a given local day" query in storage; the
day view reuses the same hour-bucketed render this pass built. The day
strip's dot-per-day signal reads from the same query, in one batch.
