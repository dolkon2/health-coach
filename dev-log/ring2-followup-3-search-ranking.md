# Ring 2 — Follow-up 3 — Search ranking: clean generics above noisy Branded

**Goal (handoff §3):** USDA text search is noisy — typo'd/junk Branded entries
rank above the clean generic "Cheese, cheddar" (Foundation / SR Legacy). The
connection is fine; this is ordering, which we own in `src/lib/foodSearch.ts`.

## What shipped

- **`src/lib/foodSearch.ts`**:
  - `usdaDataTypeRank(dataType)` (new, pure, exported): Foundation `0` < SR Legacy
    `1` < Survey (FNDDS) `2` < Branded `3` < unknown `4`. Lab-measured generics are
    the canonical entries a text search wants; Branded is label/crowd data, noisy
    and typo-prone, so it sorts last.
  - `searchFoods` now **stable-sorts** the mapped candidates by that rank. Stable
    (ES2019 `Array.sort`) means USDA's relevance order is preserved *within* a tier
    — so a branded-only query (e.g. a product name, where every result is Branded)
    is unaffected, while "cheddar" floats "Cheese, cheddar" to the top.

No request change (same `foods/search` call), no schema touch — purely client-side
re-ranking of the result set.

## Why not the API's own sort

USDA supports `sortBy=dataType`/relevance params, but client-side re-ranking keeps
the full relevant result set and is deterministically testable against a mocked
fetch (no live call in CI). The handoff's primary suggestion — "we own ordering in
foodSearch.ts" — is exactly this.

## Proof

- `src/lib/__tests__/foodSearch.test.ts`:
  - a mixed-dataType response (two Branded, then SR Legacy + Foundation) returns
    `[Foundation, SR Legacy, Branded, Branded]` — clean entries rise, the two
    Branded keep their relative order (stable within-tier);
  - `usdaDataTypeRank` orders the tiers Foundation < SR Legacy < Survey < Branded <
    unknown;
  - the existing all-Branded `usda-search-cheddar` fixture test is unchanged (one
    tier → order preserved), confirming no regression for branded-only queries.
- Suite: **17 suites / 120 jest green** (was 118). **tsc 0.**

## NOT done / flagged

- Relevance is preserved only *within* a tier (USDA returns order, not a numeric
  score), so a weakly-relevant generic could in theory sit above a strongly-relevant
  Branded. USDA's search already filters to relevant matches, so in practice the
  generic surfaced is the one wanted. Revisit if a real query misranks.
- On-device sim test still pending for follow-ups 1–3 (verified at logic + types).
