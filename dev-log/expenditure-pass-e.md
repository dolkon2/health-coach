# Expenditure build — Pass E: day-predicate + nutrition-dimension math (pure core/)

*Overnight build session (Fable), 2026-07-03. Brief: `dev-log/tdee-expenditure-build-handoff.md`.*

## What shipped

- **`core/src/benchmark.ts` (additive)** — new `ResolvedDimension` members:
  `calories`, `macro` (protein/carbs/fat/fiber), `loggingConsistency`,
  `loggingFidelity`, `energyBalance`. Steps/sleep stay commented rows
  (NOTE-ONLY, per handoff). New `BehaviorFace.measure` variants:
  - `{ type: 'days'; target; condition }` — the new primitive: days in the
    window meeting a per-day condition (`DayCondition`: calories ≤/≥, macro
    ≤/≥, or 'logged').
  - `{ type: 'share'; targetPct; minTier }` — the fidelity benchmark's shape:
    % of the window's entries at T2+/T3 — capture-method distribution ONLY.
  Benchmark payloads are JSON columns → **no migration needed** (as predicted).
- **`core/src/nutrition/days.ts`** — the three-valued day engine:
  - `evaluateDayCondition` proves verdicts with **bounds**: the sum of a day's
    known values is a lower bound, so "≥X" hits the moment the bound crosses X
    (even on a partial day) and "≤Y" misses the moment it exceeds Y; anything
    unproven on incomplete data is UNKNOWABLE — never a miss. The in-progress
    day gets only irreversible verdicts for free from the same rule.
  - `'logged'` is deliberately **two-valued on closed days**: not logging IS
    the miss (otherwise a consistency benchmark could never miss).
  - `evaluateDaysWindow` is three-valued at the window grain: hit when proven,
    **missed only when mathematically dead** (counting unknowable + not-yet-
    elapsed days as still-possible), else unknowable — the shipped in-progress
    haze falls out as a special case.
  - `revealedRun`: unknowable neither breaks nor extends; a miss ends it.
  - `completeDayAverage`: complete closed days only, completeness shown
    ("2,180 avg · 5 of 7 days logged"), in-progress day excluded, null when
    nothing was knowable.
  - `captureTierShare`: entries at/above a tier — null on zero entries
    (a share of nothing is not 0%).
- **`core/src/expenditure.ts`** — `energyBalanceKcalPerDay(window)`: mean
  intake − measured burn (negative = deficit); null exactly when the residual
  is null. Algebraically it's the weight-trend movement in kcal/day, so it
  inherits the residual's honesty for free.
- `summarizeBenchmark` extended so the new measure shapes render truthfully
  (full nutrition summaries are Pass F's).

## Verify

- jest: 368 passed (343 + 23 nutritionDays + 2 energyBalance). Export clean, tsc 0 (LAST).

## Notes

- The `share` measure is a second new measure shape beyond `days`. Not a
  reinterpretation: the handoff's locked fidelity-benchmark wording ("80% of
  entries at T2+") is an entry-share, not a day count — the shape follows the
  locked decision.
