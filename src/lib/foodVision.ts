/**
 * foodVision.ts — LLM-backed nutrition estimation from a PHOTO (Claude, structured output).
 *
 * Photo mode's backend, modeled almost line-for-line on foodEstimate.ts (the text
 * path). Where that estimates from a typed description, this sends a base64 image
 * to Claude and asks it to segment the plate into distinct foods AND estimate each
 * — the constitution's canonical "AI in the plumbing" example ("It turns a photo
 * into a confident calorie estimate"). One call, same estimation schema as the
 * text path (ESTIMATE_SCHEMA), differing only in input (image + prompt) and in the
 * fidelity band the result lands at.
 *
 * The estimates are KEYLESS (no sourceDb/foodId — provenance is the Observation's
 * `photoestimate` source) and land at PHOTO fidelity (~0.35, capped 0.55): a photo
 * meal is ALWAYS LOW (dashed), because 2D portion estimation is limited by nature.
 * Honesty is encoded in the shared schema (every macro `number | null`) and the
 * prompt (null when genuinely unknown, never 0).
 *
 * Returns `[]` on any failure (no key, offline, timeout, HTTP error, malformed
 * output, refusal, empty image). The caller (`useFoodLog.addPhoto` via
 * `photoToItems`) then falls back to a single blank manual row, so the logger
 * keeps working with no key and no network.
 */
import type { FoodItem } from '@core/observation';
import { callClaude } from './anthropicClient';
import {
  ESTIMATE_SCHEMA,
  estimatedItemToFoodItem,
  type EstimatedFoodItem,
  type EstimationResponse,
} from './foodEstimate';

/** Photo estimation starts on Haiku 4.5 (Decision 4) — cheap and fast enough for a
 *  single still. Single swap point: flip to 'claude-sonnet-4-6' if accuracy on real
 *  plates is poor (Sonnet ~3x cost). */
export const VISION_MODEL = 'claude-haiku-4-5';

/** Vision reasons over a whole plate and is slower than text, so a longer timeout. */
const VISION_TIMEOUT_MS = 12000;

const SYSTEM_PROMPT = `You are a nutrition estimator looking at a PHOTO of a meal. Identify each distinct food on the plate and return ONE entry per food with your best estimate of its nutrition — like an experienced nutritionist eyeballing the plate. These are approximations from a 2D image, not measurements.

For each food provide:
- "name": the food, lowercase, no brand names (e.g. "grilled chicken breast", "white rice", "steamed broccoli").
- "kcal", "proteinG", "carbsG", "fatG": your best numeric estimate for the visible portion, in kcal and grams. Use null ONLY when you genuinely cannot estimate it from the image — never guess wildly, and never use 0 to mean "unknown" (0 means a real measured zero, e.g. 0 g carbs in plain meat).
- "portionText": a short human portion for what's visible, e.g. "1 breast", "1 cup", "a handful". null if truly indeterminate.
- "estimatedGrams": approximate mass of the visible portion in grams, your best guess, or null.
- "portionStated": always false — a photo never states an exact amount; portion is always inferred from the image.
- "basis": one short phrase on what you saw and how you sized it (e.g. "a chicken breast, ~palm-sized").

Rules:
- Estimate only foods you can actually see. Do not invent items that aren't in the frame.
- Portion is inferred from apparent size on the plate; note any size cue (a fork, a hand) you used in "basis".
- If the image shows no food, return an empty list.`;

export interface EstimateMealFromPhotoOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Estimate a meal's nutrition from a photo via Claude. `imageBase64` is raw base64
 * (no `data:` URI prefix), `mediaType` e.g. 'image/jpeg'. Returns one
 * EstimatedFoodItem per distinct food, or [] on any failure so the caller can fall
 * back to a manual row. No database lookup.
 */
export async function estimateMealFromPhoto(
  imageBase64: string,
  mediaType: string,
  opts: EstimateMealFromPhotoOptions = {}
): Promise<EstimatedFoodItem[]> {
  if (!imageBase64) return [];

  const result = await callClaude<EstimationResponse>({
    model: VISION_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userMessage: 'Estimate the nutrition of every distinct food you can see on this plate.',
    image: { data: imageBase64, mediaType },
    schema: ESTIMATE_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 1024, // multi-item plates, each with a basis phrase, need headroom
    apiKey: opts.apiKey,
    fetchImpl: opts.fetchImpl,
    signal: opts.signal,
    timeoutMs: opts.timeoutMs ?? VISION_TIMEOUT_MS,
  });

  if (!result || !Array.isArray(result.items)) return [];

  return result.items
    .filter((it) => it && typeof it.name === 'string' && it.name.trim().length > 0)
    .map((it) => ({ ...it, name: it.name.trim() }));
}

/** A blank estimate — the shape photoToItems falls back to when the model gave us
 *  nothing (no key / offline / failure). Null macros, no portion; the user fills it
 *  in via the estimate editor. */
const BLANK_ESTIMATE: EstimatedFoodItem = {
  name: '',
  kcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  portionText: null,
  estimatedGrams: null,
  portionStated: false,
  basis: 'no estimate available — add it manually',
};

/**
 * Turn an estimateMealFromPhoto() result into the keyless FoodItems to add to the
 * meal, each at PHOTO fidelity (always LOW, dashed). When estimation returned []
 * (no key / offline / failure), yields ONE blank manual row so the user can log
 * the meal by hand — the logger keeps working with no key and no network.
 */
export function photoToItems(estimates: EstimatedFoodItem[]): FoodItem[] {
  const source = estimates.length > 0 ? estimates : [BLANK_ESTIMATE];
  return source.map((e) => estimatedItemToFoodItem(e, 'photo'));
}
