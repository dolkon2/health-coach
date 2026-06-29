/**
 * adapter.ts — shared scaffolding for the nutrition-source adapters (Pass 2.2).
 *
 * Both the USDA and Open Food Facts adapters do the same final step: take a set
 * of *per-gram* macros parsed from their (very different) response shapes, scale
 * them to the quantity the user logged, and attach a per-item default fidelity +
 * ceiling and provenance. Funnelling that through one `buildFoodItem` guarantees
 * the two adapters emit the **identical internal shape** (a Pass 2.2
 * done-criterion) — the only differences between sources live in their parsers.
 *
 * Pure: no I/O. The network/cache layer is app-side (Pass 2.3).
 */
import type { FoodItem, FoodSourceDb, InputMethod, QuantityMethod } from '../observation';
import { defaultFidelity, fidelityCeiling, type Extraction } from './fidelity';

/** What the caller knows about how the food is being logged. */
export interface AdaptOptions {
  /** The input method — sets fidelity + ceiling (extraction, never channel). */
  method: InputMethod;
  /** Quantity the user logged, in grams (the canonical unit the adapter scales to). */
  quantityG: number;
  /** How that quantity was determined. */
  quantityMethod: QuantityMethod;
  /**
   * Optional extraction override. For `weighed`/`barcode` the adapter derives the
   * extraction from the source (Branded vs lab; record completeness). For
   * `described`, fidelity keys off the *parse* (food/quantity/unit), which only
   * the describe layer knows — it passes those flags here. Omit to use the
   * adapter's own source-derived signal.
   */
  extraction?: Extraction;
}

/**
 * Macros expressed **per gram**, as parsed from a source response. `null` =
 * the field was genuinely absent from the response (a partial record), never 0.
 * The required four (`kcal`/`proteinG`/`carbsG`/`fatG`) are always present as
 * keys; `fiberG`/`alcoholG` are optional macros and `null` when absent.
 */
export interface PerGramMacros {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  alcoholG: number | null;
}

/** Round to 0.1 of a unit — enough precision for storage, no float noise. */
const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Scale a per-gram value to the logged quantity, preserving `null` (≠ 0). */
const scale = (perGram: number | null, quantityG: number): number | null =>
  perGram == null ? null : round1(perGram * quantityG);

/**
 * Assemble the normalized FoodItem. The required macros stay `number | null`
 * (null = not captured); the optional macros are **omitted** when absent (so a
 * missing fiber reads as `undefined`, not `null` and not `0`). Fidelity and its
 * ceiling come from the method + the source's extraction signal — the single
 * place provenance turns into confidence.
 */
export function buildFoodItem(
  sourceDb: FoodSourceDb,
  foodId: string,
  perGram: PerGramMacros,
  extraction: Extraction,
  opts: AdaptOptions,
  name?: string
): FoodItem {
  const q = opts.quantityG;
  const item: FoodItem = {
    sourceDb,
    foodId,
    quantity: q,
    quantityMethod: opts.quantityMethod,
    kcal: scale(perGram.kcal, q),
    proteinG: scale(perGram.proteinG, q),
    carbsG: scale(perGram.carbsG, q),
    fatG: scale(perGram.fatG, q),
    fidelity: defaultFidelity(opts.method, opts.extraction ?? extraction),
    fidelityCeiling: fidelityCeiling(opts.method),
  };
  // The human name is display-only and omitted when the source didn't carry one
  // (same omit-when-absent rule as the optional macros — never an empty string).
  const trimmed = name?.trim();
  if (trimmed) item.description = trimmed;
  const fiber = scale(perGram.fiberG, q);
  if (fiber != null) item.fiberG = fiber;
  const alcohol = scale(perGram.alcoholG, q);
  if (alcohol != null) item.alcoholG = alcohol;
  return item;
}
