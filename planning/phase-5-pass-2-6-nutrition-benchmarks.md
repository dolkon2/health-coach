# Phase 5 · Pass 2.6 — Nutrition benchmarks, unified

*Refines Pass 2.5's nutrition family surface. Does not touch v0.4's two-faces architecture (that spec — `benchmarks-spec.md` — stays intact). Scope is nutrition only; training-side benchmarks (activity cadence, gym PRs, run pace/distance) wait for the training spec.*

*Decisions locked 2026-07-03 review: (i) two benchmark types in the family — one for daily targets, one for cadence-only; (ii) suggestion engine ships prefill-only, rate in lb/wk or kg/wk following the user's weight unit; (iii) fiber is included in-pass; (iv) migration soft-archives old nutrition benchmarks (does not delete rows) so future cross-benchmark "story arc" surface can spelunk them; (v) bodyweight-outcome target-number is required when the outcome is attached.*

---

## The one-sentence change

Today the Nutrition family exposes **four** separate benchmark types (Calories, one Macro, Logging, Fidelity) with a "hit on N days per week" surface and a bodyweight-or-energyBalance outcome. Pass 2.6 collapses them into **two** benchmark types with **daily-implicit** targets, drops `energyBalance` as an outcome (moves it to a prefill-only suggestion engine), simplifies the bodyweight outcome to a target-number-only, and exposes T1 in the capture fidelity picker.

---

## The new Nutrition family (2 benchmark types)

The Nutrition picker shows exactly two options:

### 1. **Nutrition target** — the main one

A daily-target benchmark bundling anything the user wants to hit each day. **At least one target must be set.** Any of these fields is independently optional:

- **Calories** (kcal, `atMost` for cutting or `atLeast` for gaining — direction picker retained here because it flips deficit/surplus).
- **Protein** (g, `atLeast` implied).
- **Carbs** (g, `atLeast` or `atMost` picker).
- **Fat** (g, `atLeast` or `atMost` picker).
- **Fiber** (g, `atLeast` implied). New in-pass.
- **Capture quality** — optional bundled fidelity share ("80% of my daily entries at T2+"), see §T1 exposure below.

Targets are **daily-implicit** — no "on N days per week" field on the form. Every day is a target day. The Reflect surface derives hit-rate over week/month windows for the consistency display; the user just picks the window they want to see (week/month), not the count.

**Paired outcome (optional):** bodyweight target number in the user's weight unit (e.g. 165 lb). **Target is required** when the outcome is attached — direction derives from current weight vs target. No "lose vs gain" toggle here. Users who want to just watch weight without a target create a separate bodyweight-primary benchmark.

**Suggestion engine (prefill-only) on the outcome:** if user fills target weight + a **rate in the user's weight unit per week** (lb/wk or kg/wk), a "Compute suggested calorie floor" action populates the calorie field from `TDEE − (rate_lb × 3500 / 7)` (or equivalent in kg with 7700 kcal/kg). Rate copy suggests the healthy 0.5 %/wk – 1 %/wk band as guidance text next to the field. The rate is a **form field only** — it is not persisted on the benchmark; it seeds the calorie number, then the user edits freely and saves. If body profile isn't set, the button is disabled with a "set body profile first" hint. Recomputing later = user re-opens the form and taps compute again. Live drift is deferred.

### 2. **Log food plainly** — cadence + fidelity only, no targets

For users who don't want numeric targets. Behavior-only, always:

