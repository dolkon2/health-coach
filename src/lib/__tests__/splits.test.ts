import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import { splits } from '../splits';

/**
 * A constant-speed track along the equator: each 0.001° of longitude is
 * ~111.19 m, and each hop takes `stepSec`. `count` hops → count+1 fixes.
 */
function equatorTrack(count: number, stepSec = 10): GeoPoint[] {
  return Array.from({ length: count + 1 }, (_, i) => ({
    lat: 0,
    lng: i * 0.001,
    tsSec: 100 + i * stepSec,
  }));
}

describe('splits', () => {
  it('cuts a timed track into full km splits plus a trailing partial', () => {
    // 25 hops ≈ 2.78 km → two full km + a ~0.78 km remainder.
    const rows = splits(equatorTrack(25), 'km')!;
    expect(rows).not.toBeNull();
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.index)).toEqual([1, 2, 3]);

    const full = rows.filter((r) => !r.isPartial);
    expect(full).toHaveLength(2);
    // Full splits are exactly one unit long by construction.
    expect(full[0].distanceM).toBe(1000);
    expect(full[1].distanceM).toBe(1000);

    // Constant speed → equal per-km durations, and pace == time for a full split.
    expect(full[0].durationSec).toBeCloseTo(full[1].durationSec, 0);
    expect(full[0].paceSecPerUnit).toBeCloseTo(full[0].durationSec, 5);

    const partial = rows[2];
    expect(partial.isPartial).toBe(true);
    expect(partial.distanceM).toBeGreaterThan(750);
    expect(partial.distanceM).toBeLessThan(810);
    // Same speed, so the projected pace matches the full splits.
    expect(partial.paceSecPerUnit).toBeCloseTo(full[0].paceSecPerUnit, 0);
  });

  it('reports fewer, longer splits in miles than in km for the same track', () => {
    const track = equatorTrack(25); // ~2.78 km ≈ 1.73 mi
    const km = splits(track, 'km')!;
    const mi = splits(track, 'mi')!;
    expect(mi.length).toBeLessThan(km.length);
    expect(mi).toHaveLength(2); // one full mile + a partial
    expect(mi[0].isPartial).toBe(false);
    expect(mi[0].distanceM).toBeCloseTo(1609.344, 2);
    expect(mi[1].isPartial).toBe(true);
  });

  it('returns a single partial for a sub-unit track', () => {
    const rows = splits(equatorTrack(4), 'km')!; // ~0.44 km, no full km
    expect(rows).toHaveLength(1);
    expect(rows[0].isPartial).toBe(true);
    expect(rows[0].distanceM).toBeLessThan(1000);
  });

  it('is absent (null) for an untimed track — null ≠ 0', () => {
    const untimed = equatorTrack(25).map((p) => ({ ...p, tsSec: 0 }));
    expect(splits(untimed, 'km')).toBeNull();
  });

  it('is absent when fewer than two fixes are timed', () => {
    expect(splits([{ lat: 0, lng: 0, tsSec: 100 }], 'km')).toBeNull();
    expect(splits([], 'km')).toBeNull();
  });

  it('is absent for a timed but stationary track (no distance)', () => {
    const stationary = Array.from({ length: 5 }, (_, i) => ({
      lat: 45,
      lng: -122,
      tsSec: 100 + i * 10,
    }));
    expect(splits(stationary, 'km')).toBeNull();
  });
});
