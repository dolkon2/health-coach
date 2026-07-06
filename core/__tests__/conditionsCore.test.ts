/**
 * The Proof — the pure geometry/time helpers under the conditions freeze (E3):
 *   1. nearestHourIndex picks the honest hourly slot on Open-Meteo's bare
 *      "YYYY-MM-DDTHH:MM" UTC axis — exact hit, nearest between hours, clamped
 *      at both ends, -1 when nothing parses (never a fabricated 0 index for
 *      garbage input).
 *   2. pointInMultiPolygon reads REAL avalanche.org zone geometry (GeoJSON
 *      [lng, lat] order): Mt Hood's trailhead is inside the Mt Hood zone,
 *      Portland is inside none, and a point in Newberry's multi-ring
 *      MultiPolygon (75-pt outer ring + hole rings) still resolves — the
 *      even-odd rule handles rings without special-casing.
 *   3. haversineKm agrees with the app's single haversine (it IS the same
 *      function scaled) — no second distance implementation to drift.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { nearestHourIndex } from '../src/conditions';
import { haversineKm, haversineM, pointInMultiPolygon } from '../src/geo';

const FX = join(__dirname, '..', '..', 'src', 'lib', 'conditions', '__fixtures__');

interface MapLayer {
  features: Array<{
    id: number;
    geometry: { type: string; coordinates: unknown };
  }>;
}
const mapLayer = JSON.parse(
  readFileSync(join(FX, 'avalanche-map-layer-trimmed.json'), 'utf8')
) as MapLayer;

/** A feature's rings as MultiPolygon coordinates (Polygon wraps to one). */
function polysOf(id: number): number[][][][] {
  const f = mapLayer.features.find((x) => x.id === id)!;
  return f.geometry.type === 'Polygon'
    ? [f.geometry.coordinates as number[][][]]
    : (f.geometry.coordinates as number[][][][]);
}

describe('nearestHourIndex', () => {
  const times = ['2026-07-02T00:00', '2026-07-02T01:00', '2026-07-02T02:00', '2026-07-02T03:00'];

  it('hits an exact hour', () => {
    expect(nearestHourIndex(times, '2026-07-02T02:00:00Z')).toBe(2);
  });

  it('picks the nearer neighbour between hours', () => {
    expect(nearestHourIndex(times, '2026-07-02T01:20:00Z')).toBe(1);
    expect(nearestHourIndex(times, '2026-07-02T01:40:00Z')).toBe(2);
  });

  it('clamps to the ends of the axis', () => {
    expect(nearestHourIndex(times, '2026-07-01T10:00:00Z')).toBe(0);
    expect(nearestHourIndex(times, '2026-07-03T09:00:00Z')).toBe(3);
  });

  it('returns -1 for an empty axis or an unparsable instant', () => {
    expect(nearestHourIndex([], '2026-07-02T02:00:00Z')).toBe(-1);
    expect(nearestHourIndex(times, 'not-a-time')).toBe(-1);
  });
});

describe('pointInMultiPolygon (real avalanche.org zone geometry, [lng,lat] order)', () => {
  it('finds the Mt Hood trailhead inside the Mt Hood zone (Polygon wrapped)', () => {
    expect(pointInMultiPolygon(45.37, -121.7, polysOf(1657))).toBe(true);
  });

  it('leaves Portland outside the Mt Hood zone', () => {
    expect(pointInMultiPolygon(45.52, -122.68, polysOf(1657))).toBe(false);
  });

  it('resolves a point inside Newberry’s multi-ring MultiPolygon', () => {
    // Inside the 75-point outer ring, clear of the hole rings.
    expect(pointInMultiPolygon(43.72, -121.22, polysOf(2471))).toBe(true);
    // Portland is in none of Newberry's rings either.
    expect(pointInMultiPolygon(45.52, -122.68, polysOf(2471))).toBe(false);
  });

  it('handles a plain MultiPolygon zone (Southern Oregon)', () => {
    expect(pointInMultiPolygon(42.94, -122.1, polysOf(1369))).toBe(true);
  });
});

describe('haversineKm', () => {
  it('is exactly the single haversine, scaled — no second implementation', () => {
    const a = { lat: 45.37, lng: -121.7 };
    const b = { lat: 45.32097, lng: -121.7158 };
    expect(haversineKm(a, b)).toBe(haversineM(a, b) / 1000);
    expect(haversineKm(a, b)).toBeGreaterThan(5.4);
    expect(haversineKm(a, b)).toBeLessThan(5.8);
  });
});
