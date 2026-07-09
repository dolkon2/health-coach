/**
 * ladderTrend.test.ts — the calisthenics ladder engine (Body P3). Fixtures
 * mirror the real vendored dip-line and lsit-line chains (src/data/ladders.json)
 * so the math is checked against the actual dataset shape, without core
 * importing app data (see ladderTrend.ts header).
 */
import { describe, expect, it } from '@jest/globals';
import {
  computeLadderChainTrend,
  currentLadderStep,
  type LadderTrendChain,
} from '../src/ladderTrend';

// dip-line, verbatim from src/data/ladders.json (Body P2).
const DIP_LINE: LadderTrendChain = {
  id: 'dip-line',
  goal: 'reps',
  steps: [
    { id: 'dip-support-hold', setType: 'duration', leverageFactor: 0.4, advancement: { sets: 3, repsOrSeconds: 60 } },
    { id: 'dip-negative', setType: 'reps', leverageFactor: 0.7, advancement: { sets: 3, repsOrSeconds: 8 } },
    { id: 'dip-parallel-bar', setType: 'reps', leverageFactor: 1.0, advancement: { sets: 3, repsOrSeconds: 8 } },
    {
      id: 'dip-weighted',
      setType: 'reps',
      leverageFactor: 1.0,
      loadable: true,
      advancement: { sets: 3, repsOrSeconds: 8 },
    },
    { id: 'dip-ring', setType: 'reps', leverageFactor: 1.2, advancement: { sets: 3, repsOrSeconds: 8 } },
  ],
};

// lsit-line, verbatim from src/data/ladders.json.
const LSIT_LINE: LadderTrendChain = {
  id: 'lsit-line',
  goal: 'duration',
  steps: [
    { id: 'lsit-foot-supported', setType: 'duration', leverageFactor: 0.3, advancement: { sets: 3, repsOrSeconds: 20 } },
    { id: 'lsit-one-foot-supported', setType: 'duration', leverageFactor: 0.45, advancement: { sets: 3, repsOrSeconds: 20 } },
    { id: 'lsit-tuck', setType: 'duration', leverageFactor: 0.6, advancement: { sets: 3, repsOrSeconds: 20 } },
    { id: 'lsit-one-leg-extended', setType: 'duration', leverageFactor: 0.8, advancement: { sets: 3, repsOrSeconds: 20 } },
    { id: 'lsit-full', setType: 'duration', leverageFactor: 1.0, advancement: { sets: 3, repsOrSeconds: 20 } },
    { id: 'lsit-v-sit', setType: 'duration', leverageFactor: 1.4, advancement: { sets: 3, repsOrSeconds: 10 } },
  ],
};

