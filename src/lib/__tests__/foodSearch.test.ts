/**
 * Food lookup service tests (Ring 2 / Pass 2.3). The plan's Proof, run against a
 * MOCKED fetch (no live network in CI) and a real in-memory SQLite cache:
 *   - a query returns ranked candidates;
 *   - a repeat lookup hits the cache and skips the second fetch;
 *   - a not-found barcode returns a typed null, not a fabricated item.
 * Plus a debounce coalescing check (debounced search is part of 2.3's scope).
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { makeTestDb } from '@/storage/__tests__/sqliteTestDb';
import { runMigrations, type SqlDatabase } from '@/storage/db';
import { getCachedFood } from '@/storage/foodCache';
import { searchFoods, getUsdaFood, getFoodByBarcode, debounce, usdaDataTypeRank } from '@/lib/foodSearch';

const FX = join(__dirname, '..', '..', '..', 'core', 'src', 'nutrition', '__fixtures__');
function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

/** A fetch that always returns `body`, counting its calls. */
function jsonFetch(body: unknown, ok = true) {
  return jest.fn(async () => ({ ok, status: ok ? 200 : 404, json: async () => body }));
}
const asFetch = (f: unknown) => f as unknown as typeof fetch;

const WEIGHED_100 = { method: 'weighed', quantityG: 100, quantityMethod: 'measured' } as const;
const BARCODE_100 = { method: 'barcode', quantityG: 100, quantityMethod: 'package' } as const;

let db: SqlDatabase;
beforeEach(async () => {
  db = makeTestDb();
  await runMigrations(db); // applies 001 + 002 (cached_foods)
});

describe('searchFoods', () => {
  it('maps a USDA search response to ranked candidates', async () => {
    const fetchImpl = jsonFetch(load('usda-search-cheddar.json'));
    const out = await searchFoods('cheddar', { fetchImpl: asFetch(fetchImpl), db });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].sourceDb).toBe('usda');
    expect(out[0].foodId).toBe('2057648');
    expect(out[0].description).toBe('CHEDDAR CHEESE');
    expect(out[0].brand).toBe('Grafton Village Cheese Co, LLC');
  });

  it('floats clean generic (Foundation/SR Legacy) above noisy Branded, keeping USDA order within a tier', async () => {
    // USDA relevance puts two branded packs first; the clean lab entries come later.
    const body = {
      foods: [
        { fdcId: 1, dataType: 'Branded', description: 'CHEDDAR CHEESE', brandOwner: 'Brand A' },
        { fdcId: 2, dataType: 'Branded', description: 'Sharp Cheddar', brandOwner: 'Brand B' },
        { fdcId: 3, dataType: 'SR Legacy', description: 'Cheese, cheddar' },
        { fdcId: 4, dataType: 'Foundation', description: 'Cheese, cheddar (Foundation)' },
      ],
    };
    const out = await searchFoods('cheddar', { fetchImpl: asFetch(jsonFetch(body)), db });
    // Foundation (4) then SR Legacy (3) rise to the top; the two Branded keep order.
    expect(out.map((c) => c.foodId)).toEqual(['4', '3', '1', '2']);
  });

  it('returns an empty list for a blank query without touching the network', async () => {
    const fetchImpl = jsonFetch({ foods: [] });
    const out = await searchFoods('   ', { fetchImpl: asFetch(fetchImpl), db });
    expect(out).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('getUsdaFood — cache-first', () => {
  it('fetches once, then a repeat lookup hits the cache and skips the network', async () => {
    const fetchImpl = jsonFetch(load('usda-sr-legacy-cheddar.json'));
    const first = await getUsdaFood('173414', WEIGHED_100, { fetchImpl: asFetch(fetchImpl), db });
    const second = await getUsdaFood('173414', WEIGHED_100, { fetchImpl: asFetch(fetchImpl), db });

    expect(first?.kcal).toBe(403); // hydrated through the 2.2 adapter
    expect(second?.kcal).toBe(403);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // the cache served the second
    expect(await getCachedFood('usda', '173414', db)).not.toBeNull();
  });

  it('returns null on an HTTP error rather than inventing a food', async () => {
    const fetchImpl = jsonFetch({}, false);
    const out = await getUsdaFood('999999', WEIGHED_100, { fetchImpl: asFetch(fetchImpl), db });
    expect(out).toBeNull();
  });
});

describe('getFoodByBarcode', () => {
  it('resolves a known barcode through the OFF adapter and caches it', async () => {
    const fetchImpl = jsonFetch(load('off-complete-thai-sauce.json'));
    const first = await getFoodByBarcode('0737628064502', BARCODE_100, { fetchImpl: asFetch(fetchImpl), db });
    const second = await getFoodByBarcode('0737628064502', BARCODE_100, { fetchImpl: asFetch(fetchImpl), db });

    expect(first?.kcal).toBe(385);
    expect(second?.kcal).toBe(385);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('a not-found barcode (OFF status 0) returns a typed null, not a fabricated item', async () => {
    const fetchImpl = jsonFetch({ status: 0 });
    const out = await getFoodByBarcode('0000000000000', BARCODE_100, { fetchImpl: asFetch(fetchImpl), db });
    expect(out).toBeNull();
  });
});

describe('debounce', () => {
  it('coalesces a burst into a single trailing call with the latest args', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const debounced = debounce(fn as (...a: string[]) => void, 300);
    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
    jest.useRealTimers();
  });
});

describe('usdaDataTypeRank', () => {
  it('orders lab-measured generics ahead of Branded, unknown types last', () => {
    expect(usdaDataTypeRank('Foundation')).toBeLessThan(usdaDataTypeRank('SR Legacy'));
    expect(usdaDataTypeRank('SR Legacy')).toBeLessThan(usdaDataTypeRank('Survey (FNDDS)'));
    expect(usdaDataTypeRank('Survey (FNDDS)')).toBeLessThan(usdaDataTypeRank('Branded'));
    expect(usdaDataTypeRank('Branded')).toBeLessThan(usdaDataTypeRank(undefined));
  });
});
