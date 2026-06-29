# Ring 2 — Follow-up — Live macro preview while typing the amount

**Goal (Dylan's ask):** "seeing macros of the food I'm adding live as I type 15 g …
oh I have room, so I add 20." Show a food's macros for the typed portion *before*
committing, so you can tune the amount to your remaining macro space.

## What shipped

- **`src/lib/foodLog.ts`** — `scaleMacros(basis, grams)` (new, pure): scales a fetched
  basis item (its macros at `basis.quantity` g) to the typed grams; null-preserving
  (an unknown macro stays unknown).
- **`src/hooks/useFoodLog.ts`** — `selectFood(candidate)` pre-fetches the food at 100 g
  (cache-first, so cheap) into `selectedBasis` when you pick a search result.
- **`app/log-food.tsx`** — under the amount field, a live `itemMacroSummary(scaleMacros(
  basis, grams))` line updates as you type. Shows in the data font.

The preview matches the committed value at display precision; the actual logged item
is still re-derived exactly from per-gram on Add (the adapter path), so the preview is
never authoritative — just a live guide.

## Proof

- `src/lib/__tests__/foodLog.test.ts` — `scaleMacros` scales a per-100g basis to the
  grams and preserves a null macro.
- Suite: **17 suites / 125 jest green** (was 123). **tsc 0.**

## Notes

- This is logger-level and survives the planned move to a Nutrition tab.
- Only weigh mode (USDA search) for now — barcode (2.7) is still gated.
