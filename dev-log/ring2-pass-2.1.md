# Ring 2 — Pass 2.1 — Core nutrition schema + fidelity module

**Goal:** Land the Ring 2 types on the core record and the pure fidelity math —
no network, no SQLite, no UI. This is the only pass that touches the stable Ring 1
record type, so it goes first and stays isolated.
(planning/ring2-food-logging-plan.md § Pass 2.1)

## What shipped

- **`core/src/observation.ts` — the food contract, extended.**
  - New food types: `FoodSourceDb` (`'usda' | 'openfoodfacts'` — `'fatsecret'`
    reserved, added only when adopted), `InputMethod`
    (`weighed | barcode | photo | described`), `QuantityMethod`
    (`measured | package | estimated`), `FoodItem`, and `MealTemplate`.
  - `FoodEntryPayload` extended: `items: FoodItem[]`, `inputMethod`,
    `fidelityCeiling`, optional `templateId`. The flat macros `kcal/proteinG/
    carbsG/fatG` are now `number | null` (null = not captured, never 0, never
    inferred); `fiberG?/alcoholG?` stay optional. The flat macros are documented
    as the **rollup of `items`**, always written when known — there is
    deliberately **no `focus` field** (focus is display-only).
  - `isPartial(meal)` helper added next to `isKind`: a meal is partial precisely
    when any required macro is `null`. Structural, no stored `is_partial` flag.
    (Behavior tests land in 2.4/2.6 per the plan; the helper exists now.)
  - **`'nutritionix'` removed** from `ObservationSource.foodapi.provider`, which
    now references the shared `FoodSourceDb` so the provider union and
    `FoodItem.sourceDb` can never drift (plan § 3 "keep the two spellings in sync").
- **`core/src/nutrition/fidelity.ts` (new) — the pure fidelity math.** No I/O.
  - `tierOf(fidelity)` + `TIER_HIGH_MIN = 0.8` / `TIER_MID_MIN = 0.4`: the **only**
    fidelity numbers in the system, centralized here, in code, never on screen.
    HIGH ≥ 0.8, MID 0.4–0.8, LOW < 0.4 (lower edges closed).
  - `fidelityCeiling(method)`: `weighed 0.98 · barcode 0.85 · described 0.70 ·
    photo 0.55` — tunable, documented.
  - `defaultFidelity(method, extraction)`: starting fidelity from **what was
    extracted, never the channel** (no device/screen parameter exists). Weighed
    ~0.90–0.95, barcode 0.55→0.80 by completeness, described food+qty+unit 0.60 /
    food-only 0.30 / no-food 0.15, photo 0.35. Always clamped to the ceiling.
  - `blendComposite(items)`: equal-weighted mean of per-item fidelities, each
    clamped to its own ceiling first — guarantees the blend sits between its parts
    and never exceeds the highest per-item ceiling. Empty meal → honest 0.
- **`core/src/index.ts`** — barrel now re-exports `./nutrition/fidelity`.

## Tests & verification

- `core/__tests__/fidelity.test.ts` (new) — **9 tests**, the plan's Proof bullets:
  weighed → HIGH; "8 oz ribeye" (food+qty+unit) → MID; "steak" (food only) → LOW;
  mixed-method composite blends between its parts and never exceeds the top
  per-item ceiling (incl. a clamp guarantee on pathological input); tier mapping
  at the 0.4 / 0.8 edges. Plus honest-0-for-empty-meal and "default never exceeds
  ceiling for any method" guards.
- `npm test` → **8 suites / 46 tests green** (37 pre-existing + 9 new); no
  regression from the core type change.
- `npx tsc --noEmit` → **exit 0** (run last, after the tests existed, per the
  standing verify-order rule).

## Self-check against the plan

- *Done looks like* — core compiles with the richer payload ✅; fidelity computed
  purely from extraction ✅; tier boundaries centralized in one module ✅.
- Full macros always written regardless of focus; no `focus` field ✅.
- Missing macros = `null`, never `0`/inferred; partiality structural via
  `isPartial()` ✅.
- MealLog = enriched `foodEntry` payload (not a sibling table); `MealTemplate` is
  its own definition with **no** `earnedFidelity` and **no** `occurrences[]` ✅.
- Fidelity 0..1, three tiers, never a number on screen ✅.
- Data layer USDA + OFF, free only; `nutritionix` removed, `fatsecret` reserved ✅.
- Only the plan's flagged Ring 1 core edits touched (FoodEntryPayload extension +
  nutritionix removal); no other `core/` file changed ✅.

## Deferred / handed forward

- `isPartial()` behavior tests → Pass 2.4 (capture) and 2.6 (engine), per plan.
- Adapters populate `FoodItem` macros + per-item `fidelity`/`fidelityCeiling` →
  Pass 2.2 (`defaultFidelity` is wired through there).
- Tier visuals reconciliation: the app's `FidelityIndicator`/`fidelityLevel`
  still duplicates the 0.8/0.4 boundaries (lowercase levels). Make it consume
  core's `tierOf` in Pass 2.5 — see quirk 12.

## Flag for the reviewer

- **Import-extension convention:** the run prompt and CLAUDE.md call for `.js`
  suffixes on relative imports, but **every existing `core/` file uses
  extensionless imports** under `moduleResolution: "bundler"`, and that's what
  the green jest setup resolves. I matched the actual code (extensionless) so the
  module compiles and runs like its neighbours. The doc note is stale relative to
  the build config — logged as quirk 11.
