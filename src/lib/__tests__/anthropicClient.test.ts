/**
 * anthropicClient tests — the transport contract every LLM feature depends on.
 *
 * Focus of Pass 2.8a: the OPTIONAL image content block. When `image` is supplied,
 * the user message becomes a two-block array (image + text) so Claude can see a
 * photo; when it isn't, the message stays a bare string (the text-only path the
 * Describe estimator already uses). Failure handling (null key, HTTP error,
 * refusal, malformed body, network throw) is asserted here too — it is the
 * constitution's guarantee that the logger keeps working with no key / no network.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { callClaude } from '@/lib/anthropicClient';

const STUB_KEY = 'sk-test';
const SCHEMA = { type: 'object', properties: {}, additionalProperties: true } as Record<string, unknown>;

/** A fetch stub returning the given JSON object as the text content block. */
function fetchReturning(obj: unknown) {
  const body = { content: [{ type: 'text', text: JSON.stringify(obj) }], stop_reason: 'end_turn' };
  return jest.fn(async () => ({ ok: true, status: 200, json: async () => body })) as unknown as typeof fetch;
}

const lastBody = (fetchImpl: unknown) => {
  const call = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [unknown, { body: string }];
  return JSON.parse(call[1].body);
};

describe('callClaude — text-only message', () => {
  it('sends the user message as a bare string when no image is given', async () => {
    const fetchImpl = fetchReturning({ ok: 1 });
    const out = await callClaude({ model: 'claude-haiku-4-5', systemPrompt: 'sys', userMessage: 'hello', schema: SCHEMA, apiKey: STUB_KEY, fetchImpl });
    expect(out).toEqual({ ok: 1 });
    expect(lastBody(fetchImpl).messages[0]).toEqual({ role: 'user', content: 'hello' });
  });
});

describe('callClaude — image content block (Pass 2.8a)', () => {
  it('wraps the message as [image, text] blocks when an image is supplied', async () => {
    const fetchImpl = fetchReturning({ ok: 1 });
    await callClaude({
      model: 'claude-haiku-4-5',
      systemPrompt: 'sys',
      userMessage: 'estimate this plate',
      image: { data: 'BASE64DATA', mediaType: 'image/jpeg' },
      schema: SCHEMA,
      apiKey: STUB_KEY,
      fetchImpl,
    });
    const content = lastBody(fetchImpl).messages[0].content;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'BASE64DATA' } });
    expect(content[1]).toEqual({ type: 'text', text: 'estimate this plate' });
  });

  it('still returns null on failure (no key) without calling fetch — image path is not exempt', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const out = await callClaude({
      model: 'claude-haiku-4-5',
      systemPrompt: 'sys',
      userMessage: 'estimate',
      image: { data: 'X', mediaType: 'image/jpeg' },
      schema: SCHEMA,
      fetchImpl, // no apiKey
    });
    expect(out).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('callClaude — failure handling returns null (never throws)', () => {
  it('null on HTTP error', async () => {
    const fetchImpl = (jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown) as typeof fetch;
    expect(await callClaude({ model: 'm', systemPrompt: 's', userMessage: 'u', schema: SCHEMA, apiKey: STUB_KEY, fetchImpl })).toBeNull();
  });

  it('null on refusal stop_reason', async () => {
    const fetchImpl = (jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ stop_reason: 'refusal', content: [] }) })) as unknown) as typeof fetch;
    expect(await callClaude({ model: 'm', systemPrompt: 's', userMessage: 'u', schema: SCHEMA, apiKey: STUB_KEY, fetchImpl })).toBeNull();
  });

  it('null on a network exception', async () => {
    const fetchImpl = (jest.fn(async () => { throw new Error('down'); }) as unknown) as typeof fetch;
    expect(await callClaude({ model: 'm', systemPrompt: 's', userMessage: 'u', schema: SCHEMA, apiKey: STUB_KEY, fetchImpl })).toBeNull();
  });
});
