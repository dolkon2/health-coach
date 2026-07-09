/**
 * gymAnalytics.test.ts — e1RM series, PR detection, muscle-group tonnage
 * (Body P4).
 */
import { describe, expect, it } from '@jest/globals';
import {
  computeE1rmSeries,
  computeMuscleTonnage,
  detectPRs,
  EPLEY_MAX_REPS,
  type SessionSets,
} from '../src/gymAnalytics';
import type { LiftingBlock } from '../src/observation';

type Set = LiftingBlock['sets'][number];

function set(over: Partial<Set> & { exercise: string; movementPattern: Set['movementPattern'] }): Set {
  return { weightKg: 0, reps: 0, ...over };
}

describe('computeE1rmSeries', () => {
  it('applies the Epley formula to a working set', () => {
    const sessions: SessionSets[] = [
      { date: '2026-01-01', sets: [set({ exercise: 'bench', movementPattern: 'upper-push', weightKg: 100, reps: 5 })] },
    ];
    const [p] = computeE1rmSeries(sessions);
    expect(p.e1rmKg).toBeCloseTo(100 * (1 + 5 / 30), 6);
  });

  it('excludes warmup sets', () => {
    const sessions: SessionSets[] = [
      {
        date: '2026-01-01',
        sets: [set({ exercise: 'bench', movementPattern: 'upper-push', weightKg: 100, reps: 5, isWarmup: true })],
      },
    ];
    expect(computeE1rmSeries(sessions)).toHaveLength(0);
  });

  it('excludes hold sets (no rep-based e1RM for an isometric)', () => {
    const sessions: SessionSets[] = [
      {
        date: '2026-01-01',
        sets: [set({ exercise: 'plank', movementPattern: 'core', weightKg: 0, reps: 0, holdSec: 30 })],
      },
    ];
    expect(computeE1rmSeries(sessions)).toHaveLength(0);
  });

  it('a 15-rep set produces no e1RM point — never clamped into the formula', () => {
    const sessions: SessionSets[] = [
      { date: '2026-01-01', sets: [set({ exercise: 'bench', movementPattern: 'upper-push', weightKg: 60, reps: 15 })] },
    ];
    expect(computeE1rmSeries(sessions)).toHaveLength(0);
    expect(EPLEY_MAX_REPS).toBe(12);
  });

  it('a 12-rep set is included (boundary is inclusive)', () => {
    const sessions: SessionSets[] = [
      { date: '2026-01-01', sets: [set({ exercise: 'bench', movementPattern: 'upper-push', weightKg: 60, reps: 12 })] },
    ];
    expect(computeE1rmSeries(sessions)).toHaveLength(1);
  });

  it('takes the best-of-session set per exercise, not every qualifying set', () => {
    const sessions: SessionSets[] = [
      {
        date: '2026-01-01',
        sets: [
          set({ exercise: 'bench', movementPattern: 'upper-push', weightKg: 100, reps: 5 }),
          set({ exercise: 'bench', movementPattern: 'upper-push', weightKg: 110, reps: 3 }),
        ],
      },
    ];
    const points = computeE1rmSeries(sessions);
    expect(points).toHaveLength(1);
    expect(points[0].e1rmKg).toBeCloseTo(110 * (1 + 3 / 30), 6);
  });

  it('groups by exerciseId when present, over the free-typed name', () => {
    const sessions: SessionSets[] = [
      {
        date: '2026-01-01',
        sets: [
          set({ exercise: 'Bench', exerciseId: 'Barbell_Bench_Press', movementPattern: 'upper-push', weightKg: 100, reps: 5 }),
          set({ exercise: 'bench (different casing)', exerciseId: 'Barbell_Bench_Press', movementPattern: 'upper-push', weightKg: 105, reps: 5 }),
        ],
      },
    ];
    const points = computeE1rmSeries(sessions);
    expect(points).toHaveLength(1); // same exerciseId -> one exercise, best set wins
    expect(points[0].e1rmKg).toBeCloseTo(105 * (1 + 5 / 30), 6);
  });
});

