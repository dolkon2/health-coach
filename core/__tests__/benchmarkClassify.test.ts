/**
 * benchmarkClassify tests — per-face labels under every measure/target shape,
 * dual-face straddle, and the empty-benchmark edge (neither face).
 */
import { describe, it, expect } from '@jest/globals';
import {
  classifyBehaviorFace,
  classifyOutcomeFace,
  classifyBenchmark,
  benchmarkLabels,
} from '@core/benchmarkClassify';
import type { BehaviorFace, OutcomeFace } from '@core/benchmark';

const countFace: BehaviorFace = {
  dimension: { metric: 'sessionCount' },
  window: 'week',
  measure: { type: 'count', target: 4 },
};
const magnitudeFace: BehaviorFace = {
  dimension: { metric: 'sessionCount' },
  window: 'week',
  measure: { type: 'magnitude', target: 100, unit: 'km' },
};
const daysFace: BehaviorFace = {
  dimension: { metric: 'calories' },
  window: 'week',
  measure: { type: 'days', target: 5, condition: { kind: 'calories', op: 'atMost', kcal: 2000 } },
};
const shareFace: BehaviorFace = {
  dimension: { metric: 'loggingFidelity' },
  window: 'week',
  measure: { type: 'share', targetPct: 80, minTier: 'T2' },
};

const outcomeWithTarget: OutcomeFace = {
  dimension: { metric: 'bodyweight' },
  direction: 'down',
  target: 75,
};
const outcomeDirectionOnly: OutcomeFace = {
  dimension: { metric: 'bodyweight' },
  direction: 'down',
};

describe('classifyBehaviorFace', () => {
  it('every measure shape maps to compliance', () => {
    expect(classifyBehaviorFace(countFace)).toBe('compliance');
    expect(classifyBehaviorFace(magnitudeFace)).toBe('compliance');
    expect(classifyBehaviorFace(daysFace)).toBe('compliance');
    expect(classifyBehaviorFace(shareFace)).toBe('compliance');
  });
});

describe('classifyOutcomeFace', () => {
  it('a target threshold makes it outcome', () => {
    expect(classifyOutcomeFace(outcomeWithTarget)).toBe('outcome');
  });
  it('direction only (no target) makes it trend', () => {
    expect(classifyOutcomeFace(outcomeDirectionOnly)).toBe('trend');
  });
});

describe('classifyBenchmark / benchmarkLabels', () => {
  it('behavior-only benchmark: compliance only', () => {
    const b = { behavior: countFace };
    expect(classifyBenchmark(b)).toEqual({ behavior: 'compliance' });
    expect(benchmarkLabels(b)).toEqual(['compliance']);
  });

  it('outcome-only benchmark (target): outcome only', () => {
    const b = { outcome: outcomeWithTarget };
    expect(classifyBenchmark(b)).toEqual({ outcome: 'outcome' });
    expect(benchmarkLabels(b)).toEqual(['outcome']);
  });

  it('outcome-only benchmark (direction only): trend only', () => {
    const b = { outcome: outcomeDirectionOnly };
    expect(classifyBenchmark(b)).toEqual({ outcome: 'trend' });
    expect(benchmarkLabels(b)).toEqual(['trend']);
  });

  it('dual-face benchmark is honestly both, never a forced primary', () => {
    const b = { behavior: countFace, outcome: outcomeWithTarget };
    expect(classifyBenchmark(b)).toEqual({ behavior: 'compliance', outcome: 'outcome' });
    expect(benchmarkLabels(b)).toEqual(['compliance', 'outcome']);
  });

  it('dual-face with a direction-only outcome: compliance + trend', () => {
    const b = { behavior: daysFace, outcome: outcomeDirectionOnly };
    expect(benchmarkLabels(b)).toEqual(['compliance', 'trend']);
  });

  it('neither face present: no labels (storage boundary still enforces ≥1 in practice)', () => {
    expect(classifyBenchmark({})).toEqual({});
    expect(benchmarkLabels({})).toEqual([]);
  });
});
