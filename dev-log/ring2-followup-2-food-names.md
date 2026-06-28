# Ring 2 — Follow-up 2 — Food names on items (resolves quirk 19)

**Goal (handoff §2):** The logger preview listed items as "50 g · usda" with no
name, and saved meals showed "N items · saved YYYY-MM-DD" — unreadable. Add a name
to the food layer so items and saved meals say what they are. A small, flagged core
touch (the schema is the product's contract).

## What shipped

- **`core/src/observation.ts`** (FLAGGED core touch — additive, display-only):
  - `FoodItem.description?: string` — the food's human name, from the source record.
  - `MealTemplate.name?: string` — a readable label for a saved meal.
  - Both optional, both display-only — they gate, weight, and contradict nothing
    (the honesty invariants — tier, fidelity, macros — are untouched).

- **`core/src/nutrition/adapter.ts`** — `buildFoodItem` takes an optional `name` and
  sets `item.description`, omitting it when blank (the same omit-when-absent rule the
  optional macros use — never an empty string).

- **`core/src/nutrition/usda.ts` / `openfoodfacts.ts`** — pass the source name
  (`raw.description` / `raw.product?.product_name`) into `buildFoodItem`. The name
  rides through the one funnel, so both sources emit it the same way.

- **`src/lib/foodLog.ts`**:
  - `mealItemsLabel(items)` — a readable label from the items' unique names
    ("Cheddar cheese, Crackers"), or '' when none carry one.
  - `mealTemplateFrom` now sets `name` from the meal's description, falling back to
    `mealItemsLabel`, omitted only when nothing named the meal.

- **`src/storage/migrations/004_meal_template_name.ts`** (new) + registry — a nullable
  `name` column on `meal_templates` (additive `ALTER TABLE ADD COLUMN`; existing rows
  get NULL and fall back to item names). `mealTemplates.ts` persists + reads it,
  omitting `name` on the way out when the row has none.

- **`app/log-food.tsx`** — the preview item rows now read "Cheddar cheese · 50 g"
  (name first; the `usda` source tag, which meant nothing to a user, is gone). The
  saved-meals picker leads with the meal name (`t.name || mealItemsLabel(items)`) and
  drops the count + date to a secondary line; an unnamed legacy meal still reads
  "N items".

## Why the migration (the catch)

`meal_templates` is column-based, not a JSON blob — so a `name` set only on the type
would be **silently dropped on save**. Rather than ship that broken middle, added
migration 004 to persist it. `FoodItem.description` needs no migration: it rides
inside the `canonicalItems` JSON. (Both paths were anticipated by quirk 19's
remediation: "core type + meal_templates migration and/or a description on FoodItem".)

## Proof

- `core/__tests__/nutritionAdapters.test.ts` — each adapter populates `description`
  from its real fixture (USDA Branded "PEANUT BUTTER", SR Legacy cheddar, OFF
  product_name).
- `src/lib/__tests__/foodLog.test.ts` — `mealItemsLabel` joins/dedupes/skips-unnamed;
  `mealTemplateFrom` names from ctx, else items, else omits.
- `src/storage/__tests__/mealTemplates.test.ts` — a named template **round-trips
  through SQLite** with its name; an unnamed one stays nameless; the column list now
  includes `name` (and still no fidelity column).
- Suite: **17 suites / 118 jest green** (was 110). **tsc 0.**

## NOT done / flagged

- Today's per-meal rows still show the *meal* description (already worked); they don't
  yet show the joined item names for multi-food meals — out of scope here.
- Search ranking (handoff §3) is next: the noisy-USDA-results problem is separate
  from naming.
- Not yet re-run on the iOS sim; verified at logic (jest) + types (tsc).
