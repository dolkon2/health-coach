/**
 * foodSearch.ts — the network client the pure Pass 2.2 adapters sit behind.
 *
 * USDA FoodData Central is the search backbone (free key, 1000 req/hr — far
 * above single-user load); Open Food Facts is the barcode layer (no auth). All
 * I/O lives here, app-side; the normalization stays in `core/src/nutrition/*`.
 *
 * Network + cache are injectable (`fetchImpl`, `db`) so this is tested against a
 * mocked fetch and an in-memory SQLite — no live calls in CI. A lookup checks
 * the local cache first; a miss fetches, caches the raw response, then adapts.
 * A not-found barcode returns a typed `null`, never a fabricated item.
 */
import type { FoodItem, FoodSourceDb } from '@core/observation';
import { adaptUsdaFood, type UsdaFoodResponse } from '@core/nutrition/usda';
import { adaptOpenFoodFactsProduct, type OffProductResponse } from '@core/nutrition/openfoodfacts';
import type { AdaptOptions } from '@core/nutrition/adapter';
import type { SqlDatabase } from '@/storage/db';
import { getCachedFood, putCachedFood, touchCachedFood } from '@/storage/foodCache';

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const OFF_BASE = 'https://world.openfoodfacts.org/api/v2';

/** A search result the user can pick before a full fetch-by-id resolves it. */
export interface FoodCandidate {
  sourceDb: FoodSourceDb;
  foodId: string;
  description: string;
  brand?: string;
  dataType?: string; // USDA 'Branded' | 'Foundation' | 'SR Legacy' | …
}

export interface FoodSearchDeps {
  fetchImpl?: typeof fetch;
  /** Free USDA key; defaults to the public low-rate DEMO_KEY. The app overrides. */
  usdaApiKey?: string;
  db?: SqlDatabase;
}

function resolveDeps(d?: FoodSearchDeps) {
  return {
    fetchImpl: d?.fetchImpl ?? fetch,
    usdaApiKey: d?.usdaApiKey ?? 'DEMO_KEY',
    db: d?.db,
  };
}

interface UsdaSearchFood {
  fdcId: number;
  description?: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
}

/**
 * USDA `dataType` → ordering rank (lower = shown first). Foundation and SR Legacy
 * are lab-measured generic foods — the clean, canonical entries a text search
 * usually wants; Survey (FNDDS) is generic but modeled; Branded is label/crowd
 * data, noisy and typo-prone, so it sorts last. Unknown types fall after all known
 * ones. This is the data-quality call the spec says we own (handoff §3).
 */
export function usdaDataTypeRank(dataType?: string): number {
  switch (dataType) {
    case 'Foundation':
      return 0;
    case 'SR Legacy':
      return 1;
    case 'Survey (FNDDS)':
      return 2;
    case 'Branded':
      return 3;
    default:
      return 4;
  }
}

/**
 * Search USDA for foods matching a free-text query → ranked candidates (USDA
 * relevance order). OFF is barcode-only, so it is not part of text search.
 */
export async function searchFoods(query: string, deps?: FoodSearchDeps): Promise<FoodCandidate[]> {
  const { fetchImpl, usdaApiKey } = resolveDeps(deps);
  const q = query.trim();
  if (!q) return [];
  const url = `${USDA_BASE}/foods/search?query=${encodeURIComponent(q)}&pageSize=25&api_key=${usdaApiKey}`;
  const res = await fetchImpl(url);
  if (!res.ok) return [];
  const body = (await res.json()) as { foods?: UsdaSearchFood[] };
  const candidates: FoodCandidate[] = (body.foods ?? []).map((f) => ({
    sourceDb: 'usda' as const,
    foodId: String(f.fdcId),
    description: f.description ?? '',
    brand: f.brandOwner ?? f.brandName ?? undefined,
    dataType: f.dataType,
  }));
  // We own ordering: float clean lab-measured generics (Foundation/SR Legacy) above
  // noisy Branded label data, preserving USDA's relevance order within each tier
  // (Array.sort is stable). "cheddar" surfaces "Cheese, cheddar", not a typo'd pack;
  // a branded-only query (a product name) is unaffected — all one tier.
  return candidates.sort((a, b) => usdaDataTypeRank(a.dataType) - usdaDataTypeRank(b.dataType));
}

/** Fetch a USDA food by fdcId and adapt it to the logged quantity. Cache-first. */
export async function getUsdaFood(
  fdcId: string | number,
  opts: AdaptOptions,
  deps?: FoodSearchDeps
): Promise<FoodItem | null> {
  const { fetchImpl, usdaApiKey, db } = resolveDeps(deps);
  const foodId = String(fdcId);

  const cached = await getCachedFood('usda', foodId, db);
  if (cached) {
    await touchCachedFood('usda', foodId, db);
    return adaptUsdaFood(cached.raw as UsdaFoodResponse, opts);
  }

  const res = await fetchImpl(`${USDA_BASE}/food/${foodId}?api_key=${usdaApiKey}`);
  if (!res.ok) return null;
  const raw = (await res.json()) as UsdaFoodResponse;
  await putCachedFood({ sourceDb: 'usda', foodId, description: raw.description ?? '', raw }, db);
  return adaptUsdaFood(raw, opts);
}

/** Fetch an OFF product by barcode and adapt it. Cache-first; honest null miss. */
export async function getFoodByBarcode(
  barcode: string,
  opts: AdaptOptions,
  deps?: FoodSearchDeps
): Promise<FoodItem | null> {
  const { fetchImpl, db } = resolveDeps(deps);

  const cached = await getCachedFood('openfoodfacts', barcode, db);
  if (cached) {
    await touchCachedFood('openfoodfacts', barcode, db);
    return adaptOpenFoodFactsProduct(cached.raw as OffProductResponse, opts);
  }

  const res = await fetchImpl(`${OFF_BASE}/product/${encodeURIComponent(barcode)}.json`);
  if (!res.ok) return null;
  const body = (await res.json()) as OffProductResponse & { status?: number };
  // OFF signals "not found" with status 0 / a missing product — a typed miss,
  // never a fabricated item (constitution: never invent a number).
  if (body.status === 0 || !body.product) return null;
  await putCachedFood(
    { sourceDb: 'openfoodfacts', foodId: barcode, description: body.product.product_name ?? '', raw: body },
    db
  );
  return adaptOpenFoodFactsProduct(body, opts);
}

/**
 * Trailing debounce: a burst of calls collapses into one firing `delayMs` after
 * the last — so typing in the search box doesn't fire a request per keystroke.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
}

/**
 * A debounced search bound to a results callback. Only the latest query's
 * results are delivered (earlier in-flight queries are discarded), so fast
 * typing can't deliver stale candidates out of order.
 */
export function createDebouncedSearch(
  onResults: (candidates: FoodCandidate[], query: string) => void,
  deps?: FoodSearchDeps,
  delayMs = 300
): (query: string) => void {
  let latest = 0;
  return debounce((query: string) => {
    const seq = ++latest;
    void searchFoods(query, deps).then((candidates) => {
      if (seq === latest) onResults(candidates, query);
    });
  }, delayMs);
}
