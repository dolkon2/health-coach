# Expenditure build — Pass C: fidelity chunking (capture tiers T1/T2/T3)

*Overnight build session (Fable), 2026-07-03. Brief: `dev-log/tdee-expenditure-build-handoff.md`.*

## What shipped

- **`core/src/nutrition/captureTier.ts`** — capture method as the legible unit
  (Dylan's locked revision): **T1** incomplete (a bare macro — incompleteness
  trumps method, so even a weighed log missing a macro reads T1), **T2**
  describe/photo, **T3** weighed/scanned. `captureTier(meal)` is structural
  (reads `isPartial` + `inputMethod`, never a stored flag), `captureTierRank`
  gives 1/2/3 for "T2+"-style thresholds, `captureLabel` renders the on-entry
  words ("T3 · weighed", "T2 · photo", "T1 · partial" — "scanned" for barcode).
- The tier is deliberately a **string code** (`'T1'|'T2'|'T3'`), so it can never
  be confused with the Observation *evidence* tier (1/2/3) — two different axes.
  The module header also restates the fidelity-benchmark firewall: this chunk is
  what a fidelity benchmark may target; the engine's earned-fidelity score never.
- **Surfaced on entries**: both meal-row surfaces (Today's food list and the
  Nutrition tab's `DayMealList`) show the capture label right-aligned on the
  macro line, in the quiet `label`/textMuted register — visible, not noisy.
- `isPartial`'s parameter loosened to a macro `Pick` (type-level only, zero
  runtime change) so the tier module reads it without a cast.

## Verify

- jest: 338 passed (331 + 7 new captureTier).
- `expo export --platform ios`: clean. `tsc --noEmit` (LAST): 0.

## Notes

- The unit is the MEAL's `inputMethod` (the envelope). A mixed-method meal
  carries its envelope method; per-item tier chunking would be a later
  refinement — the continuous per-item fidelity blend already carries the
  precision story visually.
- No 'label' input method exists on this branch (main's label-scanning arc
  isn't merged here); when it merges, `METHOD_WORD` + the T3 case gain one row.
