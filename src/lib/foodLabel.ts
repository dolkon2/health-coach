/**
 * foodLabel.ts — photographed Nutrition Facts panel → TRANSCRIBED `label` FoodItem.
 *
 * Scan mode's second target (alongside barcode). Where foodVision.ts ESTIMATES a
 * plate, this TRANSCRIBES a printed label: the vision model reads the panel's
 * declared per-serving values verbatim — it never computes, never estimates,
 * and reports null for anything unreadable or not printed (null ≠ 0; a printed
 * "0g" is a real zero). That distinction is why the result lands at `label`
 * fidelity (barcode's band, 0.55 partial → 0.80 full read, ceiling 0.85) and a
 * `labelscan` source, not the estimate bands.
 *
 * The item is KEYLESS (no sourceDb/foodId — there is no food-database record
 * behind it; provenance is the Observation's `labelscan` source), which also
 * makes every row editable in the logger, so a misread digit is correctable
 * with the physical label in hand.
 *
 * Returns a typed 'unreadable' miss on any failure (no key, offline, timeout,
 * malformed output, no label in frame) — never a fabricated read.
 */
import type { FoodItem, QuantityMethod } from '@core/observation';
import { defaultFidelity, fidelityCeiling } from '@core/nutrition/fidelity';
import { callClaude } from './anthropicClient';
import { DEFAULT_PORTION_G } from './foodLog';

/** Transcription is a read, not a reasoning task — Haiku is plenty. Single swap
 *  point: flip to 'claude-sonnet-4-6' if real labels misread. */
export const LABEL_MODEL = 'claude-haiku-4-5';

/** Reading a dense printed panel from a photo; same allowance as plate vision. */
const LABEL_TIMEOUT_MS = 12000;

const SYSTEM_PROMPT = `You are reading a photo of a food package's Nutrition Facts label. TRANSCRIBE the printed values exactly — do not estimate, do not compute, do not fill gaps from general knowledge.

Provide:
- "found": true only if a nutrition label is actually legible in the image; false otherwise (then every other field is null).
- "productName": the product name printed on the packaging if visible in the photo, else null. Never invent one.
- "servingText": the serving size line as printed (e.g. "2/3 cup (55g)", "1 bottle"), else null.
- "servingGrams": the gram (or ml) figure printed in the serving size, as a number, else null.
- "kcal", "proteinG", "carbsG", "fatG": the PER-SERVING values as printed, in kcal and grams. Use null ONLY when the value is not printed or not legible — never 0 to mean "unknown" (a printed 0g is a real zero: transcribe it as 0).

Rules:
- If the label shows per-100g columns as well, transcribe the PER-SERVING column.
- If only per-100g values are printed (no serving column), transcribe those and set "servingText" to "100 g" and "servingGrams" to 100.
- Transcribe kilojoules to kcal ONLY if the label prints both; if it prints kJ alone, set kcal to null rather than converting.
- Glare, crop, or blur over a value means null for that value, not a guess.`;

/** The transcription schema — flat, every value nullable (null = not printed /
 *  not legible, never 0-as-unknown). */
export const LABEL_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    productName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    servingText: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    servingGrams: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    kcal: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    proteinG: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    carbsG: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    fatG: { anyOf: [{ type: 'number' }, { type: 'null' }] },
  },
  required: ['found', 'productName', 'servingText', 'servingGrams', 'kcal', 'proteinG', 'carbsG', 'fatG'],
  additionalProperties: false,
} as const;

/** One label's declared per-serving facts, as transcribed. */
export interface LabelTranscription {
  productName: string | null;
  servingText: string | null;
  servingGrams: number | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export type LabelResolution =
  | { status: 'read'; label: LabelTranscription }
  | { status: 'unreadable' };

export interface TranscribeLabelOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface LabelResponse extends LabelTranscription {
  found: boolean;
}

/**
 * Transcribe a photographed Nutrition Facts panel via Claude. `imageBase64` is
 * raw base64 (no `data:` prefix), `mediaType` e.g. 'image/jpeg'. A read with
 * every macro null is treated as unreadable — there is nothing to log from it.
 */
export async function transcribeLabel(
  imageBase64: string,
  mediaType: string,
  opts: TranscribeLabelOptions = {}
): Promise<LabelResolution> {
  if (!imageBase64) return { status: 'unreadable' };

  const result = await callClaude<LabelResponse>({
    model: LABEL_MODEL,
    systemPrompt: SYSTEM_PROMPT,
    userMessage: 'Transcribe the Nutrition Facts label in this photo.',
    image: { data: imageBase64, mediaType },
    schema: LABEL_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 512, // one flat record; no per-item fan-out
    apiKey: opts.apiKey,
    fetchImpl: opts.fetchImpl,
    signal: opts.signal,
    timeoutMs: opts.timeoutMs ?? LABEL_TIMEOUT_MS,
  });

  if (!result || result.found !== true) return { status: 'unreadable' };

  const label: LabelTranscription = {
    productName: typeof result.productName === 'string' && result.productName.trim() ? result.productName.trim() : null,
    servingText: typeof result.servingText === 'string' && result.servingText.trim() ? result.servingText.trim() : null,
    servingGrams: typeof result.servingGrams === 'number' && result.servingGrams > 0 ? result.servingGrams : null,
    kcal: typeof result.kcal === 'number' ? result.kcal : null,
    proteinG: typeof result.proteinG === 'number' ? result.proteinG : null,
    carbsG: typeof result.carbsG === 'number' ? result.carbsG : null,
    fatG: typeof result.fatG === 'number' ? result.fatG : null,
  };

  const anyMacro = label.kcal != null || label.proteinG != null || label.carbsG != null || label.fatG != null;
  return anyMacro ? { status: 'read', label } : { status: 'unreadable' };
}

/** The portion the user confirmed for a scanned label, in servings. `package` =
 *  the label's declared serving; `estimated` = an eyeballed share of it. */
export interface LabelPortion {
  servings: number;
  method: Extract<QuantityMethod, 'package' | 'estimated'>;
}

/** Scale one transcribed per-serving value to the chosen serving count.
 *  null stays null — a value the label didn't yield is never invented. */
const scale = (v: number | null, servings: number): number | null =>
  v == null ? null : Math.round(v * servings * 10) / 10;

/**
 * Build the keyless `label` FoodItem for a confirmed portion. Macros are the
 * label's per-serving declarations × the serving count; fidelity comes from the
 * read's completeness (fraction of the four macros transcribed), so a partial
 * read honestly lands lower than a full one. `quantity` is the portion's gram
 * mass when the label declares one, else the display default (portionText
 * carries the honest phrasing either way).
 */
export function labelToItem(label: LabelTranscription, portion: LabelPortion): FoodItem {
  const n = portion.servings;
  const read = [label.kcal, label.proteinG, label.carbsG, label.fatG];
  const completeness = read.filter((v) => v != null).length / read.length;
  const grams = label.servingGrams != null ? Math.round(label.servingGrams * n) : null;
  return {
    description: label.productName ?? 'Scanned label',
    portionText: `${n} serving${n === 1 ? '' : 's'}${label.servingText ? ` (${label.servingText})` : ''}`,
    quantity: grams ?? DEFAULT_PORTION_G,
    quantityMethod: portion.method,
    kcal: scale(label.kcal, n),
    proteinG: scale(label.proteinG, n),
    carbsG: scale(label.carbsG, n),
    fatG: scale(label.fatG, n),
    fidelity: defaultFidelity('label', { completeness }),
    fidelityCeiling: fidelityCeiling('label'),
  };
}
