/**
 * usda.ts — USDA FoodData Central → normalized FoodItem (Pass 2.2).
 *
 * USDA nests nutrients in a `foodNutrients[]` array keyed by nutrient id/number,
 * with no serving normalization, and reports two different bases:
 *   - Foundation / SR Legacy: amounts are **per 100 g** (lab-measured).
 *   - Branded: a `labelNutrients` block is **per serving** (`servingSize` grams).
 * The adapter reconciles both to per-gram, then `buildFoodItem` scales to the
 * logged quantity. This nested→flat normalization is "the logic we own."
 *
 * Pure: fixture-tested, no live network.
 */
import type { FoodItem } from '../observation';
import type { Extraction } from './fidelity';
import { buildFoodItem, type AdaptOptions, type PerGramMacros } from './adapter';

/** The fields we read from a USDA `/v1/food/{fdcId}` detail response. */
export interface UsdaFoodResponse {
  fdcId: number;
  dataType?: string; // 'Branded' | 'Foundation' | 'SR Legacy' | 'Survey (FNDDS)' | …
  description?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  labelNutrients?: Record<string, { value?: number } | undefined>;
  foodNutrients?: Array<{
    nutrient?: { id?: number; number?: string; name?: string; unitName?: string };
    amount?: number;
  }>;
}

// The macros we store, by USDA nutrientNumber (primary) and nutrientId (fallback).
// Energy is the kcal entry (208 / 1008), deliberately not the kJ or Atwater rows.
type MacroKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'alcoholG';
const NUTRIENT_NUMBER: Record<MacroKey, string> = {
  kcal: '208',
  proteinG: '203',
  carbsG: '205',
  fatG: '204',
  fiberG: '291',
  alcoholG: '221',
};
const NUTRIENT_ID: Record<MacroKey, number> = {
  kcal: 1008,
  proteinG: 1003,
  carbsG: 1005,
  fatG: 1004,
  fiberG: 1079,
  alcoholG: 1018,
};

// USDA labelNutrients keys for the Branded path.
const LABEL_KEY: Record<MacroKey, string | null> = {
  kcal: 'calories',
  proteinG: 'protein',
  carbsG: 'carbohydrates',
  fatG: 'fat',
  fiberG: 'fiber',
  alcoholG: null, // labels don't carry alcohol
};

/** Normalize a USDA food detail response into a FoodItem at the logged quantity. */
export function adaptUsdaFood(raw: UsdaFoodResponse, opts: AdaptOptions): FoodItem {
  const branded = raw.dataType === 'Branded';
  const perGram = branded ? brandedPerGram(raw) : per100gPerGram(raw);
  // Foundation/SR are lab-measured (slightly higher default); Branded is
  // label-declared with a small tolerance. fidelity.ts owns the actual numbers.
  const extraction: Extraction = { branded };
  return buildFoodItem('usda', String(raw.fdcId), perGram, extraction, opts, raw.description);
}

/** Foundation / SR Legacy: flatten `foodNutrients[]` (per 100 g) → per gram. */
function per100gPerGram(raw: UsdaFoodResponse): PerGramMacros {
  const byNumber = new Map<string, number>();
  const byId = new Map<number, number>();
  for (const fn of raw.foodNutrients ?? []) {
    if (typeof fn.amount !== 'number') continue;
    if (fn.nutrient?.number) byNumber.set(fn.nutrient.number, fn.amount);
    if (typeof fn.nutrient?.id === 'number') byId.set(fn.nutrient.id, fn.amount);
  }
  const perGram = (k: MacroKey): number | null => {
    const per100 = byNumber.get(NUTRIENT_NUMBER[k]) ?? byId.get(NUTRIENT_ID[k]);
    return per100 == null ? null : per100 / 100;
  };
  return macros(perGram);
}

/** Branded: `labelNutrients` (per serving) ÷ `servingSize` → per gram. */
function brandedPerGram(raw: UsdaFoodResponse): PerGramMacros {
  const serving = raw.servingSize;
  const label = raw.labelNutrients ?? {};
  const perGram = (k: MacroKey): number | null => {
    const key = LABEL_KEY[k];
    if (key == null || !serving || serving <= 0) return null;
    const perServing = label[key]?.value;
    return typeof perServing === 'number' ? perServing / serving : null;
  };
  return macros(perGram);
}

const macros = (perGram: (k: MacroKey) => number | null): PerGramMacros => ({
  kcal: perGram('kcal'),
  proteinG: perGram('proteinG'),
  carbsG: perGram('carbsG'),
  fatG: perGram('fatG'),
  fiberG: perGram('fiberG'),
  alcoholG: perGram('alcoholG'),
});
