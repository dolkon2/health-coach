# Ring 2 — Pass 2.4 — Meal-log + template persistence

**Goal:** Persist meals as enriched `foodEntry` Observations (not a parallel
table), add the `meal_templates` sibling table, and make a template's
occurrences a *query* over the logs carrying its id — never a stored counter.
(planning/ring2-food-logging-plan.md § Pass 2.4)

## What shipped

- **`src/storage/migrations/003_meal_templates.ts`** (new) + registered.
  `meal_templates(id, createdAt, userConfirmed, canonicalItems JSON)` — modeled
  on benchmarks (no `occurredAt`; it's a definition). **No `earned_fidelity`
  column, no `occurrences` column** (plan § 4).
- **`src/storage/mealTemplates.ts`** (new) — `createMealTemplate`,
  `getMealTemplateById`, `listMealTemplates`, and **`occurrencesFor(templateId)`**:
  a query over the (non-superseded) `foodEntry` observations whose
  `payload.templateId` matches, oldest first, each carrying its own `inputMethod`
  → `{observationId, occurredAt, inputMethod}`. Repetition can't inflate anything
  the engine reads, because nothing is stored to inflate.
- **Storage barrel** exports the template API.
- **Meal logs** persist through the *existing* `createObservation` path — a meal
  is a `foodEntry` Observation, not a sibling table.

## serialize.ts — no change needed (and why)

The plan listed extending `serialize.ts`, but it already serializes the **whole**
payload as JSON (`JSON.stringify(o.payload)` / `JSON.parse`). So the richer
`FoodEntryPayload` (items, inputMethod, fidelityCeiling, templateId) **and** the
nullable macros round-trip with zero changes — `null` survives JSON exactly, and
is never coerced to `0`. The round-trip test proves it with an exact `toEqual`.
Adding typed per-field serialization would be dead code; left untouched.

## Tests & verification

- `src/storage/__tests__/mealTemplates.test.ts` (new) — **5 tests** (real
  in-memory SQLite, migrations 001–003 applied), the plan's Proof:
  - a two-item weighed meal (mixed source/ceiling) round-trips **identical**
    (exact `toEqual` on the whole Observation);
  - save a template, log it 3× via 2 methods (+ one un-templated meal) →
    `occurrencesFor` returns exactly the 3, oldest-first, with `weighed/weighed/
    described` tags;
  - `PRAGMA table_info(meal_templates)` → columns are exactly
    `id/createdAt/userConfirmed/canonicalItems`, none containing "fidelity";
  - **(Item 1)** a fully-resolved meal persists all four macros and stores **no
    `focus` field** — focus is display-only, so there is nothing on the row to
    gate capture; `isPartial` false;
  - **(Item 6)** a protein-only `described` log stores `null` kcal/carbs/fat
    (asserted `not.toBe(0)`), `isPartial` true.
- `npm test` → **13 suites / 85 tests green**. `npx tsc --noEmit` → **exit 0**.

## Self-check against the plan

- Meal round-trips with items + method + ceiling intact ✅; template + re-log →
  recoverable occurrence list ✅; no earned_fidelity in the template table ✅.
- MealLog = enriched foodEntry Observation, not a sibling ✅; MealTemplate is its
  own definition table ✅; occurrences are a query, not duplicated rows ✅.
- null ≠ 0, partiality structural via `isPartial` ✅; full macros regardless of
  focus, no `focus` field ✅; earned fidelity never written by the logging layer ✅.
- No Ring 1 core edits; serialize.ts untouched (already sufficient) ✅.

## Deferred / handed forward

- **Meal *assembly*** (FoodItems → rollup macros + `blendComposite` fidelity →
  FoodEntryPayload → Observation, and "save this meal" → MealTemplate) is the
  2.5 UI/builder's job. 2.4 persists fully-formed meals; the tests construct them
  directly.
- `occurrencesFor` scans `foodEntry` rows via `json_extract` (no index on the
  JSON templateId) — quirk 17.
- Earned-fidelity *computation* remains Phase 7; the scaffolding (occurrences as
  a query + per-window confidence from 2.6) is what stands now.
