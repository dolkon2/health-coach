/**
 * Synoptic client — no-token path. A separate file (jest.mock('@/lib/config')
 * is per-module and hoisted, so this can't share synopticClient.test.ts):
 * with no token configured, the client must return null WITHOUT firing a
 * request at all — zero cost against the free-tier budget, same rule as
 * config.ts's mapTilerUrl.
 */
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/lib/config', () => ({ SYNOPTIC_TOKEN: null }));

import { fetchSynopticObservation } from '@/lib/conditions/synopticClient';

describe('fetchSynopticObservation — no token configured', () => {
  it('returns null without calling fetch', async () => {
    const impl = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const out = await fetchSynopticObservation(45.0, -121.0, {
      fetchImpl: impl as unknown as typeof fetch,
    });
    expect(out).toBeNull();
    expect(impl).not.toHaveBeenCalled();
  });
});
