# Ring 2 — Follow-up — Meal breakdown + first-sim-test fixes

From the first live sim pass (follow-ups 1–3 + swipe-delete all confirmed working on
device). Dylan's feedback drove this round: see each item's macros and how a meal
breaks up; the hero calorie number was clipped; the delete prompt was generic.

## What shipped (landed as 3 single-concern commits)

1. **Logger meal preview — per-item macros + un-clipped total**
   - `src/lib/foodLog.ts`: `itemMacroSummary(item)` (new, pure) — "513 cal · 96 P ·
     0 C · 12 F", "—" for a macro the item didn't capture (null ≠ 0). Shared by both
     surfaces.
   - `app/log-food.tsx`: each preview item now shows its own macro line under the
     name. Hero number clip fixed — `displayLg` is `fontSize 28 / lineHeight 30.8`,
     but the hero overrode `fontSize: 40` without raising the line height, shearing
     the glyph tops ("570"→"57U"). Added `lineHeight: 48`.

2. **Today food cards — tap to expand breakdown + named delete**
   - `app/(tabs)/index.tsx`: a multi-item meal card is tappable; it shows a "N items
     ▾" affordance and expands to the per-item breakdown (name · grams + the macro
     line) under a hairline. Single-item meals stay flat (nothing new to show).
     Swipe-to-delete still works (SwipeToDelete › Pressable, the session pattern).
   - Delete confirmation now names the meal: "Delete <name>?" / "This is permanent."
     (was the generic "Delete food?").

3. **Re-logged saved meals inherit their name**
   - `src/hooks/useFoodLog.ts`: `loadSavedMeal` now sets the description from the
     template's `name`, so a re-log reads as its name instead of the generic "Meal"
     (the cause of the two "Meal" cards Dylan saw). Ties into the Task-2 template name.

## Proof

- `src/lib/__tests__/foodLog.test.ts` — `itemMacroSummary` formats the four macros
  and renders "—" for a missing one (never 0).
- Suite: **17 suites / 121 jest green** (was 120). **tsc 0.**
- UI behaviour (expand interaction, clip fix, delete copy) verified on the sim.

## NOT done / flagged

- Search for the bare word "Cheese" still returns all Branded (USDA's top-25 for that
  query carry no Foundation/SR entry, so there's nothing for the re-rank to float
  up). "cheddar" / specific queries surface the generic. Watch; revisit if a real
  query misranks.
- Editing a logged meal still needs a `log-food` edit path (deferred).
