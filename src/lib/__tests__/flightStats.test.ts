import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import {
  elevationDeltaM,
  maxAltitudeM,
  maxClimbRateMS,
  maxDescentM,
  maxSinkRateMS,
  minAltitudeM,
  topSpeedMS,
} from '../flightStats';

const pt = (tsSec: number, lat: number, eleM?: number): GeoPoint =>
  eleM === undefined ? { lat, lng: 0, tsSec } : { lat, lng: 0, tsSec, eleM };

// 1 s cadence on a fixed spot; ele from a function of t.
const climbTrack = (seconds: number, ele: (t: number) => number): GeoPoint[] =>
  Array.from({ length: seconds + 1 }, (_, t) => pt(1000 + t, 45, ele(t)));

describe('maxAltitudeM / minAltitudeM', () => {
  it('returns the extremes over points that carry elevation', () => {
    const pts = [pt(1, 45, 1200), pt(2, 45.001), pt(3, 45.002, 950), pt(4, 45.003, 1430)];
    expect(maxAltitudeM(pts)).toBe(1430);
    expect(minAltitudeM(pts)).toBe(950);
  });

  it('is absent when no point carries elevation', () => {
    const pts = [pt(1, 45), pt(2, 45.001)];
    expect(maxAltitudeM(pts)).toBeUndefined();
    expect(minAltitudeM(pts)).toBeUndefined();
  });
});

describe('maxClimbRateMS / maxSinkRateMS', () => {
  it('reports a steady climb exactly', () => {
    const pts = climbTrack(20, (t) => 2 * t); // 2 m/s
    expect(maxClimbRateMS(pts)).toBeCloseTo(2, 6);
    expect(maxSinkRateMS(pts)).toBeUndefined(); // never descends
  });

  it('reports sink as a positive magnitude', () => {
    const pts = climbTrack(20, (t) => 300 - 3 * t); // −3 m/s
    expect(maxSinkRateMS(pts)).toBeCloseTo(3, 6);
    expect(maxClimbRateMS(pts)).toBeUndefined(); // never climbs
  });

  it('smooths a one-second altitude spike over the window', () => {
    // 1 m/s baseline with a +13 m/s instantaneous blip at t=8.
    const pts = climbTrack(16, (t) => (t === 8 ? 20 : t));
    const r = maxClimbRateMS(pts); // best 8 s window: (20−0)/8
    expect(r).toBeCloseTo(2.5, 6);
    expect(r!).toBeLessThan(3); // the raw 13 m/s blip never surfaces
  });

  it('is absent when the time spread is shorter than the window', () => {
    const pts = climbTrack(4, (t) => 10 * t); // strong climb, only 4 s of it
    expect(maxClimbRateMS(pts, 8)).toBeUndefined();
  });

  it('is absent without elevations or without timestamps', () => {
    const untimed = [pt(0, 45, 100), pt(0, 45.001, 200)]; // tsSec 0 = no fix time
    expect(maxClimbRateMS(untimed)).toBeUndefined();
    const noEle = climbTrack(20, () => 100).map(({ eleM: _e, ...rest }) => rest);
    expect(maxClimbRateMS(noEle)).toBeUndefined();
    expect(maxSinkRateMS(noEle)).toBeUndefined();
  });

  it('guards zero time deltas from duplicate timestamps', () => {
    const pts = [pt(100, 45, 0), pt(100, 45, 5), pt(108, 45, 16), pt(108, 45, 16), pt(116, 45, 32)];
    const r = maxClimbRateMS(pts);
    expect(r).toBeDefined();
    expect(Number.isFinite(r!)).toBe(true);
    expect(r).toBeCloseTo(2, 6);
  });
});

describe('topSpeedMS', () => {
  it('reports steady groundspeed over the window', () => {
    // 0.0001° lat per second ≈ 11.1 m/s for 12 s.
    const pts = Array.from({ length: 13 }, (_, t) => pt(1000 + t, 45 + t * 0.0001));
    const v = topSpeedMS(pts);
    expect(v).toBeGreaterThan(10.5);
    expect(v!).toBeLessThan(11.7);
  });

  it('damps a single-fix GPS teleport', () => {
    // ~11 m hops with one ~222 m glitch hop (raw 222 m/s point-to-point).
    const pts = Array.from({ length: 10 }, (_, t) =>
      pt(1000 + t, 45 + t * 0.0001 + (t > 5 ? 0.002 : 0))
    );
    const v = topSpeedMS(pts);
    expect(v).toBeDefined();
    expect(v!).toBeLessThan(100);
  });

  it('is absent for untimed tracks or spreads shorter than the window', () => {
    expect(topSpeedMS([pt(0, 45), pt(0, 45.01)])).toBeUndefined();
    expect(topSpeedMS([pt(100, 45), pt(101, 45.001), pt(102, 45.002)])).toBeUndefined();
  });
});

describe('elevationDeltaM', () => {
  it('is the signed first-to-last change', () => {
    const pts = [pt(1, 45, 2200), pt(2, 45.01, 2400), pt(3, 45.02, 950)];
    expect(elevationDeltaM(pts)).toBe(-1250);
  });

  it('is absent with fewer than two elevations', () => {
    expect(elevationDeltaM([pt(1, 45), pt(2, 45.01)])).toBeUndefined();
    expect(elevationDeltaM([pt(1, 45, 100), pt(2, 45.01)])).toBeUndefined();
  });
});

describe('maxDescentM', () => {
  it('finds the largest peak-to-trough descent', () => {
    const pts = [500, 800, 300, 600, 200].map((e, i) => pt(i + 1, 45 + i * 0.001, e));
    expect(maxDescentM(pts)).toBe(600); // 800 → 200
  });

  it('is the full drop for a monotonic descent', () => {
    const pts = [1000, 900, 700, 400].map((e, i) => pt(i + 1, 45 + i * 0.001, e));
    expect(maxDescentM(pts)).toBe(600);
  });

  it('is an honest 0 for a climb-only track, absent without elevations', () => {
    const climb = [100, 200, 300].map((e, i) => pt(i + 1, 45, e));
    expect(maxDescentM(climb)).toBe(0);
    expect(maxDescentM([pt(1, 45), pt(2, 45.01)])).toBeUndefined();
  });
});
