/**
 * The Proof — resolveTerrainStyle never hands the caller a broken or
 * fabricated style: terrain only lands when a DEM tile URL exists, and any
 * fetch/parse failure (network hiccup, non-2xx, malformed JSON) degrades to
 * the plain style URL string with terrainReady: false rather than throwing
 * or caching a bogus style object. Pure function extracted from the hook
 * precisely so this is testable without React or a real network call.
 */
import { describe, it, expect } from '@jest/globals';
import { resolveTerrainStyle } from '../useTerrainMapStyle';

const STYLE_URL = 'https://api.maptiler.com/maps/outdoor/style.json?key=k';
const TERRAIN_URL = 'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=k';

function fetchImplReturning(body: unknown, ok = true, status = 200): typeof fetch {
  return (() =>
    Promise.resolve({ ok, status, json: () => Promise.resolve(body) })) as unknown as typeof fetch;
}

describe('resolveTerrainStyle', () => {
  it('layers terrain onto the fetched style when a DEM tile URL is given', async () => {
    const result = await resolveTerrainStyle(
      STYLE_URL,
      TERRAIN_URL,
      fetchImplReturning({ version: 8, sources: {}, layers: [] })
    );
    expect(result.terrainReady).toBe(true);
    expect(typeof result.mapStyle).toBe('object');
    expect((result.mapStyle as { terrain?: unknown }).terrain).toBeDefined();
  });

  it('returns the plain fetched style with terrainReady false when there is no DEM tile URL', async () => {
    const result = await resolveTerrainStyle(
      STYLE_URL,
      null,
      fetchImplReturning({ version: 8, sources: {}, layers: [] })
    );
    expect(result.terrainReady).toBe(false);
    expect((result.mapStyle as { terrain?: unknown }).terrain).toBeUndefined();
  });

  it('degrades to the plain style URL string on a non-2xx response', async () => {
    const result = await resolveTerrainStyle(
      STYLE_URL,
      TERRAIN_URL,
      fetchImplReturning({ message: 'Key is not valid' }, false, 401)
    );
    expect(result).toEqual({ mapStyle: STYLE_URL, terrainReady: false });
  });

  it('degrades to the plain style URL string when fetch itself rejects', async () => {
    const fetchImpl = (() => Promise.reject(new Error('network down'))) as unknown as typeof fetch;
    const result = await resolveTerrainStyle(STYLE_URL, TERRAIN_URL, fetchImpl);
    expect(result).toEqual({ mapStyle: STYLE_URL, terrainReady: false });
  });
});
