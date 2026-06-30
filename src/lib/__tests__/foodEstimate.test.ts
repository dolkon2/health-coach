/**
 * foodEstimate tests — estimateMeal against a mocked fetch, plus the keyless
 * FoodItem builder. Verifies the contract Describe mode will depend on:
 *   - well-formed estimation → array of EstimatedFoodItem (segmented + estimated);
 *   - null macros survive the LLM boundary (honesty: null ≠ 0, never invented);
 *   - any failure (no key, HTTP error, malformed body, refusal, empty input,
 *     network exception) returns [] so the caller falls back to regex;
 *   - the builder emits a KEYLESS item (no sourceDb/foodId), quantityMethod
 *     'estimated', and a LOW/MID fidelity that never reads as measured.
 */
import { describe, it, expect, jest } from '@jest/globals';
import {
  estimateMeal,
  estimatedItemToFoodItem,
  ESTIMATOR_MODEL,
  type EstimatedFoodItem,
} from '@/lib/foodEstimate';
import { tierOf } from '@core/nutrition/fidelity';

const STUB_KEY = 'sk-test';

/** A full estimated item with sensible defaults; override per test. */
const est = (over: Partial<EstimatedFoodItem> = {}): EstimatedFoodItem => ({
  name: 'scrambled eggs',
  kcal: 180,
  proteinG: 12,
  carbsG: 1,
  fatG: 13,
  portionText: '2 eggs',
  estimatedGrams: 100,
  portionStated: true,
  basis: '2 large eggs, pan-fried',
  ...over,
});

/** Build a fetch stub that returns the given items as the JSON content block. */
function fetchReturning(items: EstimatedFoodItem[]) {
  const body = {
    content: [{ type: 'text', text: JSON.stringify({ items }) }],
    stop_reason: 'end_turn',
  };
  return jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
}

describe('estimateMeal', () => {
  it('maps a single estimated item through, trimming the name', async () => {
    const fetchImpl = fetchReturning([est({ name: '  scrambled eggs  ' })]);
    const out = await estimateMeal('two eggs', { apiKey: STUB_KEY, fetchImpl });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('scrambled eggs');
    expect(out[0].kcal).toBe(180);
    expect(out[0].portionStated).toBe(true);
  });

  it('segments and estimates multiple foods from one phrase', async () => {
    const fetchImpl = fetchReturning([
      est({ name: 'scrambled eggs' }),
      est({ name: 'sourdough toast', kcal: 120, proteinG: 4, carbsG: 22, fatG: 1, portionText: '1 slice' }),
    ]);
    const out = await estimateMeal('two eggs and a slice of toast', { apiKey: STUB_KEY, fetchImpl });
    expect(out.map((i) => i.name)).toEqual(['scrambled eggs', 'sourdough toast']);
    expect(out[1].carbsG).toBe(22);
  });

  it('preserves null macros across the LLM boundary (null ≠ 0, never invented)', async () => {
    const fetchImpl = fetchReturning([
      est({ name: 'mystery stew', kcal: 300, proteinG: null, carbsG: null, fatG: null, portionStated: false, estimatedGrams: null }),
    ]);
    const out = await estimateMeal('some kind of stew', { apiKey: STUB_KEY, fetchImpl });
    expect(out[0].proteinG).toBeNull();
    expect(out[0].carbsG).toBeNull();
    expect(out[0].proteinG).not.toBe(0);
  });

  it('drops items with empty names (defensive against bad model output)', async () => {
    const fetchImpl = fetchReturning([est({ name: '' }), est({ name: 'burger' }), est({ name: '   ' })]);
    const out = await estimateMeal('a burger', { apiKey: STUB_KEY, fetchImpl });
    expect(out.map((i) => i.name)).toEqual(['burger']);
  });

  it('returns [] when the API key is missing (no network call)', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const out = await estimateMeal('two eggs', { fetchImpl }); // no apiKey
    expect(out).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns [] on empty / whitespace input without calling fetch', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    expect(await estimateMeal('', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
    expect(await estimateMeal('   ', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns [] on HTTP error (caller falls back to regex)', async () => {
    const fetchImpl = (jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown) as typeof fetch;
    expect(await estimateMeal('two eggs', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
  });

  it('returns [] on a refusal stop_reason', async () => {
    const fetchImpl = (jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ stop_reason: 'refusal', content: [] }),
    })) as unknown) as typeof fetch;
    expect(await estimateMeal('two eggs', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
  });

  it('returns [] on malformed JSON in the text block', async () => {
    const fetchImpl = (jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'not json' }], stop_reason: 'end_turn' }),
    })) as unknown) as typeof fetch;
    expect(await estimateMeal('two eggs', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
  });

  it('returns [] on a network exception', async () => {
    const fetchImpl = (jest.fn(async () => {
      throw new Error('network down');
    }) as unknown) as typeof fetch;
    expect(await estimateMeal('two eggs', { apiKey: STUB_KEY, fetchImpl })).toEqual([]);
  });

  it('calls the estimator model with the schema, system prompt, and trimmed message', async () => {
    const fetchImpl = fetchReturning([]);
    await estimateMeal('  two eggs and toast  ', { apiKey: STUB_KEY, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [unknown, { body: string }];
    const body = JSON.parse(call[1].body);
    expect(body.model).toBe(ESTIMATOR_MODEL);
    expect(body.messages[0]).toEqual({ role: 'user', content: 'two eggs and toast' });
    expect(typeof body.system).toBe('string');
    expect(body.output_config.format.type).toBe('json_schema');
  });
});

describe('estimatedItemToFoodItem — keyless, honest, never measured', () => {
  it('builds a keyless item: no sourceDb / foodId, quantityMethod estimated', () => {
    const item = estimatedItemToFoodItem(est());
    expect(item.foodId).toBeUndefined();
    expect(item.sourceDb).toBeUndefined();
    expect(item.quantityMethod).toBe('estimated');
    expect(item.description).toBe('scrambled eggs');
    expect(item.portionText).toBe('2 eggs');
    expect(item.quantity).toBe(100); // from estimatedGrams
  });

  it('a stated portion lands MID — but never HIGH', () => {
    const item = estimatedItemToFoodItem(est({ portionStated: true }));
    expect(tierOf(item.fidelity)).toBe('MID');
    expect(tierOf(item.fidelity)).not.toBe('HIGH');
  });

  it('a vague portion lands LOW', () => {
    const item = estimatedItemToFoodItem(est({ portionStated: false }));
    expect(tierOf(item.fidelity)).toBe('LOW');
  });

  it('falls back to a nominal portion when grams are unknown, and preserves null macros', () => {
    const item = estimatedItemToFoodItem(
      est({ estimatedGrams: null, proteinG: null, carbsG: null, fatG: null, portionText: null })
    );
    expect(item.quantity).toBe(100); // DEFAULT_PORTION_G nominal — LOW fidelity carries the uncertainty
    expect(item.proteinG).toBeNull();
    expect(item.proteinG).not.toBe(0);
    expect(item).not.toHaveProperty('portionText'); // omitted when null, never an empty string
  });
});
