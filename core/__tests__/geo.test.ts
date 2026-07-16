/**
 * nearestTo tests — the shared "pick the closest candidate" reduction
 * (F2, extracted from nwsClient.ts/synopticClient.ts's duplicated pick
 * loops). haversineM/haversineKm and pointInMultiPolygon are already
 * exercised indirectly through their many consumers; this covers the one
 * new exported function core itself had no direct test for yet.
 */
import { describe, it, expect } from '@jest/globals';
import { nearestTo } from '@core/geo';

describe('nearestTo', () => {
  it('returns null for an empty candidate list', () => {
    expect(nearestTo({ lat: 45, lng: -121 }, [])).toBeNull();
  });

  it('returns the single candidate with its distance for a one-item list', () => {
    const out = nearestTo({ lat: 45, lng: -121 }, [{ lat: 45, lng: -121 }]);
    expect(out?.item).toEqual({ lat: 45, lng: -121 });
    expect(out?.distanceKm).toBeCloseTo(0, 5);
  });

  it('picks the nearer of several candidates regardless of list order', () => {
    const point = { lat: 45.7, lng: -121.5 };
    const near = { lat: 45.71, lng: -121.51, id: 'near' };
    const far = { lat: 46.5, lng: -122.5, id: 'far' };
    expect(nearestTo(point, [far, near])?.item).toEqual(near);
    expect(nearestTo(point, [near, far])?.item).toEqual(near);
  });
});
