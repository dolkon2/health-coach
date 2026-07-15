/**
 * benchmarkType tests — Behavior/Outcome/Both bucketing, dual-face
 * whole-record grouping, and the ordered/empty-section-dropping grouper.
 */
import { describe, it, expect } from '@jest/globals';
import { benchmarkTypeGroup, groupBenchmarksByType, BENCHMARK_TYPE_ORDER } from '../benchmarkType';
import type { Benchmark } from '@core/benchmark';

type Bm = Pick<Benchmark, 'behavior' | 'outcome'>;

const behaviorOnly: Bm = {
  behavior: {
    dimension: { metric: 'sessionCount', activity: 'kayak' },
    window: 'week',
    measure: { type: 'count', target: 3 },
  },
};
const outcomeWithTarget: Bm = {
  outcome: { dimension: { metric: 'bodyweight' }, direction: 'down', target: 75 },
};
const outcomeDirectionOnly: Bm = {
  outcome: { dimension: { metric: 'bodyweight' }, direction: 'up' },
};
const dualFace: Bm = {
  behavior: behaviorOnly.behavior,
  outcome: outcomeWithTarget.outcome,
};

describe('benchmarkTypeGroup', () => {
  it('buckets a behavior-only benchmark as Behavior', () => {
    expect(benchmarkTypeGroup(behaviorOnly)).toEqual({ key: 'behavior', label: 'Behavior' });
  });

  it('buckets an outcome-only benchmark as Outcome regardless of target presence', () => {
    expect(benchmarkTypeGroup(outcomeWithTarget)).toEqual({ key: 'outcome', label: 'Outcome' });
    expect(benchmarkTypeGroup(outcomeDirectionOnly)).toEqual({ key: 'outcome', label: 'Outcome' });
  });

  it('buckets a dual-face benchmark as Both, never split', () => {
    expect(benchmarkTypeGroup(dualFace)).toEqual({ key: 'both', label: 'Both' });
  });
});

describe('groupBenchmarksByType', () => {
  it('orders sections Behavior, Outcome, Both and drops empty ones', () => {
    const groups = groupBenchmarksByType([dualFace, behaviorOnly, outcomeWithTarget]);
    expect(groups.map((g) => g.group.key)).toEqual(['behavior', 'outcome', 'both']);
    expect(BENCHMARK_TYPE_ORDER).toEqual(['behavior', 'outcome', 'both']);
  });

  it('preserves caller order within a section', () => {
    const first: Bm = { ...behaviorOnly };
    const second: Bm = {
      behavior: {
        dimension: { metric: 'sessionCount', activity: 'climb' },
        window: 'week',
        measure: { type: 'count', target: 2 },
      },
    };
    const groups = groupBenchmarksByType([second, first]);
    expect(groups[0].items).toEqual([second, first]);
  });

  it('drops a section entirely when no benchmark carries that type', () => {
    const groups = groupBenchmarksByType([behaviorOnly]);
    expect(groups).toHaveLength(1);
    expect(groups[0].group.key).toBe('behavior');
  });

  it('returns an empty array for an empty input', () => {
    expect(groupBenchmarksByType([])).toEqual([]);
  });
});
