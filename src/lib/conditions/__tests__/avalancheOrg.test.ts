/**
 * The Proof — the avalanche freeze is a zone lookup + verbatim mirror (E3),
 * run against REAL map-layer features (trimmed from the live 81-zone
 * response, full geometry kept):
 *   1. The Mt Hood trailhead resolves to zone 1657 with every prop mapped —
 *      including the honest off-season state: danger_level -1 / "no rating"
 *      IS the frozen fact, not a failure.
 *   2. issuedAt/expiresAt are the API's center-local NAIVE strings kept
 *      VERBATIM — no fabricated "Z" suffix (the forecast is frozen WITH its
 *      expiry so staleness is visible forever).
 *   3. A zone with null start/end dates (Southern Oregon) → those keys
 *      absent; a MultiPolygon zone (Newberry, multi-ring) still resolves.
 *   4. A point in no zone (Portland) → null; a failed fetch → null; never a
 *      throw.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fetchAvalancheAt } from '../avalancheOrg';

const FX = join(__dirname, '..', '__fixtures__');
const mapLayer = JSON.parse(
  readFileSync(join(FX, 'avalanche-map-layer-trimmed.json'), 'utf8')
) as unknown;

function stubFetch(body: unknown = mapLayer, ok = true) {
  const fn = jest.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }));
  return fn as unknown as typeof fetch;
}

const NOW = () => new Date('2026-07-05T12:00:00Z');

describe('fetchAvalancheAt', () => {
  it('freezes the Mt Hood zone verbatim — off-season "no rating" is a valid fact', async () => {
    const av = await fetchAvalancheAt(
      { lat: 45.37, lng: -121.7 },
      { fetchImpl: stubFetch(), now: NOW }
    );
    expect(av).toEqual({
      tier: 3,
      source: 'avalanche.org',
      fetchedAt: '2026-07-05T12:00:00.000Z',
      zoneId: 1657,
      zoneName: 'Mt Hood',
      center: 'Northwest Avalanche Center',
      dangerLevel: -1,
      danger: 'no rating',
      travelAdvice:
        'Watch for signs of unstable snow such as recent avalanches, cracking in the snow, and audible collapsing. Avoid traveling on or under similar slopes.',
      offSeason: true,
      issuedAt: '2026-04-20T01:30:00',
      expiresAt: '2026-10-31T01:30:00',
      link: 'http://www.nwac.us/avalanche-forecast/#/mt-hood',
    });
    // The load-bearing verbatim check: center-local naive strings, no invented zone.
    expect(av?.issuedAt?.endsWith('Z')).toBe(false);
    expect(av?.expiresAt?.endsWith('Z')).toBe(false);
  });

  it('null start/end dates (Southern Oregon) → issuedAt/expiresAt absent', async () => {
    const av = await fetchAvalancheAt(
      { lat: 42.94, lng: -122.1 },
      { fetchImpl: stubFetch(), now: NOW }
    );
    expect(av?.zoneId).toBe(1369);
    expect(av?.zoneName).toBe('Southern Oregon');
    expect(av && 'issuedAt' in av).toBe(false);
    expect(av && 'expiresAt' in av).toBe(false);
  });

  it('resolves a MultiPolygon zone (Newberry, multi-ring geometry)', async () => {
    const av = await fetchAvalancheAt(
      { lat: 43.72, lng: -121.22 },
      { fetchImpl: stubFetch(), now: NOW }
    );
    expect(av?.zoneId).toBe(2471);
    expect(av?.zoneName).toBe('Newberry');
  });

  it('a point in no zone → null (most terrain has no forecast center)', async () => {
    expect(
      await fetchAvalancheAt({ lat: 45.52, lng: -122.68 }, { fetchImpl: stubFetch(), now: NOW })
    ).toBeNull();
  });

  it('HTTP failure or a thrown fetch → null, never a throw', async () => {
    expect(
      await fetchAvalancheAt({ lat: 45.37, lng: -121.7 }, { fetchImpl: stubFetch({}, false) })
    ).toBeNull();
    const boom = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchAvalancheAt({ lat: 45.37, lng: -121.7 }, { fetchImpl: boom })).toBeNull();
  });
});
