# Expenditure build — Pass A: baseline TDEE engine (pure core/)

*Overnight build session (Fable), 2026-07-03. Brief: `dev-log/tdee-expenditure-build-handoff.md`.*

## What shipped

`core/src/baselineTdee.ts` — `estimateBaselineTdee(metrics, activityLevel)`, the
cold-start prediction. The one spot the app knowingly uses a population formula
(benchmarks-spec § TDEE cold-start):

- **Mifflin–St Jeor floor** (height/weight/age/sex), **Katch–McArdle** branch when
  bodyfat% is given — give more, get sharper.
- Output is `{ tdeeKcal, range, fidelity: 'LOW', method, bmrKcal, activityFactor }`.
  `fidelity` is literally always `'LOW'` (typed `Extract<FidelityTier, 'LOW'>`): a
  population prediction is the weak kind by definition, and the type system now says so.
- **Band**: ±20% of TDEE (Mifflin), ±15% (Katch–McArdle) — documented tunable
  heuristics; population TDEE predictions run 300–500 kcal off, and the band admits it.
- **Rounding to 10 kcal** on tdee + range — unit-kcal precision on a prediction is
  fake precision.
- `ACTIVITY_FACTORS`: the standard 1.2–1.9 table, keyed by the Route-1 self-report
  ("how active are you, typically?"). Firewall note in the header: this input is the
  user's own description, never derived from logged training — training data never
  predicts burn (spine rule 1).

## Verify

- jest: 314 passed (305 baseline + 9 new), suites 29.
- `expo export --platform ios`: clean (6.37 MB Hermes bundle).
- `tsc --noEmit` (LAST): 0 errors.

## Notes

- No ⚑ flags. All decisions in this pass were pre-locked by the handoff.
- Next: Pass B — body-metrics capture (settings persistence, M009) + baseline surface.
