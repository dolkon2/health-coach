import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import { elevationProfile } from '../elevationProfile';

const p = (over: Partial<GeoPoint>): GeoPoint => ({ lat: 0, lng: 0, tsSec: 0, ...over });

describe('elevationProfile', () => {
  it('pairs cumulative distance with elevation for each fix that has it', () => {
    // Three fixes along the equator, ~1.11 km apart per 0.01° of longitude.
    const prof = elevationProfile([
      p({ lng: 0, eleM: 100 }),
      p({ lng: 0.01, eleM: 130 }),
      p({ lng: 0.02, eleM: 120 }),
    ]);
    expect(prof).not.toBeNull();
    expect(prof!).toHaveLength(3);
    expect(prof![0]).toEqual({ distM: 0, eleM: 100 });
    // cumulative distance strictly increases with each hop
    expect(prof![1].distM).toBeGreaterThan(prof![0].distM);
    expect(prof![2].distM).toBeGreaterThan(prof![1].distM);
    // two hops of ~1.11 km each
    expect(prof![2].distM).toBeGreaterThan(2000);
    expect(prof![2].distM).toBeLessThan(2300);
  });

  it('advances distance across elevation-less fixes but samples only where ele exists', () => {
    const prof = elevationProfile([
      p({ lng: 0, eleM: 100 }),
      p({ lng: 0.01 }), // no ele — advances distance, emits no sample
      p({ lng: 0.02, eleM: 140 }),
    ]);
    expect(prof!).toHaveLength(2);
    expect(prof![0].eleM).toBe(100);
    expect(prof![1].eleM).toBe(140);
    // the second sample's distance reflects BOTH hops (~2.22 km), not just one
    expect(prof![1].distM).toBeGreaterThan(2000);
  });

  it('is absent (null) when no fix carries elevation — null ≠ 0', () => {
    expect(elevationProfile([p({ lng: 0 }), p({ lng: 0.01 })])).toBeNull();
  });

  it('is absent when only a single fix carries elevation (nothing to draw)', () => {
    expect(elevationProfile([p({ lng: 0, eleM: 100 }), p({ lng: 0.01 })])).toBeNull();
  });

  it('is absent for a track with fewer than two fixes', () => {
    expect(elevationProfile([p({ eleM: 100 })])).toBeNull();
    expect(elevationProfile([])).toBeNull();
  });
});