describe('computeLadderChainTrend — dip-line (loadable step)', () => {
  it('is continuous at +0kg: a weighted dip at zero added load equals the raw factor', () => {
    const [p] = computeLadderChainTrend(
      DIP_LINE,
      [{ date: '2026-01-01', stepId: 'dip-weighted', sets: [{ reps: 8, weightKg: 0 }] }],
      () => 80
    );
    expect(p.effectiveLeverage).toBeCloseTo(1.0, 6);
    expect(p.bestScore).toBeCloseTo(8, 6);
  });

  it('credits added load against trend bodyweight (ladders-notes.md worked example)', () => {
    const [p] = computeLadderChainTrend(
      DIP_LINE,
      [{ date: '2026-01-01', stepId: 'dip-weighted', sets: [{ reps: 5, weightKg: 20 }] }],
      () => 80
    );
    // 1.0 × (80+20)/80 = 1.25
    expect(p.effectiveLeverage).toBeCloseTo(1.25, 6);
    expect(p.bestScore).toBeCloseTo(6.25, 6);
  });

  it('the same added load re-scores after a bodyweight cut (honest, not punitive or generous by design)', () => {
    const [p] = computeLadderChainTrend(
      DIP_LINE,
      [{ date: '2026-02-01', stepId: 'dip-weighted', sets: [{ reps: 5, weightKg: 20 }] }],
      () => 75
    );
    // 1.0 × (75+20)/75 = 1.2667
    expect(p.effectiveLeverage).toBeCloseTo(1.2667, 3);
  });

  it('degrades to the raw factor (never fabricates a bodyweight) when trend weight is unknown', () => {
    const [p] = computeLadderChainTrend(
      DIP_LINE,
      [{ date: '2026-01-01', stepId: 'dip-weighted', sets: [{ reps: 5, weightKg: 20 }] }],
      () => null
    );
    expect(p.effectiveLeverage).toBeCloseTo(1.0, 6);
    expect(p.bestScore).toBeCloseTo(5, 6);
  });

  it('a non-loadable step ignores bodyweight entirely', () => {
    const [p] = computeLadderChainTrend(
      DIP_LINE,
      [{ date: '2026-01-01', stepId: 'dip-parallel-bar', sets: [{ reps: 10, weightKg: 0 }] }],
      () => 80
    );
    expect(p.effectiveLeverage).toBe(1.0);
    expect(p.stepIndex).toBe(2);
  });

  it('ladder position uses the BEST single set, not accumulated volume, off the ladder', () => {
    const [p] = computeLadderChainTrend(
      DIP_LINE,
      [
        {
          date: '2026-01-01',
          stepId: 'dip-parallel-bar',
          sets: [{ reps: 5, weightKg: 0 }, { reps: 6, weightKg: 0 }, { reps: 4, weightKg: 0 }],
        },
      ],
      () => null
    );
    // best set = 6 reps against an 8-rep threshold at stepIndex 2.
    expect(p.ladderPosition).toBeCloseTo(2 + 6 / 8, 6);
    expect(p.volumeScore).toBeCloseTo(15, 6); // 5+6+4, leverage 1.0
    expect(p.bestScore).toBeCloseTo(6, 6);
  });

  it('caps ladder position at the next integer even past threshold', () => {
    const [p] = computeLadderChainTrend(
      DIP_LINE,
      [{ date: '2026-01-01', stepId: 'dip-parallel-bar', sets: [{ reps: 20, weightKg: 0 }] }],
      () => null
    );
    expect(p.ladderPosition).toBe(3); // stepIndex 2 + capped 1.0
  });

  it('drops occurrences whose stepId is not in this chain', () => {
    const points = computeLadderChainTrend(
      DIP_LINE,
      [{ date: '2026-01-01', stepId: 'lsit-full', sets: [{ holdSec: 20, weightKg: 0 }] }],
      () => null
    );
    expect(points).toHaveLength(0);
  });

  it('sorts by date ascending regardless of input order', () => {
    const points = computeLadderChainTrend(
      DIP_LINE,
      [
        { date: '2026-03-01', stepId: 'dip-parallel-bar', sets: [{ reps: 5, weightKg: 0 }] },
        { date: '2026-01-01', stepId: 'dip-parallel-bar', sets: [{ reps: 5, weightKg: 0 }] },
      ],
      () => null
    );
    expect(points.map((p) => p.date)).toEqual(['2026-01-01', '2026-03-01']);
  });
});

describe('computeLadderChainTrend — lsit-line (achieved = accumulated seconds)', () => {
  it('accumulates seconds across the occurrence for ladder position, per Antranik’s rule', () => {
    const [p] = computeLadderChainTrend(
      LSIT_LINE,
      [
        {
          date: '2026-01-01',
          stepId: 'lsit-full',
          sets: [{ holdSec: 15, weightKg: 0 }, { holdSec: 12, weightKg: 0 }, { holdSec: 10, weightKg: 0 }],
        },
      ],
      () => null
    );
    // stepIndex 4, threshold 20s, accumulated 37s -> capped at 1.
    expect(p.ladderPosition).toBe(5);
    expect(p.bestScore).toBeCloseTo(15, 6); // best single hold still reported
    expect(p.volumeScore).toBeCloseTo(37, 6);
  });

  it('a below-threshold accumulation gives a fractional position', () => {
    const [p] = computeLadderChainTrend(
      LSIT_LINE,
      [{ date: '2026-01-01', stepId: 'lsit-tuck', sets: [{ holdSec: 5, weightKg: 0 }, { holdSec: 5, weightKg: 0 }] }],
      () => null
    );
    // stepIndex 2, accumulated 10s / 20s threshold.
    expect(p.ladderPosition).toBeCloseTo(2.5, 6);
  });
});

describe('currentLadderStep', () => {
  it('returns the most recent point (chain trend points are date-ascending)', () => {
    const points = computeLadderChainTrend(
      DIP_LINE,
      [
        { date: '2026-01-01', stepId: 'dip-negative', sets: [{ reps: 8, weightKg: 0 }] },
        { date: '2026-02-01', stepId: 'dip-parallel-bar', sets: [{ reps: 8, weightKg: 0 }] },
      ],
      () => null
    );
    expect(currentLadderStep(points)?.stepId).toBe('dip-parallel-bar');
  });

  it('returns null for a never-logged chain', () => {
    expect(currentLadderStep([])).toBeNull();
  });
});
