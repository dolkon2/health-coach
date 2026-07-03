# Expenditure build — Pass F: nutrition benchmark entry + surfaces

*Overnight build session (Fable), 2026-07-03. Brief: `dev-log/tdee-expenditure-build-handoff.md`.*

## What shipped

- **Form (`benchmarkForm.ts` + `edit-benchmark.tsx`)** — four nutrition picks
  join step 1 under a "Nutrition" section: **Calories** (days ≤/≥ an amount),
  **Protein** (macro days predicate; a chip switches to carbs/fat/fiber),
  **Log food** (days with a complete-enough log), **Capture** (fidelity:
  "% of entries at T2+/T3"). Still no goal-type picker — the pick seeds a
  behavior face; an outcome is pairable, never pushed. Nutrition paths can
  pair **bodyweight or energy balance** as the outcome. Full build↔hydrate
  inverse + validation, tested.
- **Suggested-but-editable targets (`benchmarkSuggest.ts`)** — locked decision
  honored: protein pre-fills at ≈0.8 g/lb of the *trend* weight; "stay under"
  calories pre-fills at the current burn estimate (measured first, else
  baseline) − 300. Pre-fill only lands in an empty field, only from real data
  (no default person), and the copy says "yours to change."
- **Today cards (`benchmarkStatus.ts`, hooks)** — `BehaviorStatus` is now a
  union: `count` (unchanged), `days` ("1/5 days this week · 2 unknown" —
  unknowable days NAMED, never folded into misses), `share` ("75% at T2+ this
  week · target 80%", honest "no entries yet"). `OutcomeStatus` gains
  `balance` (measured intake − burn via the expenditure window) with an
  honest "not enough data to measure yet".
- **Reflect (`benchmarkReflect.ts`, `reflect.tsx`)** — `nutritionWindowCounts`
  renders the rhythm three-valued at the window grain: `complete` now means
  *verdict revealed*, so an elapsed week whose unknowable days left it
  undecidable renders hazed exactly like the in-progress one, and
  `consecutiveAtTarget` (unchanged!) skips it — the revealed run is never
  broken or extended by unknowable data. Share benchmarks bar as percentages
  against the target line. An energy-balance outcome keys a numeric hero
  (no chart pretends to exist); behavior rhythm beneath. `WindowCount` gains
  `current` so hazed past windows keep their date label ('now' is only now).
- **Hooks** — statuses/reflect fetch food entries only when a nutrition face
  needs them (query floor padded 2 days for local-day bucketing); the measured
  expenditure window flows in from the same `useExpenditure` the Nutrition tab
  uses. Firewall intact: sessions never touch the nutrition/energy path.
- Removed Reflect's stale "Expenditure available once food logging is in
  (Phase 2)" line — the expenditure surface ships on the Nutrition tab.

## Verify

- jest: 390 passed (368 + 22 new: form-nutrition 10, suggest 4, status-nutrition 8),
  including 4 assertion updates for the new union discriminators (type
  evolution, not behavior change). Export clean, tsc 0 (LAST).

## ⚑ Flags

- **⚑ Deficit size**: the calorie pre-fill uses TDEE − 300 kcal
  (`SUGGESTED_DEFICIT_KCAL`); the handoff locks "deficit for a weight goal"
  but not its size.
- **⚑ Day-grain rhythm**: for days-benchmarks the rhythm shows per-WINDOW hit
  counts with three-valued haze; a per-day grid (MacroFactor's day squares)
  inside the current window would be a strict upgrade — the day verdicts are
  already computed (`evaluateDaysWindow.byDate`), only the component is missing.
- **⚑ Macro-switch reset**: switching the macro chip resets the amount field
  (protein gets its suggestion back, others go blank) so a protein suggestion
  can't silently become a fiber target. Deterministic, but worth a feel-check.
