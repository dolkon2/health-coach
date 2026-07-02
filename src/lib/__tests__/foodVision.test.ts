/**
 * foodVision tests — photo → macro estimation via Claude (Pass 2.8a).
 *
 * Mirrors foodEstimate.test.ts (the text path), asserting the photo path's own
 * contract:
 *   - a base64 image + text prompt are sent as an [image, text] content array;
 *   - well-formed output → segmented + estimated items, null macros preserved
 *     (honesty: null ≠ 0, never invented);
 *   - any failure (no key, HTTP error, malformed, refusal, empty image, network
 *     throw) returns [] so the caller falls back to a manual row;
 *   - photoToItems builds KEYLESS items at PHOTO fidelity — always LOW (dashed),
 *     capped at 0.55, never reading as measured — and yields one blank manual row
 *     when estimation came back empty (no key / offline), so the logger still works.
 */
import { describe, it, expect, jest } from '@jest/globals';
import {
  estimateMealFromPhoto,
  photoToItems,
  VISION_MODEL,
} from '@/lib/foodVision';
import type { EstimatedFoodItem } from '@/lib/foodEstimate';
import { tierOf, fidelityCeiling } from '@core/nutrition/fidelity';

const STUB_KEY = 'sk-test';
const B64 = 'QkFTRTY0'; // "BASE64"

const est = (over: Partial<EstimatedFoodItem> = {}): EstimatedFoodItem => ({
  name: 'grilled chicken',
  kcal: 220,
  proteinG: 40,
  carbsG: 0,
  fatG: 6,
  portionText: '1 breast',
  estimatedGrams: 150,
  portionStated: false,
  basis: 'a chicken breast on the plate',
  ...over,
});

function fetchReturning(items: EstimatedFoodItem[]) {
  const body = { content: [{ type: 'text', text: JSON.stringify({ items }) }], stop_reason: 'end_turn' };
  return jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
}

describe('estimateMealFromPhoto', () => {
  it('segments and estimates the plate from an image', async () => {
    const fetchImpl = fetchReturning([est({ name: 'grilled chicken' }), est({ name: 'white rice', kcal: 200, proteinG: 4, carbsG: 44, fatG: 0 })]);
    const out = await estimateMealFromPhoto(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl });
    expect(out.map((i) => i.name)).toEqual(['grilled chicken', 'white rice']);
    expect(out[1].carbsG).toBe(44);
  });

  it('sends the image as a base64 block with the vision model and schema', async () => {
    const fetchImpl = fetchReturning([]);
    await estimateMealFromPhoto(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl });
    const call = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [unknown, { body: string }];
    const body = JSON.parse(call[1].body);
    expect(body.model).toBe(VISION_MODEL);
    const content = body.messages[0].content;
    expect(content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: B64 } });
    expect(typeof content[1].text).toBe('string');
    expect(body.output_config.format.type).toBe('json_schema');
  });

  it('preserves null macros across the boundary (null ≠ 0, never invented)', async () => {
    const fetchImpl = fetchReturning([est({ name: 'mystery sauce', kcal: null, proteinG: null, carbsG: null, fatG: null, estimatedGrams: null })]);
    const out = await estimateMealFromPhoto(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl });
    expect(out[0].kcal).toBeNull();
    expect(out[0].proteinG).toBeNull();
    expect(out[0].proteinG).not.toBe(0);
  });

  it('drops items with empty names (defensive against bad model output)', async () => {
    const fetchImpl = fetchReturning([est({ name: '' }), est({ name: 'salad' }), est({ name: '  ' })]);
    const out = await estimateMealFromPhoto(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl });
    expect(out.map((i) => i.name)).toEqual(['salad']);
  });

  it('returns [] with no key, no network call', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    expect(await estimateMealFromPhoto(B64, 'image/jpeg', { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns [] on an empty image without calling fetch', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    expect(await estimateMealFromPhoto('', 'image/jpeg', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns [] on HTTP error', async () => {
    const fetchImpl = (jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown) as typeof fetch;
    expect(await estimateMealFromPhoto(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
  });

  it('returns [] on a refusal', async () => {
    const fetchImpl = (jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'refusal', content: [] }) })) as unknown) as typeof fetch;
    expect(await estimateMealFromPhoto(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
  });

  it('returns [] on a network exception', async () => {
    const fetchImpl = (jest.fn(async () => { throw new Error('down'); }) as unknown) as typeof fetch;
    expect(await estimateMealFromPhoto(B64, 'image/jpeg', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
  });
});

describe('photoToItems — keyless, always LOW, offline-safe', () => {
  it('maps estimates to keyless photo items, every one LOW (dashed)', () => {
    const items = photoToItems([est({ name: 'chicken', portionStated: true }), est({ name: 'rice' })]);
    expect(items.map((i) => i.description)).toEqual(['chicken', 'rice']);
    expect(items.every((i) => i.foodId == null && i.sourceDb == null)).toBe(true);
    expect(items.every((i) => i.quantityMethod === 'estimated')).toBe(true);
    // Photo is LOW by nature — even a "stated" portion can't launder it to MID.
    expect(items.every((i) => tierOf(i.fidelity) === 'LOW')).toBe(true);
    expect(items.every((i) => i.fidelityCeiling === fidelityCeiling('photo'))).toBe(true);
  });

  it('preserves null macros (never a fake 0)', () => {
    const items = photoToItems([est({ kcal: null, proteinG: null, carbsG: null, fatG: null })]);
    expect(items[0].kcal).toBeNull();
    expect(items[0].proteinG).toBeNull();
    expect(items[0].proteinG).not.toBe(0);
  });

  it('yields ONE blank manual row when estimation is empty (no key / offline)', () => {
    const items = photoToItems([]);
    expect(items).toHaveLength(1);
    const only = items[0];
    expect(only.foodId).toBeUndefined();
    expect(only.sourceDb).toBeUndefined();
    expect(only.kcal).toBeNull(); // nothing estimated — null, never 0; the user fills it in
    expect(only.proteinG).toBeNull();
    expect(tierOf(only.fidelity)).toBe('LOW');
  });
});
