# Ring 2 — Follow-up — Second sim pass fixes (calories + scroll)

From the second live sim pass. The breakdown work (per-item macros, tap-to-expand,
un-clipped hero, named meals) all confirmed working. Two real bugs surfaced; fixed
here as two single-concern commits. Three further items (edit meals, quick single-
macro log, branded delete dialog) are features/polish — triaged with Dylan, not built
here.

## Fixes

1. **USDA energy falls back to Atwater (quirk 22).** `core/src/nutrition/usda.ts` —
   a Foundation food whose record omits the direct Energy nutrient (208/1008) read as
   `null` calories. Confirmed live: fdcId 2727573 "Beef, tenderloin steak, raw" carries
   only 957 (Atwater General, 143.2 kcal) + 958 (Specific, 149). The energy lookup now
   tries 208 → 957 → 958 (first present wins; General preferred). Task-3 ranking floats
   Foundation foods to the top, so this was hitting often, not rarely.

2. **Keyboard-aware scrolling.** `src/components/Screen.tsx` (shared wrapper) — the
   scroll variant had no keyboard handling, so with the keyboard up a long meal pushed
   Log/Save Meal behind it, unreachable. Added `automaticallyAdjustKeyboardInsets`
   (iOS insets the scroll content when the keyboard shows) + `keyboardShouldPersistTaps="handled"`
   (tap a button without a dismiss tap first). Safe, keyboard-only behaviour; benefits
   every scrollable screen.

## Proof

- `core/__tests__/nutritionAdapters.test.ts` — kcal resolves from Atwater General for a
  Foundation food with no 208; direct 208 still wins when both are present.
- Suite: **17 suites / 123 jest green** (was 121). **tsc 0.**
- Scroll fix verified on the sim.

## Triaged, NOT built here (features/polish — need design or are larger)

- **Edit a logged meal** — currently delete-only. The edit pattern already exists for
  weigh-ins/sessions (`editId` route param + `supersedes`); food needs `log-food` to
  accept an editId, hydrate the meal into `useFoodLog`, and save as a superseding
  Observation. Its own build.
- **Log a single macro** (e.g. "42g protein from a shake") with no full macros — the
  data model already supports partial logs (null ≠ 0); this needs a UI affordance.
  Design first.
- **Branded delete dialog** — `SwipeToDelete` uses the native `Alert`, which is off-brand.
  Replace with a themed confirm modal (shared — affects sessions/weigh-ins/food too).

## Minor

- Legacy meals logged before the names work show nameless items in the breakdown
  ("135 g"); new logs carry names. Pre-existing data only.
