# Ring 2 — Pass 2.3 — Food lookup service + cache

**Goal:** The network client the pure 2.2 adapters sit behind — USDA search +
fetch-by-id, OFF fetch-by-barcode, free-key handling, debounced search, and a
local cached-foods table for fast re-logging + offline. App-side I/O; the
normalization stays in core. (planning/ring2-food-logging-plan.md § Pass 2.3)

## What shipped

- **`src/storage/migrations/002_cached_foods.ts`** (new) + registered in the
  migration registry. `cached_foods` keyed by `(sourceDb, foodId)` — the same
  pair that becomes `ObservationSource.foodapi` — storing the original `raw`
  response (re-hydratable through the 2.2 adapter at any quantity) + `lastUsedAt`.
- **`src/storage/foodCache.ts`** (new) — typed access: `getCachedFood`,
  `putCachedFood` (UPSERT, stamps used-now), `touchCachedFood` (bump on hit),
  `listRecentFoods` (recency-ranked). Modeled on `benchmarks.ts`; injectable `db`.
- **`src/lib/foodSearch.ts`** (new) — the lookup service, fully injectable
  (`fetchImpl`, `usdaApiKey`, `db`) so it's tested with a mocked fetch + in-memory
  SQLite:
  - `searchFoods(query)` → ranked `FoodCandidate[]` from USDA (the search
    backbone; OFF is barcode-only). Blank query short-circuits, no network.
  - `getUsdaFood(fdcId, opts)` / `getFoodByBarcode(barcode, opts)` — **cache-first**:
    a hit re-hydrates through the adapter (no fetch); a miss fetches, caches the
    raw, then adapts. A not-found barcode (OFF `status: 0`) / HTTP error returns a
    typed `null`, never a fabricated item.
  - `debounce()` + `createDebouncedSearch()` — trailing debounce so typing
    doesn't fire a request per keystroke; only the latest query's results land.
- **Barrels:** `core/src/index.ts` now re-exports the 2.2 adapters (the deferred
  wiring noted in 2.2 — the app needs them now); `src/storage/index.ts` exports
  the cache.
- **Fixture** `usda-search-cheddar.json` — a real captured USDA search response.

## Tests & verification

- `src/lib/__tests__/foodSearch.test.ts` (new) — **7 tests**, the plan's Proof:
  search → candidates (mapped fdcId/description/brand); blank query no-network;
  repeat fetch-by-id hits cache → fetch called once + adapter hydrates (kcal 403);
  HTTP error → null; barcode resolves via OFF adapter + caches (kcal 385); OFF
  `status: 0` → typed null; debounce coalesces a burst to one trailing call.
  Mocked fetch + real in-memory SQLite (migrations 001+002 applied) — no live calls.
- `npm test` → **12 suites / 80 tests green**. `npx tsc --noEmit` → **exit 0**.

## Self-check against the plan

- Query → ranked candidates ✅; barcode → product or honest miss ✅; results
  hydrate through the 2.2 adapters ✅; repeated lookups hit the cache ✅.
- Mocked-fetch tested, no live CI calls ✅; 404/empty → typed not-found, not
  fabricated ✅. Data layer USDA + OFF, free only ✅.
- No Ring 1 core record edits — only the barrel re-exports the existing 2.2
  modules ✅.

## Deferred / handed forward

- **Real USDA key.** Defaults to public `DEMO_KEY` (30 req/hr/IP). `foodSearch`
  already accepts `usdaApiKey`; the app wires a registered free key (1000/hr)
  from config in 2.5 — quirk 16.
- **No cache eviction.** `cached_foods` grows unbounded (raw blobs) — fine for
  single-user, quirk 15.
- **`resolveCandidate` dispatch** (candidate → FoodItem by `sourceDb`) is left to
  the 2.5 UI, which knows the chosen candidate and the entered quantity.
- OFF text search is intentionally absent (OFF = barcode layer); USDA is the
  search backbone.
