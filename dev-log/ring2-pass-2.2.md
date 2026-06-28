# Ring 2 — Pass 2.2 — USDA + Open Food Facts adapters

**Goal:** The adaptation logic the spec calls "the thing we own" — pure functions
turning a nested USDA / OFF response into a normalized `FoodItem` (flat macros
scaled to the logged quantity, provenance, default fidelity). No live network;
fixture-tested. (planning/ring2-food-logging-plan.md § Pass 2.2)

## What shipped

- **`core/src/nutrition/usda.ts`** — `adaptUsdaFood(raw, opts)`. Reconciles the
  two USDA unit bases: **Foundation / SR Legacy** flatten `foodNutrients[]` (per
  100 g) by nutrientNumber (208/203/205/204/291/221, id fallback 1008/1003/…);
  **Branded** divide `labelNutrients` by `servingSize` (per serving → per gram).
  Energy is pinned to the kcal row (208/1008), not kJ or Atwater.
- **`core/src/nutrition/openfoodfacts.ts`** — `adaptOpenFoodFactsProduct(raw,
  opts)`. Parses `product.nutriments` `*_100g` keys, derives a **completeness
  signal** (fraction of the four required macros actually present) and routes it
  into fidelity — patchy crowd data is reflected, not hidden. Coerces numeric
  strings; a missing key → `null`, never a fabricated 0.
- **`core/src/nutrition/adapter.ts`** *(shared, see Flags)* — `buildFoodItem`
  scales per-gram macros to the logged grams (preserving `null` ≠ `0`), attaches
  `defaultFidelity(method, extraction)` + `fidelityCeiling(method)` from 2.1, and
  guarantees both adapters emit the **identical `FoodItem` shape**.
- **Fixtures** `core/src/nutrition/__fixtures__/` — REAL captured responses:
  - `usda-sr-legacy-cheddar.json` (fdcId 173414, 138 nutrients of real noise),
  - `usda-branded-peanut-butter.json` (fdcId 2031766, labelNutrients + 30 g serving),
  - `off-complete-thai-sauce.json` (barcode 0737628064502, full macro set),
  - `off-sparse-derived.json` — **derived** from the real OFF capture with
    carbs/fat/fiber keys removed (carries a `_fixture_note`), to exercise the
    completeness→fidelity path with genuinely-absent (not zero) fields.
  - USDA captures used the public `DEMO_KEY`; OFF needs no auth. Both are
    free/CC0 — the runtime app uses a free USDA key (1000 req/hr), no paid tier.

## Tests & verification

- `core/__tests__/nutritionAdapters.test.ts` (new) — **15 assertions** across the
  plan's Proof bullets: Branded label scaled to 30 g and to a non-serving 45 g;
  SR Legacy per-100g flattened from 138 nutrients; OFF complete at the barcode
  default (~0.80); OFF sparse → carbs/fat **null** (not 0) and fidelity strictly
  below the complete record; provenance built into `ObservationSource.foodapi`
  matches per source; both adapters share the same required FoodItem keys.
- **Verified on the new isolated worktree** `ring-2-nutrition` (Expo SDK 53 / TS
  5.8.3 / jest-expo 53) after the toolchain was realigned — the original 2.2 run
  was blocked by a mid-migration `node_modules` (see § History).
- `npm test` → **11 suites / 73 tests green**. `npx tsc --noEmit` → **exit 0**
  (run last, after the test existed).

## Self-check against the plan

- Both adapters emit the identical internal shape ✅ (shared `buildFoodItem` +
  the shape test). Branded and Foundation/SR both normalize despite different
  unit bases ✅. OFF completeness maps onto fidelity ✅.
- Missing macros = `null`, never `0`, never inferred ✅ (`scale()` preserves null;
  sparse OFF asserts null carbs/fat).
- Provenance recorded via the existing `ObservationSource.foodapi` variant
  (`sourceDb`→provider, `foodId`→itemId) — no new source machinery ✅.
- Fidelity from extraction, never channel ✅ (`{branded}` / `{completeness}` →
  `defaultFidelity`). Data layer USDA + OFF, free only ✅.
- No Ring 1 core edits in 2.2 — only `core/src/nutrition/*` + the test ✅.

## Deferred / handed forward

- **Barrel exports deferred to 2.3.** The adapters are not yet re-exported from
  `core/src/index.ts`; the test imports them directly. 2.3 (the food lookup
  service) wires the barrel when the app first needs them.
- **OFF self-consistency** (do the macros sum to the stated energy?) is not part
  of the completeness signal yet — quirk 13.
- **Branded without `servingSize`** yields all-null macros (no per-100g
  fallback) — quirk 14.
- `serving_size` parsing (e.g. "0.333 PACKAGE (52 g)") is a 2.3/2.5 portion-UI
  concern; the pure adapter takes grams.

## Flags for the reviewer

- **One file beyond the plan's listed three.** The plan named `usda.ts` +
  `openfoodfacts.ts`; I added `adapter.ts` to house the shared scale/round/
  fidelity assembly. Rationale: it *enforces* the "both adapters emit the
  identical internal shape" done-criterion in one place rather than by parallel
  duplication. Scope stays inside `core/nutrition/`. Fold it back into the two
  files if you'd rather.
- **The sparse OFF fixture is derived, not raw-captured** (real structure, macro
  keys removed). The logic under test — absent field → null + lower fidelity — is
  identical either way; the fixture is transparently labelled.

## History (why this pass was bumpy)

The first 2.2 run was implemented then **blocked at verification**: a parallel
Expo SDK 56→54 dependency migration left `node_modules` incoherent (jest core at
v30, jest-expo at 56, env/babel at 29 — `clearMocksOnScope` crash; tsc rejected
the stale `ignoreDeprecations: "6.0"`). Both gates were down through no fault of
the pass. Resolved by splitting this work into its own worktree on a realigned,
committed Expo-53 toolchain, where the already-written code verified clean. The
2.2 code itself rode into the baseline via the pre-split checkpoint `d0b19c2`
(a mixed cross-session commit, deliberately not rewritten); this entry + the
quirks are the clean single-concern record of the pass.
