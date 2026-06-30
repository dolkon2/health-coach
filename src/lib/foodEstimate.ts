/**
 * foodEstimate.ts — LLM-backed direct nutrition estimation (Claude, structured output).
 *
 * Describe mode's new backend. Where foodNLP.ts extracts {food, quantity, unit}
 * candidates that then resolve against USDA, this asks Claude to ESTIMATE the
 * nutrition directly — calories + macros + portion, no database lookup — like a
 * nutritionist eyeballing a plate. One call both segments the meal into distinct
 * foods AND estimates each, so "two eggs and toast" returns two estimated items.
 *
 * The estimates are KEYLESS: the FoodItems built here carry no sourceDb/foodId
 * (provenance lives on the Observation's `estimate` source) and a fidelity capped
 * in the LOW–MID band (macrosEstimated), so an estimate never reads as measured
 * (food-logging-spec.md § direct estimation). Honesty is encoded in BOTH the
 * schema (every macro is `number | null`) and the prompt (null when genuinely
 * unknown, never 0, never invented; portions the user didn't state are flagged).
 *
 * Returns `[]` on any failure (no key, network down, timeout, HTTP error,
 * malformed output, model refusal). The caller (`useFoodLog.addDescribed`) falls
 * back to `parseDescribed` so the logger keeps working without a key or network.
 */
import type { FoodItem } from '@core/observation';
import { defaultFidelity, fidelityCeiling, type Extraction } from '@core/nutrition/fidelity';
import { callClaude } from './anthropicClient';
import { DEFAULT_PORTION_G } from './foodLog';

/** Estimation quality matters more here than for extraction; this constant is the
 *  single swap point for the Haiku-vs-Sonnet benchmark (plan § Decision F). */
export const ESTIMATOR_MODEL = 'claude-haiku-4-5';

/** Estimation reasons more than extraction, so it gets a longer default timeout. */
const ESTIMATE_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You are a nutrition estimator. Given a free-text meal description, return ONE entry per distinct food with your best estimate of its nutrition — like an experienced nutritionist eyeballing the plate. These are approximations, not measurements.

For each food provide:
- "name": the food, lowercase, no brand names unless the user used one (e.g. "scrambled eggs", "sourdough toast", "pepperoni pizza").
- "kcal", "proteinG", "carbsG", "fatG": your best numeric estimate for the portion, in kcal and grams. Use null ONLY when you genuinely have no basis to estimate it — never guess wildly, and never use 0 to mean "unknown" (0 means a real measured zero, e.g. 0 g carbs in plain meat).
- "portionText": a short human portion, e.g. "2 eggs", "1 slice", "a handful". null if truly indeterminate.
- "estimatedGrams": approximate mass of the portion in grams, your best guess, or null.
- "portionStated": true ONLY if the user stated a specific amount/weight/count (e.g. "8 oz", "2 eggs", "a cup"); false if you had to assume a typical portion (e.g. "some fries", "a burger").
- "basis": one short phrase on how you arrived at the estimate (e.g. "2 large eggs, pan-fried").

Rules:
- Drop conversational filler ("had dinner with friends", "etc.", "and stuff"). Estimate foods only.
- Honor a stated portion; otherwise estimate a typical single serving.
- If no foods are mentioned, return an empty list.`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kcal: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          proteinG: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          carbsG: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          fatG: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          portionText: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          estimatedGrams: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          portionStated: { type: 'boolean' },
          basis: { type: 'string' },
        },
        required: [
          'name', 'kcal', 'proteinG', 'carbsG', 'fatG',
          'portionText', 'estimatedGrams', 'portionStated', 'basis',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

export interface EstimatedFoodItem {
  name: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  portionText: string | null;
  estimatedGrams: number | null;
  portionStated: boolean;
  basis: string; // how the estimate was reached — transparency; not persisted on the FoodItem
}

interface EstimationResponse {
  items: EstimatedFoodItem[];
}

export interface EstimateMealOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Estimate a meal's nutrition from free text via Claude. Returns one
 * EstimatedFoodItem per distinct food, or [] on any failure so the caller can
 * fall back to the regex parser. No database lookup.
 */
export async function estimateMeal(
  text: string,
  opts: EstimateMealOptions = {}
): Promise<EstimatedFoodItem[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const result = await callClaude<EstimationResponse>({
    model: ESTIMATOR_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userMessage: trimmed,
    schema: SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 1024, // multi-item meals, each with a basis phrase, need headroom
    apiKey: opts.apiKey,
    fetchImpl: opts.fetchImpl,
    signal: opts.signal,
    timeoutMs: opts.timeoutMs ?? ESTIMATE_TIMEOUT_MS,
  });

  if (!result || !Array.isArray(result.items)) return [];

  return result.items
    .filter((it) => it && typeof it.name === 'string' && it.name.trim().length > 0)
    .map((it) => ({ ...it, name: it.name.trim() }));
}

/**
 * Turn an estimate into a KEYLESS FoodItem ready for the meal builder. No
 * sourceDb/foodId (it has no database lineage); quantityMethod 'estimated';
 * fidelity capped in the LOW–MID band via the macrosEstimated extraction signal
 * (stated portion → low-MID, vague → LOW), so it never reads as measured. The
 * macros are absolute estimates for the portion, NOT per-gram — `quantity` is the
 * approximate mass for display, not a scaling basis.
 */
export function estimatedItemToFoodItem(est: EstimatedFoodItem): FoodItem {
  const extraction: Extraction = { macrosEstimated: true, quantity: est.portionStated };
  return {
    description: est.name,
    ...(est.portionText ? { portionText: est.portionText } : {}),
    quantity: est.estimatedGrams ?? DEFAULT_PORTION_G,
    quantityMethod: 'estimated',
    kcal: est.kcal,
    proteinG: est.proteinG,
    carbsG: est.carbsG,
    fatG: est.fatG,
    fidelity: defaultFidelity('described', extraction),
    fidelityCeiling: fidelityCeiling('described'),
  };
}
