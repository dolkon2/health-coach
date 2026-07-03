import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import { summarizeTrack } from '../gpsTrack';

const p = (over: Partial<GeoPoint>): GeoPoint => ({ lat: 0, lng: 0, tsSec: 0, ...over });

describe('summarizeTrack', () => {
  it('sums haversine distance over consecutive fixes', () => {
    // three fixes a degree of longitude apart at the equator ≈ 2 × 111 km
    const s = summarizeTrack([
      p({ lat: 0, lng: 0, tsSec: 100 }),
      p({ lat: 0, lng: 1, tsSec: 200 }),
      p({ lat: 0, lng: 2, tsSec: 300 }),
    ]);
    expect(s.distanceM).toBeGreaterThan(222_000);
    expect(s.distanceM).toBeLessThan(222_600);
    expect(s.pointCount).toBe(3);
  });

  it('derives duration and start time from the fix timestamps', () => {
    const s = summarizeTrack([p({ tsSec: 1_000 }), p({ lat: 0.01, tsSec: 1_600 })]);
    expect(s.durationSec).toBe(600);
    expect(s.startTime).toBe(new Date(1_000_000).toISOString());
  });

  it('reports zero duration and no start time when the fixes are untimed', () => {
    const s = summarizeTrack([p({ lat: 0 }), p({ lat: 0.01 })]);
    expect(s.durationSec).toBe(0);
    expect(s.startTime).toBeUndefined();
  });

  it('surfaces elevation gain when altitude is present, absent otherwise', () => {
    expect(summarizeTrack([p({ eleM: 10 }), p({ lat: 0.01, eleM: 20 })]).elevationGainM).toBe(10);
    expect(summarizeTrack([p({ lat: 0 }), p({ lat: 0.01 })]).elevationGainM).toBeUndefined();
  });

  it('thins stored geometry but still counts every captured fix', () => {
    const pts = Array.from({ length: 9000 }, (_, i) => p({ lat: i * 0.0001, tsSec: i }));
    const s = summarizeTrack(pts);
    expect(s.pointCount).toBe(9000);
    expect(s.points.length).toBeLessThanOrEqual(4000);
  });
});
