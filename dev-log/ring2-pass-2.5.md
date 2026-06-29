# Ring 2 — Pass 2.5 — Logging UI: weighed + described, save-as-template, fidelity tiers

**Goal:** The two input methods the free data layer fully supports — `weighed`
(search → enter mass) and `described` (type "8 oz ribeye" → parse → DB match) —
plus save-as-template + re-log, with fidelity shown as a visual treatment (never
a number) and a display-only nutrition focus. No barcode (2.7), no photo.
(planning/ring2-food-logging-plan.md § Pass 2.5)

## What shipped

- **`src/lib/foodLog.ts`** (new, pure — the centerpiece, mirrors session.ts):
  - `parseDescribed("8 oz ribeye")` → `{foodText, quantity, unit, grams}`;
    `describedExtraction` → the `{food, quantity, unit}` flags fidelity keys off;
    `describedQuantityG` (parsed mass, or a 100 g nominal portion).
  - `rollupMacros` — meal macros = sum of items, but **null if ANY item is
    missing that macro** (honest unknown beats a silent undercount); never inferred.
  - `validateFoodLog` — a partial meal is VALID; the only block is "no food" (no
    completeness gate, no nag).
  - `buildMealLog` — resolved items → a tier-1 foodEntry Observation: rollup
    macros, `blendComposite` fidelity, method-bound ceiling, foodapi provenance,
    optional `templateId` (re-log recurrence). `mealTemplateFrom` for save-a-meal.
  - `heroNumber(payload, focus)` — display-only macro selector (reads the same
    stored row; no `focus` field exists to gate capture).
  - `fidelityTreatment(fidelity)` → `{tier, opacity, stroke, dot}` brand-kit
    treatment; the 0..1 value never escapes as a number.
- **`src/components/FidelityTreatment.tsx`** (new) — the signature dot marker
  (filled → hollow ring → dotted ring, at the tier opacity).
- **`src/components/FidelityIndicator.tsx`** — `fidelityLevel` now consumes
  core's `tierOf` instead of its own 0.8/0.4 constants (**resolves quirk 12**).
- **`src/hooks/useFoodLog.ts`** (new) — thin orchestration: debounced search,
  resolve weighed/described via the 2.3 service, accumulate a meal, log / save /
  load-saved-meal (re-log stamps templateId). All decisions live in the pure libs.
- **`app/log-food.tsx`** (new) — the modal route from Today; **`src/lib/config.ts`**
  wires a free USDA key from `app.json` extra (DEMO_KEY fallback — **quirk 16
  mechanism done**); `useSettings` gains display-only `nutritionFocus`; route
  registered in `_layout`, launched by a "Log food" button on Today.
- **Adapter refinement:** `AdaptOptions` gained an optional `extraction` override
  so a `described` log's fidelity keys off the *parse* (food/qty/unit), not the
  source DB. Backward-compatible — weighed/barcode and the 2.2 tests are unchanged.

## Tests & verification

- `src/lib/__tests__/foodLog.test.ts` (new) — **12 tests**, the plan's Proof at
  the logic layer (the repo has no RN render-test harness — same pure-builder
  convention as Pass 4): "8 oz ribeye" → MID, "steak" → LOW; weighed meal → HIGH,
  vague described → LOW; focus switches the hero but the stored payload is byte-for-
  byte unchanged and has no `focus` field; `fidelityTreatment` is visual-only with
  the raw value never leaking; a protein-only log validates (no nag), stores null
  kcal/carbs/fat (`not.toBe(0)`), reads partial; templateId stamped only on re-log;
  template has no earnedFidelity.
- `npm test` → **14 suites / 97 tests green**. `npx tsc --noEmit` → **exit 0**
  (caught two errors jest's type-stripping hid — fixed before commit).
- **The screen/hook are verified by tsc + jest + 1:1 pattern-match to the working
  log-session/log-weigh-in screens, NOT a simulator launch** (no RN render driver
  in this session). Recommend a sim smoke-test (port 8083) before relying on it;
  adding `@testing-library/react-native` would let true render tests assert the
  "no number in the tree" bullet directly.

## Self-check against the plan

- Search/weigh + log ✅; described parse ✅; save + re-log (templateId) ✅; solid
  looks solid / rough looks rough with no fidelity number ✅.
- Full macros always, focus display-only (no `focus` field) ✅; null ≠ 0 ✅;
  three tiers never a number ✅; partial renders valid, no nag/CTA ✅.
- Shippable surface = weighed + described only; no barcode, no photo ✅.
- Earned fidelity never written by the logging layer ✅; data layer free-only ✅.
- Core record (observation.ts) untouched; the only core edit is the additive,
  backward-compatible `AdaptOptions.extraction` on the Ring-2 adapter.

## Deferred / handed forward

- Count-units in `parseDescribed` ("2 eggs") aren't converted to grams — quirk 18.
- Saved meals show generic labels (no name on MealTemplate/FoodItem) — quirk 19.
- A real USDA key still needs dropping into `app.json` `extra.usdaApiKey`
  (mechanism is wired; DEMO_KEY until then) — quirk 16.
- True RN render tests (and thus a direct "no numeric fidelity in the tree"
  assertion) await a testing-library dependency — noted above.
