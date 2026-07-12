import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import { routePathD, routeGuidePathsD } from '../RoutePreview';

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

describe('routeGuidePathsD (route-follow, routes-spec M4)', () => {
  it('projects both lines against ONE shared bounding box, not two independent ones', () => {
    // The live trace covers a small sub-range of the guide route's span.
    const guide = [pt(45.0, -122.0), pt(46.0, -122.0)];
    const live = [pt(45.4, -122.0), pt(45.6, -122.0)];
    const { live: liveD, guide: guideD } = routeGuidePathsD(live, guide);
    expect(liveD).not.toBeNull();
    expect(guideD).not.toBeNull();

    // Under an INDEPENDENT projection, live's own tiny span would stretch to
    // fill the full viewBox height (its start near y=6, end near y=50) — the
    // whole point of a shared bbox is that it does NOT: live only occupies
    // the middle fraction of the guide's full range.
    const liveNums = liveD!.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const liveYs = liveNums.filter((_, i) => i % 2 === 1);
    expect(Math.min(...liveYs)).toBeGreaterThan(10); // well short of the top pad
    expect(Math.max(...liveYs)).toBeLessThan(46); // well short of the bottom pad
  });

  it('returns the live line even with no guide, and vice versa', () => {
    const live = [pt(45.0, -122.0), pt(45.01, -122.0)];
    const onlyLive = routeGuidePathsD(live, []);
    expect(onlyLive.live).not.toBeNull();
    expect(onlyLive.guide).toBeNull();

    const onlyGuide = routeGuidePathsD([], live);
    expect(onlyGuide.live).toBeNull();
    expect(onlyGuide.guide).not.toBeNull();
  });

  it('both null when neither side has ≥2 points', () => {
    expect(routeGuidePathsD([], [])).toEqual({ live: null, guide: null });
    expect(routeGuidePathsD([pt(45, -122)], [pt(46, -122)])).toEqual({
      live: null,
      guide: null,
    });
  });
});