describe('detectPRs', () => {
  const pattern = 'upper-push' as const;

  it('flags a new best e1RM against history', () => {
    const history: SessionSets[] = [
      { date: '2026-01-01', sets: [set({ exercise: 'bench', movementPattern: pattern, weightKg: 100, reps: 5 })] },
    ];
    const newSession: SessionSets = {
      date: '2026-01-08',
      sets: [set({ exercise: 'bench', movementPattern: pattern, weightKg: 105, reps: 5 })],
    };
    const flags = detectPRs(history, newSession);
    expect(flags.filter((f) => f.kind === 'e1rm')).toHaveLength(1);
  });

  it('does not flag a set that fails to beat history', () => {
    const history: SessionSets[] = [
      { date: '2026-01-01', sets: [set({ exercise: 'bench', movementPattern: pattern, weightKg: 100, reps: 8 })] },
    ];
    const newSession: SessionSets = {
      date: '2026-01-08',
      sets: [set({ exercise: 'bench', movementPattern: pattern, weightKg: 100, reps: 5 })],
    };
    expect(detectPRs(history, newSession)).toHaveLength(0);
  });

  it('flags best reps at an exact weight, independent of e1RM', () => {
    const history: SessionSets[] = [
      { date: '2026-01-01', sets: [set({ exercise: 'squat', movementPattern: 'quad-dom', weightKg: 80, reps: 5 })] },
    ];
    const newSession: SessionSets = {
      date: '2026-01-08',
      sets: [set({ exercise: 'squat', movementPattern: 'quad-dom', weightKg: 80, reps: 6 })],
    };
    const flags = detectPRs(history, newSession);
    const repsFlag = flags.find((f) => f.kind === 'repsAtWeight');
    expect(repsFlag).toMatchObject({ weightKg: 80, reps: 6 });
  });

  it('flags best single-set volume', () => {
    const history: SessionSets[] = [
      { date: '2026-01-01', sets: [set({ exercise: 'row', movementPattern: 'upper-pull', weightKg: 50, reps: 10 })] }, // 500
    ];
    const newSession: SessionSets = {
      date: '2026-01-08',
      sets: [set({ exercise: 'row', movementPattern: 'upper-pull', weightKg: 60, reps: 9 })], // 540
    };
    const flags = detectPRs(history, newSession);
    const volFlag = flags.find((f) => f.kind === 'setVolume');
    expect(volFlag).toMatchObject({ volumeKg: 540 });
  });

  it('a hold set never produces any PR flag', () => {
    const history: SessionSets[] = [];
    const newSession: SessionSets = {
      date: '2026-01-08',
      sets: [set({ exercise: 'plank', movementPattern: 'core', weightKg: 0, reps: 0, holdSec: 60 })],
    };
    expect(detectPRs(history, newSession)).toHaveLength(0);
  });

  it('a session with two improving sets on the same lift flags once, not twice, per kind', () => {
    const history: SessionSets[] = [
      { date: '2026-01-01', sets: [set({ exercise: 'bench', movementPattern: pattern, weightKg: 100, reps: 5 })] },
    ];
    const newSession: SessionSets = {
      date: '2026-01-08',
      sets: [
        set({ exercise: 'bench', movementPattern: pattern, weightKg: 102.5, reps: 5 }),
        set({ exercise: 'bench', movementPattern: pattern, weightKg: 105, reps: 5 }), // strictly better — should be the ONE e1rm flag
      ],
    };
    const flags = detectPRs(history, newSession);
    const e1rmFlags = flags.filter((f) => f.kind === 'e1rm');
    expect(e1rmFlags).toHaveLength(1);
    expect((e1rmFlags[0] as { e1rmKg: number }).e1rmKg).toBeCloseTo(105 * (1 + 5 / 30), 6);
  });

  it('an exercise never seen before is trivially a PR on first log (no fabricated ceiling)', () => {
    const flags = detectPRs([], {
      date: '2026-01-08',
      sets: [set({ exercise: 'first-timer', movementPattern: pattern, weightKg: 20, reps: 5 })],
    });
    expect(flags.map((f) => f.kind).sort()).toEqual(['e1rm', 'repsAtWeight', 'setVolume']);
  });
});

describe('computeMuscleTonnage', () => {
  const pattern = 'upper-push' as const;

  it('weights primary muscles at 1.0 and secondary at 0.5', () => {
    const entries = [
      {
        set: set({ exercise: 'bench', movementPattern: pattern, weightKg: 100, reps: 5 }), // volume 500
        muscles: { primary: ['chest'], secondary: ['triceps', 'shoulders'] },
      },
    ];
    const totals = computeMuscleTonnage(entries);
    expect(totals.chest).toBeCloseTo(500, 6);
    expect(totals.triceps).toBeCloseTo(250, 6);
    expect(totals.shoulders).toBeCloseTo(250, 6);
  });

  it('collapses lats/middle back/traps into back, and adductors/abductors into one group', () => {
    const entries = [
      {
        set: set({ exercise: 'row', movementPattern: 'upper-pull', weightKg: 40, reps: 10 }), // volume 400
        muscles: { primary: ['lats', 'middle back', 'traps'], secondary: [] },
      },
    ];
    const totals = computeMuscleTonnage(entries);
    expect(totals.back).toBeCloseTo(1200, 6); // 400 primary-weighted, three tags summed
  });

  it('hold sets contribute no tonnage', () => {
    const entries = [
      {
        set: set({ exercise: 'plank', movementPattern: 'core', weightKg: 0, reps: 0, holdSec: 60 }),
        muscles: { primary: ['abdominals'], secondary: [] },
      },
    ];
    expect(computeMuscleTonnage(entries)).toEqual({});
  });

  it('a set with no resolvable muscle data contributes nothing (never a guess)', () => {
    const entries = [{ set: set({ exercise: 'mystery lift', movementPattern: pattern, weightKg: 50, reps: 5 }) }];
    expect(computeMuscleTonnage(entries)).toEqual({});
  });

  it('warmup sets contribute no tonnage', () => {
    const entries = [
      {
        set: set({ exercise: 'bench', movementPattern: pattern, weightKg: 100, reps: 5, isWarmup: true }),
        muscles: { primary: ['chest'], secondary: [] },
      },
    ];
    expect(computeMuscleTonnage(entries)).toEqual({});
  });
});
