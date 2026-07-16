/**
 * locationToLngLat is a bare coordinate-order flip ([lat,lng] fix →
 * [lng,lat] tuple, the MapLibre convention) — extracted from the hook so
 * it's testable without the native expo-location module or React, same
 * pattern as useCragPin's locationToCragPin.
 */
import { describe, it, expect } from '@jest/globals';
import { locationToLngLat } from '../useLiveLocation';

describe('locationToLngLat', () => {
  it('flips a fix into a [lng, lat] tuple', () => {
    expect(locationToLngLat({ coords: { latitude: 45.5, longitude: -122.6 } })).toEqual([
      -122.6, 45.5,
    ]);
  });

  it('carries 0,0 as real coordinates, not absence (null ≠ 0)', () => {
    expect(locationToLngLat({ coords: { latitude: 0, longitude: 0 } })).toEqual([0, 0]);
  });
});
