import { describe, it, expect } from '@jest/globals';
import { bearingDeg, directionMarks } from '../mapGeom';

describe('bearingDeg', () => {
  it('is 0 heading due north', () => {
    expect(bearingDeg({ lat: 45, lng: -121 }, { lat: 46, lng: -121 })).toBeCloseTo(0, 0);
  });

  it('is ~90 heading due east', () => {
    expect(bearingDeg({ lat: 45, lng: -121 }, { lat: 45, lng: -120 })).toBeCloseTo(90, 0);
  });

  it('is ~180 heading due south', () => {
    expect(bearingDeg({ lat: 45, lng: -121 }, { lat: 44, lng: -121 })).toBeCloseTo(180, 0);
  });

  it('stays in [0, 360)', () => {
    const b = bearingDeg({ lat: 45, lng: -121 }, { lat: 44, lng: -122 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe('directionMarks', () => {
  const line = [
    { lat: 45.0, lng: -121.0 },
    { lat: 45.1, lng: -121.0 },
    { lat: 45.2, lng: -121.0 },
    { lat: 45.3, lng: -121.0 },
    { lat: 45.4, lng: -121.0 },
  ];

  it('returns none for a path shorter than 2 points', () => {
    expect(directionMarks([{ lat: 0, lng: 0 }], 3)).toEqual([]);
    expect(directionMarks([], 3)).toEqual([]);
  });

  it('returns none when count is 0 or negative', () => {
    expect(directionMarks(line, 0)).toEqual([]);
    expect(directionMarks(line, -1)).toEqual([]);
  });

  it('returns up to `count` marks, each with a valid bearing to its next point', () => {
    const marks = directionMarks(line, 3);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.length).toBeLessThanOrEqual(3);
    for (const m of marks) {
      expect(line).toContainEqual(m.point);
      expect(m.bearingDeg).toBeGreaterThanOrEqual(0);
      expect(m.bearingDeg).toBeLessThan(360);
    }
  });

  it('never picks the last point (it has no "next" to point toward)', () => {
    const marks = directionMarks(line, 5);
    const lastPoint = line[line.length - 1];
    expect(marks.some((m) => m.point === lastPoint)).toBe(false);
  });

  it('de-duplicates when a short two-point path is asked for many marks', () => {
    const short = [
      { lat: 45.0, lng: -121.0 },
      { lat: 45.1, lng: -121.0 },
    ];
    const marks = directionMarks(short, 5);
    expect(marks).toEqual([{ point: short[0], bearingDeg: 0 }]);
  });
});
