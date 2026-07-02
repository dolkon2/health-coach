/**
 * foodLabel tests — Nutrition Facts photo → transcribed `label` item.
 *
 * Mirrors foodVision.test.ts (the plate-estimate path), asserting transcription's
 * own contract:
 *   - the image goes up as an [image, text] content array on the label model;
 *   - a legible label → its printed per-serving values, verbatim — printed 0 is a
 *     real 0, unprinted/illegible is null (null ≠ 0, never converted, never
 *     computed);
 *   - found:false, all-null reads, and every failure mode (no key, HTTP error,
 *     refusal, network throw, empty image) → a typed 'unreadable' miss, never a
 *     fabricated read;
 *   - labelToItem builds a KEYLESS item at `label` fidelity: full read → HIGH
 *     (same band as barcode), partial read → MID, macros scaled by serving count
 *     with null preserved, quantityMethod recording package-vs-estimated.
 */
import { describe, it, expect, jest } from '@jest/globals';
import {
  transcribeLabel,
  labelToItem,
  LABEL_MODEL,
  type LabelTranscription,
} from '@/lib/foodLabel';
import { tierOf, fidelityCeiling } from '@core/nutrition/fidelity';
import { DEFAULT_PORTION_G } from '@/lib/foodLog';

const STUB_KEY = 'sk-test';
const B64 = 'QkFTRTY0'; // "BASE64"

const read = (over: Partial<LabelTranscription & { found: boolean }> = {}) => ({
  found: true,
  productName: 'Overnight Oats',
  servingText: '1 packet (60g)',
  servingGrams: 60,
  kcal: 240,
  proteinG: 20,
  carbsG: 30,
  fatG: 5,
  ...over,
});

function fetchReturning(body: object) {
  const resp = { content: [{ type: 'text', text: JSON.stringify(body) }], stop_reason: 'end_turn' };
  return jest.fn(async () => ({ ok: true, status: 200, json: async () => resp })) as unknown as typeof fetch;
}

describe('transcribeLabel', () => {
  it('returns the printed per-serving values of a legible label', async () => {
    const out = await transcribeLabel(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl: fetchReturning(read()) });
    expect(out.status).toBe('read');
    if (out.status !== 'read') return;
    expect(out.label.productName).toBe('Overnight Oats');
    expect(out.label.servingGrams).toBe(60);
    expect(out.label.kcal).toBe(240);
  });

  it('sends the image as a base64 block on the label model with the schema', async () => {
    const fetchImpl = fetchReturning(read());
    await transcribeLabel(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl });
    const call = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [unknown, { body: string }];
    const body = JSON.parse(call[1].body);
    expect(body.model).toBe(LABEL_MODEL);
    const content = body.messages[0].content;
    expect(content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: B64 } });
    expect(body.output_config.format.type).toBe('json_schema');
  });

  it('keeps a printed 0 as 0 and an unprinted value as null (null ≠ 0)', async () => {
    const out = await transcribeLabel(B64, 'image/jpeg', {
      apiKey: STUB_KEY,
      fetchImpl: fetchReturning(read({ carbsG: 0, fatG: null })),
    });
    expect(out.status).toBe('read');
    if (out.status !== 'read') return;
    expect(out.label.carbsG).toBe(0); // a printed 0g is a real zero
    expect(out.label.fatG).toBeNull(); // glare/unprinted stays unknown
  });

  it('is unreadable when the model saw no label (found: false)', async () => {
    const out = await transcribeLabel(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl: fetchReturning(read({ found: false })) });
    expect(out).toEqual({ status: 'unreadable' });
  });

  it('is unreadable when every macro came back null — nothing to log', async () => {
    const out = await transcribeLabel(B64, 'image/jpeg', {
      apiKey: STUB_KEY,
      fetchImpl: fetchReturning(read({ kcal: null, proteinG: null, carbsG: null, fatG: null })),
    });
    expect(out).toEqual({ status: 'unreadable' });
  });

  it('is unreadable with no key, no network call', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    expect(await transcribeLabel(B64, 'image/jpeg', { fetchImpl })).toEqual({ status: 'unreadable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('is unreadable on an empty image without calling fetch', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    expect(await transcribeLabel('', 'image/jpeg', { apiKey: STUB_KEY, fetchImpl })).toEqual({ status: 'unreadable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('is unreadable on HTTP error, refusal, and network exception', async () => {
    const http = (jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown) as typeof fetch;
    const refusal = (jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'refusal', content: [] }) })) as unknown) as typeof fetch;
    const down = (jest.fn(async () => { throw new Error('down'); }) as unknown) as typeof fetch;
    for (const fetchImpl of [http, refusal, down]) {
      expect(await transcribeLabel(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl })).toEqual({ status: 'unreadable' });
    }
  });
});

describe('labelToItem — keyless, barcode-band fidelity, honest scaling', () => {
  const label = (over: Partial<LabelTranscription> = {}): LabelTranscription => {
    const { found: _f, ...rest } = read();
    return { ...rest, ...over };
  };

  it('a full read at the declared serving is HIGH — the same confidence as a complete barcode record', () => {
    const item = labelToItem(label(), { servings: 1, method: 'package' });
    expect(item.foodId).toBeUndefined();
    expect(item.sourceDb).toBeUndefined();
    expect(item.description).toBe('Overnight Oats');
    expect(item.quantity).toBe(60);
    expect(item.quantityMethod).toBe('package');
    expect(item.kcal).toBe(240);
    expect(tierOf(item.fidelity)).toBe('HIGH');
    expect(item.fidelityCeiling).toBe(fidelityCeiling('label'));
  });

  it('scales macros and grams by the serving count, preserving null (never a fake 0)', () => {
    const item = labelToItem(label({ fatG: null }), { servings: 1.5, method: 'package' });
    expect(item.kcal).toBe(360);
    expect(item.proteinG).toBe(30);
    expect(item.fatG).toBeNull(); // an unread value can't be scaled into existence
    expect(item.quantity).toBe(90);
    expect(item.portionText).toBe('1.5 servings (1 packet (60g))');
  });

  it('a partial read lands MID — missing macros pull completeness down', () => {
    const item = labelToItem(label({ proteinG: null, fatG: null }), { servings: 1, method: 'package' });
    expect(tierOf(item.fidelity)).toBe('MID');
  });

  it('an eyeballed share records quantityMethod estimated', () => {
    const item = labelToItem(label(), { servings: 0.5, method: 'estimated' });
    expect(item.quantityMethod).toBe('estimated');
    expect(item.kcal).toBe(120);
  });

  it('falls back to the display-default mass when the label declares no grams', () => {
    const item = labelToItem(label({ servingGrams: null, servingText: '1 bottle' }), { servings: 2, method: 'package' });
    expect(item.quantity).toBe(DEFAULT_PORTION_G); // display fallback; portionText carries the truth
    expect(item.portionText).toBe('2 servings (1 bottle)');
    expect(item.kcal).toBe(480);
  });

  it('falls back to a generic name when no product name was visible', () => {
    const item = labelToItem(label({ productName: null }), { servings: 1, method: 'package' });
    expect(item.description).toBe('Scanned label');
  });
});
