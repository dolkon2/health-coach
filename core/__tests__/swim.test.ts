/**
 * swim derivations — sets, SWOLF, pace/100 fall out of per-length facts at read
 * time; absent data stays absent (null / omitted, never 0, never fabricated).
 */
import { describe, it, expect } from '@jest/globals';
import {
  clusterSets,
  swolfPerLength,
  pacePer100,
  DEFAULT_REST_GAP_S,
} from '../src/swim';
import type { SwimLength } from '../src/observation';

/** One 25 m length starting at `startSec`, ~30s of swimming. */
function length(startSec: number, overrides: Partial<SwimLength> = {}): SwimLength {
  return {
    startSec,
    durationS: 30,
    distanceM: 25,
    strokes: 20,
    stroke: 'freestyle',
    ...overrides,
  };
}

/**
 * A realistic 10×100 free in a 25 m pool: each rep is 4 back-to-back lengths
 * (~2s open-turn gaps), ~30s rest between reps.
 */
function tenByHundred(): SwimLength[] {
  const lengths: SwimLength[] = [];
  let t = 0;
  for (let rep = 0; rep < 10; rep++) {
    for (let i = 0; i < 4; i++) {
      lengths.push(length(t));
      t += 30 + 2; // 30s swimming + 2s at the wall
    }
    t += 30 - 2; // ~30s rest before the next rep
  }
  return lengths;
}

describe('clusterSets', () => {
  it('returns [] for empty input', () => {
    expect(clusterSets([])).toEqual([]);
  });

  it('a single length is its own set', () => {
    const sets = clusterSets([length(0)]);
    expect(sets).toHaveLength(1);
    expect(sets[0].reps).toBe(1);
    expect(sets[0].startSec).toBe(0);
    expect(sets[0].durationS).toBe(30);
    expect(sets[0].distanceM).toBe(25);
  });

  it('clusters a 10×100 (25 m pool, ~30s rests) into 10 sets of 4 lengths', () => {
    const sets = clusterSets(tenByHundred());
    expect(sets).toHaveLength(10);
    for (const set of sets) {
      expect(set.reps).toBe(4);
      expect(set.distanceM).toBe(100);
      expect(set.dominantStroke).toBe('freestyle');
      // Span covers all four lengths INCLUDING the 2s intra-set wall gaps:
      // 3 × 32 + final 30 = 126s.
      expect(set.durationS).toBe(126);
    }
    expect(sets[1].startSec).toBe(sets[0].startSec + 126 + 30);
  });

  it('back-to-back lengths with gaps under the threshold form one set', () => {
    // 14s gaps < 15s default → still one set.
    const sets = clusterSets([length(0), length(44), length(88)]);
    expect(sets).toHaveLength(1);
    expect(sets[0].reps).toBe(3);
  });

  it('a gap equal to the threshold splits the set (strict <)', () => {
    // gap = 15s, default threshold 15s → 15 < 15 is false → split.
    const sets = clusterSets([length(0), length(30 + DEFAULT_REST_GAP_S)]);
    expect(sets).toHaveLength(2);
  });

  it('honors a custom restGapS', () => {
    const lengths = [length(0), length(50)]; // 20s gap
    expect(clusterSets(lengths)).toHaveLength(2); // 20 ≥ 15 default
    expect(clusterSets(lengths, 25)).toHaveLength(1); // 20 < 25 custom
  });

  it('sorts unsorted input defensively without mutating the caller array', () => {
    const input = [length(88), length(0), length(44)];
    const snapshot = input.map((l) => l.startSec);
    const sets = clusterSets(input);
    expect(sets).toHaveLength(1);
    expect(sets[0].startSec).toBe(0);
    expect(sets[0].lengths.map((l) => l.startSec)).toEqual([0, 44, 88]);
    expect(input.map((l) => l.startSec)).toEqual(snapshot);
  });

  it('sums only measured distances when some lengths lack one', () => {
    const sets = clusterSets([
      length(0),
      length(32, { distanceM: undefined }),
      length(64),
    ]);
    expect(sets[0].distanceM).toBe(50); // 25 + (absent) + 25 — absent is not 0
  });

  it('omits distanceM entirely when NO length in the set has distance', () => {
    const sets = clusterSets([
      length(0, { distanceM: undefined }),
      length(32, { distanceM: undefined }),
    ]);
    expect(sets[0]).not.toHaveProperty('distanceM'); // omitted, never 0
  });

  it('dominantStroke is the most frequent stroke, ignoring unknown', () => {
    const sets = clusterSets([
      length(0, { stroke: 'unknown' }),
      length(32, { stroke: 'backstroke' }),
      length(64, { stroke: 'unknown' }),
      length(96, { stroke: 'backstroke' }),
      length(128, { stroke: 'freestyle' }),
    ]);
    // 'unknown' appears most often but never dominates.
    expect(sets[0].dominantStroke).toBe('backstroke');
  });

  it('dominantStroke ties break toward the stroke seen first', () => {
    const sets = clusterSets([
      length(0, { stroke: 'breaststroke' }),
      length(32, { stroke: 'freestyle' }),
      length(64, { stroke: 'breaststroke' }),
      length(96, { stroke: 'freestyle' }),
    ]);
    expect(sets[0].dominantStroke).toBe('breaststroke');
  });

  it('omits dominantStroke when every stroke is absent or unknown', () => {
    const sets = clusterSets([
      length(0, { stroke: undefined }),
      length(32, { stroke: 'unknown' }),
    ]);
    expect(sets[0]).not.toHaveProperty('dominantStroke');
  });
});

