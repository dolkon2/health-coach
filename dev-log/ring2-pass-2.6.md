# Ring 2 — Pass 2.6 — Expenditure engine, wired for real

**Goal:** Replace the `estimateExpenditure` stub now that intake exists. Solve
TDEE as the residual of logged intake against weight-trend movement, as a report
of per-window estimates each carrying its own residual confidence and an honest
`null` when too sparse/partial. Land `timeline.bucketByLocalDay` (tz-aware) here.
(planning/ring2-food-logging-plan.md § Pass 2.6 — a flagged/locked core edit)

## What shipped

- **`core/src/timeline.ts`** — `bucketByLocalDay` (was a `notImplemented` stub)
  now groups observations into the user's **local civil day**, tz-aware per each
  observation's own `tz`, via `Intl.DateTimeFormat`. New exported `localDayOf`
  helper (the tz-aware counterpart to the UTC-slicing `dayKey`). This is the
  day-bucketing substrate the windowed, partiality-aware engine needs.
- **`core/src/expenditure.ts`** — the locked output shape, implemented:
  - `estimateExpenditure(trend, dailyIntake, windowDays?)` → `ExpenditureReport`
    `{ windows: ExpenditureWindow[], latest }`. Signature changed from the old
    `(trend, meanIntakeKcal)` to day-keyed `DayIntake[]` (no external consumers —
    verified before the change).
  - Each `ExpenditureWindow` carries `meanIntakeKcal | null`, `trendDeltaKg`,
    `inferredTdeeKcal | null`, **`residualConfidence` (0..1, per window — the field
    Phase 7 earned fidelity consumes)**, `logCompleteness` (0..1), `errorBandKcal`.
  - Residual: `TDEE = meanIntake − (ΔW·7700)/spanDays`. **Null intake days are
    EXCLUDED from the mean, never summed as 0**; a window is `null`/low-confidence
    when too few days are fully logged — it never fabricates a low total.
  - `deriveEarnedFidelity(windows)` — a typed `notImplemented('earnedFidelity',
    'Phase 7')` stub marking the integrity-boundary join site (occurrences ×
    per-window residual confidence), so the boundary is expressed in types now;
    the computation is Phase 7. **Never written by the logging layer.**
  - Constants documented + tunable: `KCAL_PER_KG 7700`, `WINDOW_DAYS 14`,
    `MIN_INTAKE_DAYS 5`, `MIN_RESIDUAL_DAYS 3`, `ERROR_BAND_BASE_KCAL 150`.

## Tests & verification

- `core/__tests__/expenditure.test.ts` (new) — **5 tests**: known intake + known
  trend delta → TDEE ≈ 2496 within its band (hand-checked); no intake / <2 trend
  points → null / empty report; **(Item 2)** complete-log window scores higher
  `residualConfidence` than an identical partial one, all in 0..1; **(Item 6)**
  null days excluded — mean of 9×2000 + 5×null is 2000, not 18000/14.
- `core/__tests__/timeline.test.ts` (new) — **3 tests**: a 06:00 UTC instant
  buckets to the prior local day in US Pacific (vs `dayKey`'s UTC slice); grouping
  by local day; each observation's own tz respected (UTC vs Honolulu split).
- `npm test` → **16 suites / 105 tests green**. `npx tsc --noEmit` → **exit 0**.

## Self-check against the plan

- Measured TDEE with an error band ✅; residual solved from intake + trend, never
  from activity ✅; sparse/partial → null / low confidence, never a guess ✅.
- Per-window `residualConfidence` (Phase-7 field) locked + on every window ✅;
  null is missing, excluded from intake, lowers completeness + confidence ✅.
- `bucketByLocalDay` tz-aware (civil day, not UTC) ✅; earned fidelity engine-
  derived, stubbed, never logger-written ✅.
- Only the plan's flagged core edits (expenditure rewrite + bucketByLocalDay);
  no other Ring-1 core touched ✅.

## Deferred / handed forward

- The trend engine + weekly stimulus still bucket by **UTC** `dayKey` (quirks
  1/10). Their fix — swap `dayKey` → `localDayOf` — now exists but is out of 2.6's
  scope (it would re-touch the Ring-1 trend engine). Left for a focused tz pass.
- `errorBandKcal` + `residualConfidence` are first-draft heuristics, and windows
  tile non-overlapping from the first trend day (so `latest` is the most recent
  tiled window, not a rolling last-14-days) — quirk 21, tune against real data.
- Intl-tz relies on the runtime's ICU data — quirk 20.
- Earned-fidelity *computation* + signal attribution remain Phase 7; the
  scaffolding (occurrences-as-query from 2.4 + per-window confidence here) stands.
