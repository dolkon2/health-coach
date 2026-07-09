import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import type { SkySegment } from '@core/observation';
import { totalAirtimeSec, airSegmentCount, longestAirSegmentSec } from '../skySegmentStats';

function track(n: number): GeoPoint[] {
  return Array.from({ length: n }, (_, i) => ({ lat: 0, lng: 0, tsSec: i }));
}

const seg = (kind: SkySegment['kind'], startIdx: number, endIdx: number): SkySegment => ({
  kind,
  startIdx,
  endIdx,
  provenance: 'auto',
});

describe('totalAirtimeSec', () => {
  it('sums only air segments', () => {
    const pts = track(300);
    const segs = [seg('ground', 0, 49), seg('air', 50, 149), seg('ground', 150, 199), seg('air', 200, 299)];
    expect(totalAirtimeSec(pts, segs)).toBe(99 + 99);
  });

  it('is a legitimate 0 (not absent) when there are no air segments', () => {
    const pts = track(100);
    expect(totalAirtimeSec(pts, [seg('ground', 0, 99)])).toBe(0);
  });
});

describe('airSegmentCount', () => {
  it('counts air segments only', () => {
    const segs = [seg('ground', 0, 9), seg('air', 10, 19), seg('ground', 20, 29), seg('air', 30, 39)];
    expect(airSegmentCount(segs)).toBe(2);
  });
});

describe('longestAirSegmentSec', () => {
  it('returns the longest air segment duration', () => {
    const pts = track(300);
    const segs = [seg('air', 0, 49), seg('ground', 50, 99), seg('air', 100, 249)];
    expect(longestAirSegmentSec(pts, segs)).toBe(149);
  });

  it('is undefined (not 0) when there are no air segments', () => {
    const pts = track(100);
    expect(longestAirSegmentSec(pts, [seg('ground', 0, 99)])).toBeUndefined();
  });
});
