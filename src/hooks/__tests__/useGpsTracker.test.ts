/**
 * The Proof — the live-capture fix→GeoPoint mapping labels elevation honestly (E2):
 *   1. A fix WITH altitude yields eleM plus eleSource 'gps' (⚑ E-9: phone fixes
 *      are GPS-derived; we never claim barometric the platform didn't declare).
 *   2. A fix WITHOUT altitude yields NEITHER key — absence is honest; 'none' is
 *      never written at capture time, and no fabricated 0 appears (null ≠ 0).
 *   3. The timestamp maps ms-epoch → whole tsSec (existing semantics, ⚑ E-1:
 *      stored payloads stay Unix epoch — untouched here).
 * Pure function extracted from the hook precisely so this is testable without
 * the native expo-location module or React.
 */
import { describe, it, expect } from '@jest/globals';
import { locationToGeoPoint } from '../useGpsTracker';

describe('locationToGeoPoint', () => {
  it('maps a fix with altitude to eleM + eleSource gps', () => {
    const p = locationToGeoPoint({
      coords: { latitude: 45.5, longitude: -122.6, altitude: 123.4 },
      timestamp: 1_782_921_600_500, // ms — floors to whole seconds
    });
    expect(p).toEqual({
      lat: 45.5,
      lng: -122.6,
      tsSec: 1_782_921_600,
      eleM: 123.4,
      eleSource: 'gps',
    });
  });

  it('omits BOTH eleM and eleSource when the fix has no altitude', () => {
    const p = locationToGeoPoint({
      coords: { latitude: 45.5, longitude: -122.6, altitude: null },
      timestamp: 1_782_921_600_000,
    });
    expect(p).toEqual({ lat: 45.5, lng: -122.6, tsSec: 1_782_921_600 });
    expect('eleM' in p).toBe(false);
    expect('eleSource' in p).toBe(false); // never 'none' on write
  });

  it('altitude 0 is a captured reading, not absence (null ≠ 0)', () => {
    const p = locationToGeoPoint({
      coords: { latitude: 0, longitude: 0, altitude: 0 },
      timestamp: 1_000,
    });
    expect(p.eleM).toBe(0);
    expect(p.eleSource).toBe('gps');
  });
});
