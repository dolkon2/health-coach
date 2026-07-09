/**
 * The Proof — locationToCragPin is a bare lat/lng lift, no elevation/timestamp
 * fabrication (a crag pin is a point, not a GeoPoint — no eleSource/tsSec
 * claims belong on it). Pure function extracted from the hook precisely so
 * this is testable without the native expo-location module or React, same
 * pattern as useGpsTracker's locationToGeoPoint.
 */
import { describe, it, expect } from '@jest/globals';
import { locationToCragPin } from '../useCragPin';

describe('locationToCragPin', () => {
  it('maps a fix to a bare lat/lng pin', () => {
    expect(
      locationToCragPin({ coords: { latitude: 45.5, longitude: -122.6 } })
    ).toEqual({ lat: 45.5, lng: -122.6 });
  });

  it('carries 0,0 as real coordinates, not absence (null ≠ 0)', () => {
    const p = locationToCragPin({ coords: { latitude: 0, longitude: 0 } });
    expect(p).toEqual({ lat: 0, lng: 0 });
  });
});