- **Cadence** — "log at least N days per week/month" (this one *does* carry a days-per-window field — that's the whole point of the benchmark).
- **Capture quality** — optional bundled fidelity share.

No paired outcome. Purely about the act of logging. Reuses the existing `loggingConsistency` dimension (unchanged) with an extended `days` measure that carries an optional bundled fidelity share.

---

## What v0.4 preserves (unchanged)

- **Two-faces architecture** (`benchmarks-spec.md` §"The two faces"). Nutrition target still has a behavior face (targets) and optional outcome face (bodyweight). Log-food-plainly is behavior-only. The user still never picks a face.
- **Three-valued day engine** (hit / missed / unknowable). Nutrition target's per-metric daily evaluation still runs through the `nutrition/days.ts` semantics; a new predicate shape handles the multi-metric case.
- **Reflect three-layer hierarchy** (frame / hero / supporting). Nutrition target's hero = paired outcome if attached, else calories hit-rate; macros + fiber + fidelity render as supporting cards.
- **Consistency counters, not streaks.** Every rule from v0.4's counter section carries.
- **Descriptive by default, prescriptive only on request** (Ring 3b amendment). Suggestion engine is user-summoned (they tap Compute); it never auto-updates or auto-suggests.
- **Archived lifecycle** (`benchmarks-spec.md` §"Archiving and lifecycle"). Reused for the migration — see below.

---

## Data model changes (`core/src/benchmark.ts`)

### 1. New `ResolvedDimension` variant

```ts
| { metric: 'nutritionTargets' }
```

The `loggingConsistency` dimension stays exactly as it is — it powers the new log-food-plainly picker option.

### 2. New `BehaviorFace.measure` variant + extension

```ts
// NEW: bundle multiple daily targets into one measure
| { type: 'nutritionDay';
    daily: {
      calories?: { op: 'atMost' | 'atLeast'; kcal: number };
      protein?:  { grams: number };
      carbs?:    { op: 'atMost' | 'atLeast'; grams: number };
      fat?:      { op: 'atMost' | 'atLeast'; grams: number };
      fiber?:    { grams: number };
    };
    fidelity?: { minTier: 'T1' | 'T2' | 'T3'; targetPct: number };
  }

// EXTEND existing days measure: add optional bundled fidelity
| { type: 'days'; target: number; condition: DayCondition;
    fidelity?: { minTier: 'T1' | 'T2' | 'T3'; targetPct: number };
  }

// WIDEN existing share measure
| { type: 'share'; targetPct: number; minTier: 'T1' | 'T2' | 'T3' }
```

### 3. Benchmark status + storage

Add `'archived'` to `Benchmark.status`:

```ts
status: 'active' | 'achieved' | 'abandoned' | 'paused' | 'archived';
```

The migration sets deprecated nutrition benchmarks to `status: 'archived'` and stamps `resolvedAt = migrationTimestamp`. Picker/Today filter to `status: 'active'` as they already do; archived rows survive for the future cross-benchmark story surface.

### 4. Deprecated but retained (archived rows must still parse)

Mark with `@deprecated` JSDoc — keep in the union so historical benchmarks deserialize cleanly:

- `ResolvedDimension`: `'calories'`, `'macro'`, `'loggingFidelity'`, `'energyBalance'`.
- `BehaviorFace.measure`: no removals (all existing types remain valid).
- `DayCondition`: `'calories'` and `'macro'` variants remain (an archived days-predicate benchmark needs them to parse).

### 5. Form-level changes (`src/lib/benchmarkForm.ts`)

- `BenchmarkDimension` reduces from `{activity | bodyweight | calories | macro | logging | fidelity}` to `{activity | bodyweight | nutritionTarget | logFoodPlainly}`.
- Remove `OutcomePairDim` type (it becomes trivially `'bodyweight'`).
- Remove form fields specific to the old shapes: `calorieOp`, `calorieKcal`, `macro`, `macroOp`, `macroGrams`, `fidelityPct` (standalone), `fidelityMinTier` (standalone), `outcomePairDim`, `balanceDirection`, `balanceKcal`.
- Add new form fields: for nutrition-target, a per-metric group (`calKcal`, `calOp`, `proteinG`, `carbsG`, `carbsOp`, `fatG`, `fatOp`, `fiberG`, optional `fidelityPct`, `fidelityMinTier`), plus suggestion-engine seeds (`targetWeight`, `ratePerWeek`); for log-food-plainly, `daysTarget` + optional `fidelityPct`, `fidelityMinTier`.
- Bodyweight outcome on nutrition-target: `target` required, `direction` computed at save from current-weight vs target (using the same weight-trend read the existing status pipeline uses).

---

## Migration (M010 — next unused after M009 `settings`)

**Soft-archive**, preserving history:

- For every benchmark whose behavior dimension is `calories`, `macro`, `loggingConsistency`, or `loggingFidelity`: set `status = 'archived'`, `resolvedAt = migrationTimestamp`. (Note: `loggingConsistency` gets archived even though the dimension survives — reason: its current standalone-benchmark shape is replaced by log-food-plainly's bundled shape. On re-create, the user makes a fresh log-food-plainly benchmark.)
- Same for outcome `energyBalance`: archive the benchmark.
- Leave activity/bodyweight-only benchmarks untouched.
- Picker filters `status = 'active'` as it already does. Nutrition tab loads clean.
- Optional splash on first Nutrition tab load post-migration: "Your nutrition benchmarks were archived — set up new ones with the new form. Old arcs remain accessible for a future 'stories of success' view."

---

## T1 exposure in capture fidelity

`FidelityMinTier` (in `benchmarkForm.ts`) and the inline `share.minTier` in `core/src/benchmark.ts` both widen from `'T2' | 'T3'` to `'T1' | 'T2' | 'T3'`. The picker exposes all three. "% at T1+" is trivially near-100 %, which is fine — the user gets to set that if they want, and Reflect shows the actual number honestly. No moralizing about "you should pick T2+."

---

## Fiber

Data model already carries `fiberG` (`foodLog.ts`, benchmark form label). Pass 2.6 verifies and completes:

- Food entry form: fiber field visible on the manual-entry path.
- USDA + OFF adapters: fiber pulled through where the source has it. If a source lacks fiber, the entry logs with `fiberG: null` (unknowable, not zero) — the day engine treats this correctly per the three-valued semantics.
- Capture-tier awareness: fiber follows the same tier rules as protein/carbs/fat. An entry captured at T3 (weighed) with unknown fiber still logs at T3 for other macros; fiber-hit for that day becomes unknowable, not missed.
- Nutrition-target form: fiber field shows up alongside the other macros; user can leave it blank.

---

## What DOES NOT change in this pass

- Activity/session-count benchmarks (gym, kayak, run — anything on the training side).
- Bodyweight-primary benchmarks (the "watch weight" entry from the picker, unpaired).
- The two-faces architecture, the three-valued day engine, the capture-tier assignment logic, `baselineTdee.ts`, the expenditure card, all of Reflect's rendering pipeline for non-nutrition frames.
- The Today card layout (stays, just receives the new benchmark shapes).
- The dev-log 6 flags (deficit size, bodyfat source, day-grid rhythm, macro-switch reset, early-hit run asymmetry, height-unit persistence) — those are still Dylan's to answer separately.

---

## Deferred to future passes

- **Live-drift suggestion engine.** This pass ships prefill-only. Pass 2.7+ can wire target weight + rate to persist on the benchmark and recompute the suggested floor as TDEE / trend move.
- **Cross-benchmark "story of success" surface** — reads soft-archived benchmarks and renders their historical arcs. Aggregates completed goals across time. This pass lays the archived-status foundation; the surface is a later pass.
- **Multi-outcome per benchmark.** If a single benchmark ever needs to watch multiple outcomes (e.g. bodyweight AND bodyfat %), that's a broader `OutcomeFace` change, lands post-training-spec.
- **Training-side benchmark redesign.** Waits on the training spec — gym (cadence + key-lift PRs + split binding), calisthenics (skill progression + cadence), run (cadence + pace + distance).
- **Uncommitted settings work** on the branch (`app/settings.tsx`, `src/settings/*`) — untouched this pass; Dylan sorts separately.

---

## Files touched

**Data model + core**
- `core/src/benchmark.ts` — add `'nutritionTargets'` to `ResolvedDimension`; add `'nutritionDay'` measure variant; extend `'days'` measure with optional `fidelity`; widen `share.minTier`; add `'archived'` to `Benchmark.status`; `@deprecated` markers on legacy dimensions.
- `src/storage/serialize.ts` — parse/emit new variants; keep parsing legacy dimensions for archived rows.
- Migration `M010` — soft-archive deprecated nutrition benchmarks.

**Form + entry**
- `src/lib/benchmarkForm.ts` — dimension reduction, new fields, rewritten `defaultTitle`/`buildBenchmarkFields`/`formFromBenchmark`/`validateBenchmarkForm`/`summarizeBenchmark`.
- `src/lib/benchmarkSuggest.ts` — add `suggestCalorieFloor({ tdee, currentKg, targetKg, ratePerWeek, weightUnit })`.
- `app/edit-benchmark.tsx` — new picker (2 nutrition options), new nutrition-target form with bundled fields + Compute button + T1 in fidelity picker; remove `energyBalance` picker + conditional render; simplify bodyweight-outcome UI on the nutrition path.

**Status + Reflect**
- `src/lib/benchmarkStatus.ts` — evaluate `nutritionTargets` (per-metric daily hit + overall daily hit + optional fidelity share) and the extended `days` measure with fidelity; drop `energyBalance` outcome branch (still leave code path for parsing archived rows if needed, but the branch never runs on active).
- `src/lib/benchmarkReflect.ts` — hero = outcome if present, else calories hit-rate; supporting cards for each set macro + fidelity.
- `app/(tabs)/reflect.tsx` — remove `balanceIsHero` branch; wire new supporting-card structure.
- `src/hooks/useBenchmarkStatuses.ts` — update for new shapes.

**Food surface (fiber)**
- Food entry form(s) — fiber input visible on manual entry.
- USDA + OFF adapters — verify fiber mapping; extend if missing.

**Tests**
- Rewrite `src/lib/__tests__/benchmarkFormNutrition.test.ts` for new shapes.
- Rewrite `src/lib/__tests__/benchmarkStatusNutrition.test.ts` for `nutritionTargets` and the extended `days`-with-fidelity measure.
- Extend/new: `src/lib/__tests__/benchmarkSuggest.test.ts` for prefill formula.
- New migration test for M010 soft-archive.

---

## Sim-verify + merge sequence

1. Land all changes on the `benchmarks` branch (single-concern commits — data model, then form, then status, then Reflect, then Reflect UI, then tests; individually reviewable).
2. Regenerate seed data using new shapes (extend `devSeed.ts`).
3. Headless sim: seed a nutrition-target benchmark (cal + protein + fiber + T2 fidelity share + bodyweight-target outcome), seed a log-food-plainly benchmark, deep-link into Today / Reflect / edit, screenshot each.
4. Human tap owed: suggestion-engine Compute flow (only new interactive path Dylan hasn't confirmed by tap).
5. Run 391+ jest, tsc 0, export clean.
6. If green: merge `benchmarks` → `main`, push, delete branch.

---

## Implementation task order

1. **Data model** — `core/src/benchmark.ts`, `src/storage/serialize.ts`.
2. **Migration M010** — soft-archive deprecated nutrition benchmarks + test.
3. **Suggestion helper** — `benchmarkSuggest.ts::suggestCalorieFloor` + unit tests (pure function, land early).
4. **Form rewrite** — `benchmarkForm.ts` new shape end-to-end + test rewrite.
5. **Edit-benchmark UI** — new picker + new nutrition-target form + T1 exposure + Compute button.
6. **Status computation** — `benchmarkStatus.ts` for new faces.
7. **Reflect** — `benchmarkReflect.ts` + `reflect.tsx` for new hero/supporting structure.
8. **Fiber verification** — food entry form + adapter check + integration test.
9. **Sim seed + verify** — devSeed + headless run.
10. **tsc + jest + export + merge**.
