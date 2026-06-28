/**
 * restTimer — the pure countdown math the rest timer runs on.
 */
import { describe, it, expect } from '@jest/globals';
import { restRemainingSec, isRestComplete, formatRest } from '../restTimer';

const T0 = 1_700_000_000_000; // a fixed epoch-ms base for deterministic tests

describe('restRemainingSec', () => {
  it('counts down from the configured duration', () => {
    const state = { startedAtMs: T0, durationSec: 120 };
    expect(restRemainingSec(state, T0)).toBe(120);
    expect(restRemainingSec(state, T0 + 30_000)).toBe(90);
    expect(restRemainingSec(state, T0 + 119_000)).toBe(1);
  });

  it('clamps at 0 (never negative) once the rest has elapsed', () => {
    const state = { startedAtMs: T0, durationSec: 60 };
    expect(restRemainingSec(state, T0 + 60_000)).toBe(0);
    expect(restRemainingSec(state, T0 + 90_000)).toBe(0);
  });
});

describe('isRestComplete', () => {
  it('is false mid-rest and true at/after the end', () => {
    const state = { startedAtMs: T0, durationSec: 90 };
    expect(isRestComplete(state, T0 + 45_000)).toBe(false);
    expect(isRestComplete(state, T0 + 90_000)).toBe(true);
    expect(isRestComplete(state, T0 + 100_000)).toBe(true);
  });
});

describe('formatRest', () => {
  it('formats seconds as m:ss', () => {
    expect(formatRest(0)).toBe('0:00');
    expect(formatRest(5)).toBe('0:05');
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(125)).toBe('2:05');
  });

  it('never shows a negative time', () => {
    expect(formatRest(-10)).toBe('0:00');
  });
});