describe('swolfPerLength', () => {
  it('is durationS + strokes when strokes are present', () => {
    expect(swolfPerLength(length(0, { durationS: 28, strokes: 18 }))).toBe(46);
  });

  it('is null when strokes are absent — never fabricated', () => {
    expect(swolfPerLength(length(0, { strokes: undefined }))).toBeNull();
  });

  it('treats a recorded 0 strokes as a fact, not as absent (null ≠ 0)', () => {
    expect(swolfPerLength(length(0, { durationS: 40, strokes: 0 }))).toBe(40);
  });
});

describe('pacePer100', () => {
  it('is total time over total distance, scaled to 100 m', () => {
    // 4 × 25 m in 30s each → 120s / 100 m.
    const pace = pacePer100([length(0), length(32), length(64), length(96)]);
    expect(pace).toBe(120);
  });

  it('ignores lengths without distance rather than guessing', () => {
    const pace = pacePer100([length(0), length(32, { distanceM: undefined })]);
    expect(pace).toBe(120); // only the measured 25 m length counts
  });

  it('is null when no length has distance', () => {
    expect(pacePer100([length(0, { distanceM: undefined })])).toBeNull();
  });

  it('is null for empty input', () => {
    expect(pacePer100([])).toBeNull();
  });

  it('filters to the requested stroke', () => {
    const pace = pacePer100(
      [
        length(0, { stroke: 'freestyle', durationS: 30 }),
        length(40, { stroke: 'backstroke', durationS: 40 }),
      ],
      'backstroke'
    );
    expect(pace).toBe(160); // 40s / 25 m — freestyle length excluded
  });

  it('a stroke filter excludes lengths with no stroke recorded', () => {
    expect(
      pacePer100([length(0, { stroke: undefined })], 'freestyle')
    ).toBeNull();
  });

  it('excludes kickboard lengths by default — kick pace is not swim pace', () => {
    const pace = pacePer100([
      length(0, { stroke: 'freestyle', durationS: 30 }),
      length(40, { stroke: 'kickboard', durationS: 60 }),
    ]);
    expect(pace).toBe(120); // kick length ignored
  });

  it('includes kickboard lengths when explicitly filtered for them', () => {
    const pace = pacePer100(
      [
        length(0, { stroke: 'freestyle', durationS: 30 }),
        length(40, { stroke: 'kickboard', durationS: 60 }),
      ],
      'kickboard'
    );
    expect(pace).toBe(240); // 60s / 25 m
  });
});
