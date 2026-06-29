/**
 * anthropicClient.ts — thin fetch-based helper for Anthropic Messages API calls.
 *
 * Used by feature modules that need an LLM (foodNLP.ts today; a landing pad
 * for future features). Each feature owns its own model choice, system prompt,
 * and output JSON schema — this module is purely transport.
 *
 * Returns `null` on any failure (missing key, no network, timeout, HTTP error,
 * model refusal, malformed/empty model output) so the caller can fall back.
 * Never throws. The fallback path is the constitution: the logger must keep
 * working without network or a key.
 *
 * Uses Anthropic's structured-outputs schema enforcement
 * (`output_config.format = json_schema`) so the caller gets validated JSON or
 * `null`; no client-side schema validation is needed.
 */
import { ANTHROPIC_API_KEY } from './config';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface CallClaudeOptions {
  /** Model ID, e.g. 'claude-haiku-4-5'. Caller chooses per-feature. */
  model: string;
  /** Stable instructions for the model (the "what to do" part). */
  systemPrompt: string;
  /** The variable per-call input (e.g. the user's described meal). */
  userMessage: string;
  /** JSON Schema the model's output is constrained to match. */
  schema: Record<string, unknown>;
  /** Hard ceiling on output tokens. Default 512 — schema-bounded JSON is small. */
  maxTokens?: number;
  /** Default 4000ms. First call after a schema change pays a one-time compile. */
  timeoutMs?: number;
  /** Injectable for tests (mirrors foodSearch.ts's pattern). Defaults to the
   *  module-level ANTHROPIC_API_KEY; tests pass a stub here. */
  apiKey?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Caller-supplied cancellation (e.g. screen unmount). */
  signal?: AbortSignal;
}

interface ApiResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
}

/**
 * Call Claude with a structured-output schema. Returns the parsed JSON object
 * matching the schema, or `null` on any failure. Never throws.
 */
export async function callClaude<T = unknown>(opts: CallClaudeOptions): Promise<T | null> {
  const apiKey = opts.apiKey ?? ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Chain the caller's signal so either source can cancel.
  const onAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onAbort);
  }

  try {
    const res = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 512,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: opts.userMessage }],
        output_config: {
          format: { type: 'json_schema', schema: opts.schema },
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const body = (await res.json()) as ApiResponse;
    if (body.stop_reason === 'refusal') return null;

    // output_config.format guarantees the JSON arrives in a text content block.
    const text = body.content?.find((b) => b.type === 'text')?.text;
    if (!text) return null;

    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
  }
}
