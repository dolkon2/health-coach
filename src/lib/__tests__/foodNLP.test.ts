/**
 * foodNLP tests — extractFoodItems against a mocked fetch.
 *
 * Verifies the contract the rest of the pipeline depends on:
 *   - Well-formed extraction → array of ParsedDescribed (the same shape the
 *     regex parser produces).
 *   - Quantity:null from the model collapses to `undefined` — honesty rule
 *     preserved across the LLM boundary (null ≠ 0; never invented).
 *   - Mass units (oz, cup) compute grams via the shared MASS_UNITS table.
 *   - Non-mass units (slice, drink) keep the count but emit no grams,
 *     mirroring parseDescribed's behavior for non-mass quantifiers.
 *   - Any failure (no key, HTTP error, malformed body, refusal, empty input,
 *     network exception) returns [] so the caller falls back.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { extractFoodItems } from '@/lib/foodNLP';

const STUB_KEY = 'sk-test';

/** Build a fetch stub that returns the given Anthropic-shaped response body
 *  as the JSON content block. */
function fetchReturning(items: Array<{ food: string; quantity: number | null; unit: string | null }>) {
  const body = {
    content: [{ type: 'text', text: JSON.stringify({ items }) }],
    stop_reason: 'end_turn',
  };
  return jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
}

describe('extractFoodItems', () => {
  it('maps a single mass-unit item to ParsedDescribed with grams', async () => {
    const fetchImpl = fetchReturning([{ food: 'ribeye', quantity: 8, unit: 'oz' }]);
    const out = await extractFoodItems('8 oz ribeye', { apiKey: STUB_KEY, fetchImpl });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      foodText: 'ribeye',
      quantity: 8,
      unit: 'oz',
      grams: 226.8, // 8 * 28.3495 → 226.796 → round1 → 226.8
    });
  });

  it('preserves quantity:null as undefined (honesty: never invented)', async () => {
    const fetchImpl = fetchReturning([
      { food: 'drinks', quantity: null, unit: null },
      { food: 'fries', quantity: null, unit: null },
    ]);
    const out = await extractFoodItems('a few drinks and some fries', { apiKey: STUB_KEY, fetchImpl });
    expect(out).toEqual([{ foodText: 'drinks' }, { foodText: 'fries' }]);
    // No quantity, no unit, no grams — matches parseDescribed("steak").
    expect(out[0].quantity).toBeUndefined();
    expect(out[0].unit).toBeUndefined();
    expect(out[0].grams).toBeUndefined();
  });

  it('keeps non-mass quantifiers without inventing grams', async () => {
    // "2 slices pizza" — the count is real signal but "slice" isn't in MASS_UNITS,
    // so grams stays unknown rather than fabricated.
    const fetchImpl = fetchReturning([{ food: 'pizza', quantity: 2, unit: 'slices' }]);
    const out = await extractFoodItems('two slices of pizza', { apiKey: STUB_KEY, fetchImpl });
    expect(out).toEqual([{ foodText: 'pizza', quantity: 2 }]);
    expect(out[0].grams).toBeUndefined();
    expect(out[0].unit).toBeUndefined();
  });

  it('extracts multiple items from a conversational message', async () => {
    const fetchImpl = fetchReturning([
      { food: 'drinks', quantity: null, unit: null },
      { food: 'burger', quantity: 1, unit: null },
      { food: 'fries', quantity: null, unit: null },
    ]);
    const out = await extractFoodItems(
      'had dinner with friends a few drinks a burger some fries etc.',
      { apiKey: STUB_KEY, fetchImpl }
    );
    expect(out.map((p) => p.foodText)).toEqual(['drinks', 'burger', 'fries']);
    expect(out[1].quantity).toBe(1);
  });

  it('returns [] when the API key is missing (no network call)', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const out = await extractFoodItems('8 oz ribeye', { fetchImpl }); // no apiKey
    expect(out).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns [] on empty / whitespace input without calling fetch', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    expect(await extractFoodItems('', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
    expect(await extractFoodItems('   ', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns [] on HTTP error (so the caller falls back to regex)', async () => {
    const fetchImpl = (jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown) as typeof fetch;
    const out = await extractFoodItems('8 oz ribeye', { apiKey: STUB_KEY, fetchImpl });
    expect(out).toEqual([]);
  });

  it('returns [] on a refusal stop_reason', async () => {
    const fetchImpl = (jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ stop_reason: 'refusal', content: [] }),
    })) as unknown) as typeof fetch;
    const out = await extractFoodItems('something', { apiKey: STUB_KEY, fetchImpl });
    expect(out).toEqual([]);
  });

  it('returns [] on malformed JSON in the text block', async () => {
    const fetchImpl = (jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: 'this is not json' }],
        stop_reason: 'end_turn',
      }),
    })) as unknown) as typeof fetch;
    const out = await extractFoodItems('something', { apiKey: STUB_KEY, fetchImpl });
    expect(out).toEqual([]);
  });

  it('returns [] on a network exception', async () => {
    const fetchImpl = (jest.fn(async () => {
      throw new Error('network down');
    }) as unknown) as typeof fetch;
    const out = await extractFoodItems('something', { apiKey: STUB_KEY, fetchImpl });
    expect(out).toEqual([]);
  });

  it('drops items with empty food strings (defensive against bad model output)', async () => {
    const fetchImpl = fetchReturning([
      { food: '', quantity: 1, unit: null },
      { food: 'burger', quantity: 1, unit: null },
      { food: '   ', quantity: null, unit: null },
    ]);
    const out = await extractFoodItems('one burger', { apiKey: STUB_KEY, fetchImpl });
    expect(out.map((p) => p.foodText)).toEqual(['burger']);
  });

  it('passes a stable system prompt and the trimmed user message', async () => {
    const fetchImpl = fetchReturning([]);
    await extractFoodItems('  one burger  ', { apiKey: STUB_KEY, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [unknown, { body: string }];
    const body = JSON.parse(call[1].body);
    expect(body.model).toBe('claude-haiku-4-5');
    expect(body.messages[0]).toEqual({ role: 'user', content: 'one burger' });
    expect(typeof body.system).toBe('string');
    expect(body.output_config.format.type).toBe('json_schema');
  });
});
