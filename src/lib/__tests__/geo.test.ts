import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import { haversineM, elevationGainM, thinTrack } from '../geo';

const p = (over: Partial<GeoPoint>): GeoPoint => ({ lat: 0, lng: 0, tsSec: 0, ...over });

describe('haversineM', () => {
  it('measures ~111 km for one degree of longitude at the equator', () => {
    const d = haversineM(p({ lat: 0, lng: 0 }), p({ lat: 0, lng: 1 }));
    expect(d).toBeGreaterThan(111_100);
    expect(d).toBeLessThan(111_300);
  });

  it('is zero for identical points', () => {
    expect(haversineM(p({ lat: 45, lng: -122 }), p({ lat: 45, lng: -122 }))).toBe(0);
  });
});

describe('elevationGainM', () => {
  it('accumulates climbs past the 3 m threshold and ignores jitter', () => {
    const gain = elevationGainM([
      p({ eleM: 100 }),
      p({ eleM: 101 }), // +1 from ref, below threshold — ignored
      p({ eleM: 105 }), // +5 from ref — counts, ref → 105
      p({ eleM: 104 }), // -1, ignored
      p({ eleM: 110 }), // +5 from ref — counts, ref → 110
    ]);
    expect(gain).toBe(10);
  });

  it('is absent (undefined) when no point carries elevation', () => {
    expect(elevationGainM([p({ lat: 0 }), p({ lat: 1 })])).toBeUndefined();
  });
});

describe('thinTrack', () => {
  it('leaves a short track untouched', () => {
    const pts = Array.from({ length: 100 }, (_, i) => p({ lat: i * 0.001, tsSec: i }));
    expect(thinTrack(pts)).toHaveLength(100);
  });

  it('caps a long track at ≤ 4000 points and keeps the final fix', () => {
    const pts = Array.from({ length: 9000 }, (_, i) => p({ lat: i * 0.0001, tsSec: i }));
    const thinned = thinTrack(pts);
    expect(thinned.length).toBeLessThanOrEqual(4000);
    expect(thinned[thinned.length - 1]).toBe(pts[pts.length - 1]);
  });
});
