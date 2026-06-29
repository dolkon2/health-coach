# Recents-aware search — handoff, 2026-06-29

Commit 2 on the `logger-redesign` branch. Commit 1 (`5494548`) landed the
saved meals row, sticky CTA, nav safety, and delete-template affordance.

## The problem

When you search for a food in the logger, you only see USDA results. If you
log chicken breast every day, you still have to scroll through USDA hits,
pick the right one, and re-enter your usual gram amount every time. The
logger has no memory of what you've eaten before.

## What to build

When the user types in the "Search a food" field, **recently-logged
ingredients should appear above the USDA results**, with the quantity they
were last logged at. Tapping a recent re-adds it at that quantity in one
tap (no amount field needed — the quantity is pre-filled from history).

Concretely:
1. Query past `foodEntry` observations for `FoodItem`s whose `description`
   matches the search term (case-insensitive substring).
2. Deduplicate by `foodId` — keep only the most-recent occurrence of each.
3. Show them above the USDA candidates in the search results list, visually
   distinct (e.g. "Recent" label, last-logged quantity shown on the card).
4. Tapping a recent item adds it to the meal at its last-logged quantity —
   same as `addWeighed` but with the quantity pre-filled.

## Key files

- **`app/log-food.tsx`** — the logger UI. Search results render as
  `fl.candidates.map(...)` inside the `mode === 'weigh'` branch. Recents
  should render in a separate section above that list.
- **`src/hooks/useFoodLog.ts`** — orchestrates the flow. Holds `query`
  state and runs `searchFoods` via `createDebouncedSearch`. This is where
  the recents query should be wired (alongside the USDA search, not
  instead of it). Exposes `addWeighed` for adding a candidate at a gram
  amount.
- **`src/lib/foodSearch.ts`** — `searchFoods()` calls the USDA API.
  `FoodCandidate` is the shape for search results. Recents are NOT
  `FoodCandidate`s — they're full `FoodItem`s (already resolved, already
  have macros and quantity).
- **`src/storage/observations.ts`** — `listObservations(kind)` returns all
  observations of a kind. The `payload` column is JSON containing `items:
  FoodItem[]`. You'll need a new query function here (or in a new file)
  that extracts distinct food items from past `foodEntry` payloads matching
  a search term.
- **`core/src/observation.ts`** — `FoodItem` interface (line 94). Has
  `sourceDb`, `foodId`, `description`, `quantity`, `quantityMethod`, and
  all the macro fields. This is what a "recent" is — a full resolved item
  from a past meal.

## Data shape

Each `foodEntry` observation's payload has:
```ts
{
  items: FoodItem[];        // the foods in the meal
  description: string;      // meal name
  inputMethod: InputMethod; // 'weighed' | 'described'
  templateId?: string;      // if re-logged from a saved meal
}
```

A SQL query like this would extract recent items:
```sql
SELECT payload, occurredAt
  FROM observations
 WHERE kind = 'foodEntry'
 ORDER BY occurredAt DESC
 LIMIT 100;
```
Then in JS: parse each payload, flatMap the `items`, filter by description
match, deduplicate by `foodId` keeping the most recent.

A pure-SQL approach with `json_each` is also possible but harder to test.
The JS approach is simpler and the dataset is small (a person logs maybe
3–5 meals/day).

## Design constraints

- **Recents are FoodItems, not FoodCandidates.** They already have macros
  and a resolved quantity. Don't re-fetch from USDA — just re-add the
  stored item directly.
- **Dedup by foodId.** If you logged cheddar cheese three times this week,
  show it once with the most recent quantity.
- **Show quantity on the card.** "Cheddar cheese · 30 g" — so the user
  knows what they're re-adding.
- **One-tap add.** Tapping a recent adds it immediately at the stored
  quantity. No amount field, no extra step.
- **Don't break USDA search.** Recents appear above USDA results, not
  instead of them. The USDA search still runs normally.
- **Empty query = no recents.** Only show recents when the user has typed
  something. Don't dump a list of everything they've ever eaten.

## Honesty rules (carry forward)

- `null ≠ 0` — a re-added item keeps its original macros, nulls and all.
- Fidelity carries from the original item unchanged.
- No "most logged" ranking or streak-adjacent gamification.

## Worktree + branch

- Worktree: `~/Projects/health-coach-nutrition`
- Branch: `logger-redesign` (already checked out, HEAD = `5494548`)
- Expo: `npx expo start -c --port 8083`, press `i` for sim
- **No parallel CC sessions on this folder.**

## State

- jest 162/162, tsc 0 on this branch.
- Three unstaged files from the USDA bacon session live in the worktree
  (`src/lib/foodSearch.ts`, its test, and a fixture). Don't stage or
  commit those — they belong to a different branch.

## Discipline

- Single-concern commit: `feat(nutrition): recents-aware search results`
- `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- Test the recents query logic with unit tests.
- Sim-verify: search for something you've logged before → it shows above
  USDA results with the last quantity → tap → it adds to the meal.
- tsc LAST, after test files are written.

## Authority chain

1. `planning/food-logging-spec.md` — honesty rules, data model
2. `planning/nutrition-tab-plan.md` — tab roadmap
3. `dev-log/logger-redesign-handoff.md` — original three-problem handoff
4. `CLAUDE.md` — constitution
