/**
 * fetchJson.ts — the shared GET-with-timeout helper every conditions client
 * uses (extracted from openMeteoClient.ts so the forecast client, F1, reuses
 * it instead of a second copy). An AbortController timeout (~4s by default)
 * chains onto the caller's own signal (anthropicClient pattern). Any
 * failure — network, timeout, non-2xx — is a typed null, never a throw.
 *
 * `headers` (F2) is a passthrough request header map — the NWS client uses
 * it for the User-Agent api.weather.gov's usage policy asks every consumer
 * to identify itself with; every other client leaves it unset.
 */

export interface FetchJsonDeps {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** HTTP method — defaults to GET. POST is used by the route builder's
   *  snapping (Valhalla / Overpass), which is why this helper isn't GET-only. */
  method?: string;
  /** Request body (already-serialized string) for a POST. */
  body?: string;
}

export async function fetchJson(
  url: string,
  deps?: FetchJsonDeps,
  timeoutMs = 4000
): Promise<unknown> {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  if (deps?.signal) {
    if (deps.signal.aborted) controller.abort();
    else deps.signal.addEventListener('abort', onAbort);
  }

  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      ...(deps?.method ? { method: deps.method } : {}),
      ...(deps?.body != null ? { body: deps.body } : {}),
      ...(deps?.headers ? { headers: deps.headers } : {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (deps?.signal) deps.signal.removeEventListener('abort', onAbort);
  }
}
