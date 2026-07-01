/**
 * foodBarcode.ts — scanned UPC/EAN → honest `barcode` FoodItem (Pass 2.7b).
 *
 * A thin resolution wrapper over foodSearch.ts's existing `getFoodByBarcode`
 * (OFF fetch, cache-first, typed null miss). It adds only the portion decision
 * the scan flow needs: the grams the user is eating and whether that portion is
 * the label's declared basis (`package`) or an eyeballed amount (`estimated`).
 *
 * No new network or parsing lives here — item identity comes from the UPC, and
 * macro fidelity from the OFF record's completeness (fidelity.ts `barcode` case,
 * 0.55 sparse → 0.80 complete). A not-found code returns a typed miss, never a
 * fabricated item (constitution: never invent a number). The `quantityMethod`
 * records the portion basis honestly on the item, whatever fidelity resolves to.
 */
import type { FoodItem, QuantityMethod } from '@core/observation';
import { getFoodByBarcode, type FoodSearchDeps } from './foodSearch';

/** OFF reports per 100 g; that is the honest default basis before the user
 *  states what they actually ate. */
export const BARCODE_DEFAULT_G = 100;

/** The portion the user confirmed for a scanned product. `package` = the label's
 *  declared basis (whole / a declared serving); `estimated` = an eyeballed amount. */
export interface BarcodePortion {
  grams: number;
  method: Extract<QuantityMethod, 'package' | 'estimated'>;
}

export type BarcodeResolution =
  | { status: 'found'; item: FoodItem; servingG: number | null }
  | { status: 'not-found' };

/**
 * Grams from an OFF `serving_size` label ("0.333 PACKAGE (52 g)", "30 g",
 * "240 ml") — prefer a value in parentheses, else the first bare `<n> g` token.
 * Returns null when the label carries no gram figure (e.g. a volume-only "240
 * ml"): we never fabricate a mass, so the flow falls back to the 100 g basis.
 */
export function parseServingGrams(servingSize?: string | null): number | null {
  if (!servingSize) return null;
  const paren = servingSize.match(/\(\s*([\d.]+)\s*g\s*\)/i);
  const bare = servingSize.match(/([\d.]+)\s*g\b/i);
  const raw = paren?.[1] ?? bare?.[1];
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resolve a scanned code at a chosen portion into a `barcode` FoodItem plus the
 * label's serving size in grams (so the scan screen can default to one serving),
 * or a typed not-found miss. Wraps `getFoodByBarcode`, so the first scan fetches
 * and a re-resolve (e.g. the user adjusts the portion) serves from cache.
 *
 * The OFF serving label rides in on the item's `portionText`; we read the grams
 * out and drop it, so the logged item's row shows its own chosen grams, not the
 * label phrasing.
 */
export async function resolveBarcode(
  barcode: string,
  portion: BarcodePortion,
  deps?: FoodSearchDeps
): Promise<BarcodeResolution> {
  const code = barcode.trim();
  if (!code || !(portion.grams > 0)) return { status: 'not-found' };
  const item = await getFoodByBarcode(
    code,
    { method: 'barcode', quantityG: portion.grams, quantityMethod: portion.method },
    deps
  );
  if (!item) return { status: 'not-found' };
  const servingG = parseServingGrams(item.portionText);
  const { portionText: _drop, ...clean } = item;
  return { status: 'found', item: clean, servingG };
}
