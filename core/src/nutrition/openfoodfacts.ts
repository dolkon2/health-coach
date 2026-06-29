/**
 * openfoodfacts.ts — Open Food Facts product → normalized FoodItem (Pass 2.2).
 *
 * OFF reports macros in `product.nutriments` with `_100g` suffixes
 * (`energy-kcal_100g`, `proteins_100g`, …) — per 100 g, so per-gram is a
 * straight ÷100. OFF is crowd-sourced and patchy, so the adapter derives a
 * **completeness signal** (what fraction of the required macros the record
 * actually carries) and routes it into fidelity — provenance reflected, not
 * hidden. A missing field becomes `null`, never a fabricated 0.
 *
 * Pure: fixture-tested, no live network.
 */
import type { FoodItem } from '../observation';
import type { Extraction } from './fidelity';
import { buildFoodItem, type AdaptOptions, type PerGramMacros } from './adapter';

/** The fields we read from an OFF `/api/v2/product/{barcode}.json` response. */
export interface OffProductResponse {
  code?: string;
  status?: number;
  product?: {
    code?: string;
    product_name?: string;
    serving_size?: string;
    nutriments?: Record<string, number | string | undefined>;
  };
}

type MacroKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'alcoholG';
const NUTRIMENT_KEY: Record<MacroKey, string> = {
  kcal: 'energy-kcal_100g',
  proteinG: 'proteins_100g',
  carbsG: 'carbohydrates_100g',
  fatG: 'fat_100g',
  fiberG: 'fiber_100g',
  alcoholG: 'alcohol_100g',
};

// The macros whose presence defines a "complete" record. Fiber/alcohol are
// optional quality extras, not part of the completeness denominator.
const REQUIRED: MacroKey[] = ['kcal', 'proteinG', 'carbsG', 'fatG'];

/** Coerce an OFF nutriment value (sometimes a numeric string) to a number or null. */
function toNumber(v: number | string | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Normalize an OFF product response into a FoodItem at the logged quantity. */
export function adaptOpenFoodFactsProduct(raw: OffProductResponse, opts: AdaptOptions): FoodItem {
  const nutriments = raw.product?.nutriments ?? {};
  const per100 = (k: MacroKey): number | null => toNumber(nutriments[NUTRIMENT_KEY[k]]);
  const perGramOf = (k: MacroKey): number | null => {
    const v = per100(k);
    return v == null ? null : v / 100;
  };
  const perGram: PerGramMacros = {
    kcal: perGramOf('kcal'),
    proteinG: perGramOf('proteinG'),
    carbsG: perGramOf('carbsG'),
    fatG: perGramOf('fatG'),
    fiberG: perGramOf('fiberG'),
    alcoholG: perGramOf('alcoholG'),
  };

  // Completeness drives fidelity: a full record sits at the barcode default,
  // a half-empty one drops toward the floor. (Self-consistency cross-checks —
  // do the macros sum to the stated energy — are a documented future refinement.)
  const present = REQUIRED.filter((k) => per100(k) != null).length;
  const completeness = present / REQUIRED.length;
  const extraction: Extraction = { completeness };

  const foodId = raw.product?.code ?? raw.code ?? '';
  return buildFoodItem('openfoodfacts', foodId, perGram, extraction, opts, raw.product?.product_name);
}
