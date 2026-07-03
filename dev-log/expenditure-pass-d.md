# Expenditure build — Pass D: the measured residual, wired live

*Overnight build session (Fable), 2026-07-03. Brief: `dev-log/tdee-expenditure-build-handoff.md`.*

## What shipped

- **`src/lib/expenditureInputs.ts`** — `dailyIntakeFromEntries`: logged meals →
  per-local-day `DayIntake[]` (tz-aware via `bucketByLocalDay`). The day rule is
  **stricter than the Today card's** `dailyTotals`, on purpose: a day holding ANY
  kcal-unknown meal is `null` — summing what's known would *undercount* the day
  and bias the residual TDEE low. Null lowers the window's logCompleteness
  honestly instead of corrupting the number.
- **`src/hooks/useExpenditure.ts`** — 90 days of foodEntry observations + the
  caller's trend points → `estimateExpenditure`. Exactly two inputs, ever.
- **`ExpenditureCard`** gains the measured register: once the engine yields a
  window, **measured overwrites predicted** — the card switches entirely (no
  ghost of the baseline). Shows the residual with its `errorBandKcal`, the
  window dates, and "N of 14 days fully logged" (completeness shown, never
  zero-padded). Confidence renders through the shipped fidelity grammar
  (`fidelityTreatment(residualConfidence)` → opacity): solid data looks solid.
- While measurement can't be computed yet, the baseline stays with an added
  honest line: "Not enough logged data to measure yet…" (smoke-test §3).

## The takeover rule (deliberate)

Measured wins **whenever the engine yields a window** — no extra confidence
knob was invented. The engine's own gates (≥5 fully-logged days in a window,
≥3-day residual span, trend confidence factored into the band) ARE the noise
floor; adding a hidden takeover threshold would be a tuning dial the spec
doesn't ask for. A low-confidence measured window already carries its width
in the band and its roughness in the opacity.

## Firewall audit (spine rule 1)

Inputs to the measured number: logged intake + weight trend. **No session
data enters this path anywhere** — grep `useExpenditure`/`expenditureInputs`
for 'session': nothing. Training gets correlated against this number later
(correlation engine, not built); it never predicts it.

## Verify

- jest: 343 passed (338 + 5 new expenditureInputs).
- `expo export --platform ios`: clean. `tsc --noEmit` (LAST): 0.
