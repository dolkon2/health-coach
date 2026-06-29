/**
 * foodNLP.ts — LLM-backed food-item extraction (Claude Haiku 4.5).
 *
 * The FIRST attempt at turning free-text input like "two slices of pizza with
 * mushrooms" or "had dinner with friends a few drinks a burger some fries"
 * into a list of {food, quantity, unit} candidates. Each candidate is the
 * same ParsedDescribed shape the existing regex parser produces, so the rest
 * of the pipeline (USDA search, fidelity computation) is unchanged.
 *
 * Honesty is encoded in BOTH the schema (`quantity` is `number | null`, never
 * absent or guessed) and the prompt (explicit "set to null if not stated").
 * LLM-extracted items inherit the existing `described` input method and its
 * fidelity ceiling — no new fidelity tier (food-logging-spec.md, data-layer
 * adjacent rule).
 *
 * Returns `[]` on any failure (no key, network down, timeout, HTTP error,
 * malformed output, model refusal). The caller (`useFoodLog.addDescribed`)
 * falls back to `parseDescribed` so the logger keeps working without a key
 * or without network.
 */
import { callClaude } from './anthropicClient';
import { MASS_UNITS, type ParsedDescribed } from './foodLog';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `Extract distinct food items from the user's message. Return ONE entry per food, even when the user names several in one phrase.

Rules:
- If a quantity is not explicitly stated, set "quantity" to null. NEVER guess. "A few drinks" → quantity null. "Some fries" → quantity null.
- "unit" must be a real unit word the user actually used (e.g. oz, g, cup, slice, slices, serving, piece, bottle, can, drink) OR null if no unit word was stated. Do not invent units.
- "food" is the food name only, with quantity/unit words stripped. Lowercase. No brand names unless the user used one. Examples: "ribeye", "burger", "fries", "pepperoni pizza", "oat milk latte".
- Drop conversational filler ("had dinner with friends", "etc.", "and stuff", "or so"). Extract items only.
- If no food items are mentioned, return an empty list.`;

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          food: { type: 'string' },
          quantity: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          unit: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
        required: ['food', 'quantity', 'unit'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

interface ExtractionResponse {
  items: Array<{
    food: string;
    quantity: number | null;
    unit: string | null;
  }>;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Convert an LLM extraction item to the ParsedDescribed shape the food-log
 * pipeline already consumes. `quantity: null` collapses to `undefined` (the
 * existing optional shape); a recognized mass/volume unit computes grams via
 * the shared MASS_UNITS table; other unit words (slice, piece, drink) are
 * dropped without inventing grams — same behavior as the regex parser for
 * non-mass quantifiers (see parseDescribed quirk 18).
 */
function toParsedDescribed(item: ExtractionResponse['items'][number]): ParsedDescribed {
  const food = item.food.trim();
  const quantity = item.quantity ?? undefined;
  const unitLower = item.unit?.toLowerCase();

  if (quantity != null && unitLower && MASS_UNITS[unitLower] != null) {
    return {
      foodText: food,
      quantity,
      unit: unitLower,
      grams: round1(quantity * MASS_UNITS[unitLower]),
    };
  }
  return quantity != null ? { foodText: food, quantity } : { foodText: food };
}

export interface ExtractFoodItemsOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Extract food items from free-text input via Claude Haiku. Returns one
 * ParsedDescribed per distinct food, or [] on any failure so the caller can
 * fall back to the regex parser.
 */
export async function extractFoodItems(
  text: string,
  opts: ExtractFoodItemsOptions = {}
): Promise<ParsedDescribed[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const result = await callClaude<ExtractionResponse>({
    model: MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userMessage: trimmed,
    schema: SCHEMA as unknown as Record<string, unknown>,
    apiKey: opts.apiKey,
    fetchImpl: opts.fetchImpl,
    signal: opts.signal,
    timeoutMs: opts.timeoutMs,
  });

  if (!result || !Array.isArray(result.items)) return [];

  return result.items
    .filter((it) => it && typeof it.food === 'string' && it.food.trim().length > 0)
    .map(toParsedDescribed);
}
