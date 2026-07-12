/**
 * routeDistanceM tests — the plotted-line distance is a pure haversine fold,
 * "distance as plotted" (Strava Manual Mode's honesty framing), never a
 * fabricated measurement for undrawable input.
 */
import { describe, it, expect } from '@jest/globals';
import { routeDistanceM, type RoutePoint } from '@core/route';

describe('routeDistanceM', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(routeDistanceM([])).toBe(0);
    expect(routeDistanceM([{ lat: 45, lng: -122 }])).toBe(0);
  });

  it('returns 0 for identical points (no movement)', () => {
    const pts: RoutePoint[] = [
      { lat: 45.7, lng: -121.5 },
      { lat: 45.7, lng: -121.5 },
    ];
    expect(routeDistanceM(pts)).toBe(0);
  });

  it('sums consecutive-leg haversine distance (~111 m per 0.001° lat)', () => {
    const pts: RoutePoint[] = [
      { lat: 45.7, lng: -121.5 },
      { lat: 45.701, lng: -121.5 },
      { lat: 45.702, lng: -121.5 },
    ];
    const d = routeDistanceM(pts);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(230);
  });

  it('ignores eleM — plotted distance is point-to-point, not slope-corrected', () => {
    const flat: RoutePoint[] = [
      { lat: 45.7, lng: -121.5 },
      { lat: 45.701, lng: -121.5 },
    ];
    const withEle: RoutePoint[] = [
      { lat: 45.7, lng: -121.5, eleM: 100 },
      { lat: 45.701, lng: -121.5, eleM: 500 },
    ];
    expect(routeDistanceM(withEle)).toBeCloseTo(routeDistanceM(flat));
  });
});
