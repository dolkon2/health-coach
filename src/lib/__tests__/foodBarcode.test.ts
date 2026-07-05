/**
 * foodBarcode resolution tests (Ring 2 / Pass 2.7b). Run against a MOCKED fetch
 * (no live network) and a real in-memory SQLite cache, mirroring foodSearch's
 * pattern. The Proof:
 *   - a complete OFF record resolves to a `barcode` FoodItem at the chosen
 *     portion, HIGH/MID-edge fidelity (~0.80);
 *   - a sparse OFF record (missing macros) routes its completeness into a
 *     LOWER fidelity — provenance reflected, not hidden;
 *   - a not-found code returns a typed miss, never a fabricated item.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { makeTestDb } from '@/storage/__tests__/sqliteTestDb';
import { runMigrations, type SqlDatabase } from '@/storage/db';
import type { OffProductResponse } from '@core/nutrition/openfoodfacts';
import { resolveBarcode, parseServingGrams, parseServingAmount } from '@/lib/foodBarcode';

const FX = join(__dirname, '..', '..', '..', 'core', 'src', 'nutrition', '__fixtures__');
function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(FX, name), 'utf8')) as T;
}

/** A fetch that always returns `body`, counting its calls. */
function jsonFetch(body: unknown, ok = true) {
  return jest.fn(async () => ({ ok, status: ok ? 200 : 404, json: async () => body }));
}
const asFetch = (f: unknown) => f as unknown as typeof fetch;

const PACKAGE_100 = { grams: 100, method: 'package' } as const;
const EYEBALLED_50 = { grams: 50, method: 'estimated' } as const;

let db: SqlDatabase;
beforeEach(async () => {
  db = makeTestDb();
  await runMigrations(db); // applies 001 + 002 (cached_foods)
});

describe('resolveBarcode', () => {
  it('resolves a complete OFF record to a barcode FoodItem at the chosen portion', async () => {
    const fetchImpl = jsonFetch(load('off-complete-thai-sauce.json'));
    const out = await resolveBarcode('0737628064502', PACKAGE_100, { fetchImpl: asFetch(fetchImpl), db });

    expect(out.status).toBe('found');
    if (out.status !== 'found') return;
    expect(out.item.sourceDb).toBe('openfoodfacts');
    expect(out.item.foodId).toBe('0737628064502');
    expect(out.item.quantity).toBe(100);
    expect(out.item.quantityMethod).toBe('package');
    // All four required macros present → completeness 1.0 → 0.55 + 0.25 = 0.80.
    expect(out.item.fidelity).toBeCloseTo(0.8, 5);
    // Macros scale straight from per-100g at a 100 g portion.
    expect(out.item.kcal).toBe(385);
    expect(out.item.proteinG).toBeCloseTo(9.6, 1);
    // Serving amount parsed from the label ("0.333 PACKAGE (52 g)") for the
    // per-serving default; the OFF serving phrasing is dropped from the item.
    expect(out.servingAmount).toBe(52);
    expect(out.item.portionText).toBeUndefined();
  });

  it('re-resolves from cache after the first scan (no second network call)', async () => {
    const fetchImpl = jsonFetch(load('off-complete-thai-sauce.json'));
    const deps = { fetchImpl: asFetch(fetchImpl), db };
    await resolveBarcode('0737628064502', PACKAGE_100, deps);
    const again = await resolveBarcode('0737628064502', EYEBALLED_50, deps);

    expect(fetchImpl).toHaveBeenCalledTimes(1); // cache served the re-resolve
    expect(again.status).toBe('found');
    if (again.status !== 'found') return;
    expect(again.item.quantityMethod).toBe('estimated');
    expect(again.item.quantity).toBe(50);
    // Same record, half the grams → half the calories.
    expect(again.item.kcal).toBeCloseTo(192.5, 1);
  });

  it('routes a sparse OFF record (missing macros) into a lower fidelity', async () => {
    // Start from the complete fixture, strip everything but energy → 1/4 complete.
    const complete = load<OffProductResponse>('off-complete-thai-sauce.json');
    const sparse: OffProductResponse = {
      ...complete,
      product: {
        ...complete.product,
        nutriments: { 'energy-kcal_100g': 385 },
      },
    };
    const out = await resolveBarcode('0737628064502', PACKAGE_100, {
      fetchImpl: asFetch(jsonFetch(sparse)),
      db,
    });

    expect(out.status).toBe('found');
    if (out.status !== 'found') return;
    // completeness 0.25 → 0.55 + 0.25*0.25 = 0.6125, strictly below the complete 0.80.
    expect(out.item.fidelity).toBeCloseTo(0.6125, 5);
    expect(out.item.fidelity).toBeLessThan(0.8);
    // Absent macros stay null (never a fabricated 0).
    expect(out.item.proteinG).toBeNull();
  });

  it('returns a typed not-found miss for an unknown code (OFF status 0)', async () => {
    const out = await resolveBarcode('0000000000000', PACKAGE_100, {
      fetchImpl: asFetch(jsonFetch({ status: 0 })),
      db,
    });
    expect(out.status).toBe('not-found');
  });

  it('does not fetch for an empty code or a non-positive portion', async () => {
    const fetchImpl = jsonFetch(load('off-complete-thai-sauce.json'));
    const blank = await resolveBarcode('   ', PACKAGE_100, { fetchImpl: asFetch(fetchImpl), db });
    const zero = await resolveBarcode('0737628064502', { grams: 0, method: 'package' }, {
      fetchImpl: asFetch(fetchImpl),
      db,
    });
    expect(blank.status).toBe('not-found');
    expect(zero.status).toBe('not-found');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('parseServingGrams', () => {
  it('prefers a gram value in parentheses', () => {
    expect(parseServingGrams('0.333 PACKAGE (52 g)')).toBe(52);
  });
  it('reads a bare "<n> g" token', () => {
    expect(parseServingGrams('30 g')).toBe(30);
    expect(parseServingGrams('30g')).toBe(30);
  });
  it('returns null for a volume-only serving (never fabricates a mass)', () => {
    expect(parseServingGrams('240 ml')).toBeNull();
  });
  it('returns null for missing/empty/zero', () => {
    expect(parseServingGrams(undefined)).toBeNull();
    expect(parseServingGrams('')).toBeNull();
    expect(parseServingGrams('0 g')).toBeNull();
  });
});

describe('parseServingAmount', () => {
  it('prefers a declared gram weight', () => {
    expect(parseServingAmount('0.333 PACKAGE (52 g)')).toBe(52);
    expect(parseServingAmount('1 BAR (37 g)')).toBe(37);
    expect(parseServingAmount('2 Tbsp (28 g)')).toBe(28);
  });
  it('falls back to a drink serving volume so beverages still default to one serving', () => {
    expect(parseServingAmount('1 serving (355 ml)')).toBe(355); // the MANGO GOLD case
    expect(parseServingAmount('1 portion (200 ml)')).toBe(200);
    expect(parseServingAmount('240 ml (8 fl oz)')).toBe(240);
  });
  it('returns null when no serving amount is stated', () => {
    expect(parseServingAmount(undefined)).toBeNull();
    expect(parseServingAmount('1 bar')).toBeNull();
  });
});
