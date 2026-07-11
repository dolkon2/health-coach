/**
 * benchmarkDomain tests — element resolution via activity, Body-metrics
 * merging with the Body element, Nutrition/General buckets, dual-face
 * whole-record grouping, and the ordered/empty-section-dropping grouper.
 */
import { describe, it, expect } from '@jest/globals';
import {
  benchmarkDomain,
  groupBenchmarksByDomain,
  BENCHMARK_DOMAIN_ORDER,
} from '../benchmarkDomain';
import type { Benchmark } from '@core/benchmark';

type Bm = Pick<Benchmark, 'behavior' | 'outcome'>;

const kayakBehavior: Bm = {
  behavior: {
    dimension: { metric: 'sessionCount', activity: 'kayak' },
    window: 'week',
    measure: { type: 'count', target: 3 },
  },
};
const climbBehavior: Bm = {
  behavior: {
    dimension: { metric: 'sessionCount', activity: 'climb' },
    window: 'week',
    measure: { type: 'count', target: 2 },
  },
};
const anySessionBehavior: Bm = {
  behavior: {
    dimension: { metric: 'sessionCount' },
    window: 'week',
    measure: { type: 'count', target: 4 },
  },
};
const bodyweightOutcome: Bm = {
  outcome: { dimension: { metric: 'bodyweight' }, direction: 'down', target: 75 },
};
const exerciseLoadOutcome: Bm = {
  outcome: {
    dimension: { metric: 'exerciseLoad', exercise: 'bench' },
    direction: 'up',
    target: 100,
  },
};
const caloriesBehavior: Bm = {
  behavior: {
    dimension: { metric: 'calories' },
    window: 'week',
    measure: { type: 'days', target: 5, condition: { kind: 'calories', op: 'atMost', kcal: 2000 } },
  },
};
const dualFace: Bm = {
  behavior: kayakBehavior.behavior,
  outcome: bodyweightOutcome.outcome,
};

describe('benchmarkDomain', () => {
  it('resolves a session-count activity to its element', () => {
    expect(benchmarkDomain(kayakBehavior)).toEqual({ key: 'water', label: 'Water' });
    expect(benchmarkDomain(climbBehavior)).toEqual({ key: 'earth', label: 'Earth' });
  });

  it('a bare "any session" behavior falls back to General', () => {
    expect(benchmarkDomain(anySessionBehavior)).toEqual({ key: 'general', label: 'General' });
  });

  it('bodyweight outcome resolves to Body', () => {
    expect(benchmarkDomain(bodyweightOutcome)).toEqual({ key: 'body', label: 'Body' });
  });

  it('Body-dimension metrics (exerciseLoad etc.) also resolve to Body', () => {
    expect(benchmarkDomain(exerciseLoadOutcome)).toEqual({ key: 'body', label: 'Body' });
  });

  it('nutrition metrics resolve to Nutrition', () => {
    expect(benchmarkDomain(caloriesBehavior)).toEqual({ key: 'nutrition', label: 'Nutrition' });
  });

  it('a dual-face benchmark groups whole, keyed by the behavior face', () => {
    expect(benchmarkDomain(dualFace)).toEqual({ key: 'water', label: 'Water' });
  });

  it('neither face present falls back to General', () => {
    expect(benchmarkDomain({})).toEqual({ key: 'general', label: 'General' });
  });
});

describe('groupBenchmarksByDomain', () => {
  it('groups, orders by BENCHMARK_DOMAIN_ORDER, and drops empty sections', () => {
    const items = [climbBehavior, kayakBehavior, bodyweightOutcome, exerciseLoadOutcome, caloriesBehavior];
    const groups = groupBenchmarksByDomain(items);
    expect(groups.map((g) => g.group.key)).toEqual(['body', 'earth', 'water', 'nutrition']);
    // Body section merges bodyweight + exerciseLoad items together.
    expect(groups.find((g) => g.group.key === 'body')?.items).toEqual([
      bodyweightOutcome,
      exerciseLoadOutcome,
    ]);
    // Every returned key is a real slot in the canonical order.
    for (const g of groups) expect(BENCHMARK_DOMAIN_ORDER).toContain(g.group.key);
  });

  it('empty input yields no sections', () => {
    expect(groupBenchmarksByDomain([])).toEqual([]);
  });
});
