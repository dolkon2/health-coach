import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import { routePathD } from '../RoutePreview';

const pt = (lat: number, lng: number): GeoPoint => ({ lat, lng, tsSec: 0 });

describe('routePathD', () => {
  it('projects a route into a path that fits the padded viewBox', () => {
    const d = routePathD([pt(45.5, -122.6), pt(45.51, -122.59), pt(45.52, -122.6)]);
    expect(d).not.toBeNull();
    expect(d!.startsWith('M')).toBe(true);
    expect(d!.split('L')).toHaveLength(3); // M + 2 L segments

    // Every coordinate stays inside the 100×56 box (with 6px padding).
    const nums = d!.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i]).toBeGreaterThanOrEqual(6);
      expect(nums[i]).toBeLessThanOrEqual(94);
      expect(nums[i + 1]).toBeGreaterThanOrEqual(6);
      expect(nums[i + 1]).toBeLessThanOrEqual(50);
    }
  });

  it('north is up: the northernmost point gets the smallest y', () => {
    const d = routePathD([pt(45.0, -122.0), pt(46.0, -122.0)])!;
    const [first, second] = d.split(' L');
    const y0 = Number(first.replace('M', '').split(' ')[1]);
    const y1 = Number(second.split(' ')[1]);
    expect(y1).toBeLessThan(y0); // second point is further north → higher on screen
  });

  it('returns null for undrawable input: too few or identical points', () => {
    expect(routePathD([])).toBeNull();
    expect(routePathD([pt(45, -122)])).toBeNull();
    expect(routePathD([pt(45, -122), pt(45, -122), pt(45, -122)])).toBeNull();
  });

  it('thins very long routes but keeps the endpoint', () => {
    const long = Array.from({ length: 5000 }, (_, i) => pt(45 + i * 0.0001, -122));
    const d = routePathD(long)!;
    const segments = d.split('L').length;
    expect(segments).toBeLessThanOrEqual(402);
    // Endpoint survives: last y is the minimum (northernmost).
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const ys = nums.filter((_, i) => i % 2 === 1);
    expect(ys[ys.length - 1]).toBe(Math.min(...ys));
  });
});
