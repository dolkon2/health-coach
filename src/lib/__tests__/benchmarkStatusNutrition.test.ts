/**
 * Nutrition status + rhythm math tests (expenditure build, Pass F). Proof:
 *   - the Today card's days status is three-valued (hits / misses / unknowable,
 *     today in progress) and its line names unknowable days instead of folding
 *     them into misses;
 *   - the fidelity status is the capture-tier share of the window's entries;
 *   - an energyBalance outcome reads the measured window and says "not enough
 *     data" honestly until it exists;
 *   - the rhythm counts are three-valued at the window grain: an undecidable
 *     past window renders hazed (complete: false) and never breaks the run.
 */
import { describe, it, expect } from '@jest/globals';
import type { BehaviorFace, OutcomeFace } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import type { ExpenditureWindow } from '@core/expenditure';
import {
  behaviorLine,
  nutritionBehaviorStatus,
  outcomeStatus,
  outcomeLine,
} from '@/lib/benchmarkStatus';
import {
  consecutiveAtTarget,
  nutritionWindowCounts,
  currentWindowDayGrid,
} from '@/lib/benchmarkReflect';

// Wednesday 2026-07-01; the ISO week runs Mon 06-29 → Sun 07-05.
const NOW = '2026-07-01T18:00:00.000Z';
const TODAY = '2026-07-01';

let n = 0;
function mealObs(
  occurredAt: string,
  over: Partial<{ kcal: number | null; proteinG: number | null; inputMethod: 'weighed' | 'described' | 'photo' | 'barcode' }> = {}
): ObservationOf<'foodEntry'> {
  n += 1;
  const { kcal = 600, proteinG = 40, inputMethod = 'weighed' } = over;
  return {
    id: `f${n}`,
    kind: 'foodEntry',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'UTC',
    tier: 1,
    fidelity: 0.9,
    source: { type: 'manual' },
    payload: {
      kind: 'foodEntry',
      description: 'meal',
      servings: 1,
      kcal,
      proteinG,
      carbsG: 30,
      fatG: 20,
      items: [],
      inputMethod,
      fidelityCeiling: 0.98,
    },
  };
}

const PROTEIN_FACE: BehaviorFace = {
  dimension: { metric: 'macro', macro: 'protein' },
  window: 'week',
  measure: {
    type: 'days',
    target: 5,
    condition: { kind: 'macro', macro: 'protein', op: 'atLeast', grams: 100 },
  },
};

const FIDELITY_FACE: BehaviorFace = {
  dimension: { metric: 'loggingFidelity' },
  window: 'week',
  measure: { type: 'share', targetPct: 80, minTier: 'T2' },
};

describe('nutritionBehaviorStatus — days', () => {
  it('three-valued current-window tally, today in progress', () => {
    const entries = [
      // Monday: 120 g complete → hit
      mealObs('2026-06-29T12:00:00Z', { proteinG: 120 }),
      // Tuesday: partial (protein unknown), known 60 < 100 → unknowable
      mealObs('2026-06-30T12:00:00Z', { proteinG: 60 }),
      mealObs('2026-06-30T18:00:00Z', { proteinG: null }),
      // Wednesday (today, in progress): 50 so far → unknowable, not missed
      mealObs('2026-07-01T12:00:00Z', { proteinG: 50 }),
    ];
    const s = nutritionBehaviorStatus(PROTEIN_FACE, entries, NOW, TODAY);
    expect(s).toEqual({
      kind: 'days',
      hits: 1,
      misses: 0,
      unknowable: 2,
      target: 5,
      windowLabel: 'this week',
    });
    expect(behaviorLine(s!)).toBe('1/5 days this week · 2 unknown');
  });
});

describe('nutritionBehaviorStatus — share (capture-method distribution)', () => {
  it('counts the window entries at/above the tier', () => {
    const entries = [
      mealObs('2026-06-29T12:00:00Z', { inputMethod: 'weighed' }), // T3
      mealObs('2026-06-30T12:00:00Z', { inputMethod: 'described' }), // T2
      mealObs('2026-06-30T18:00:00Z', { inputMethod: 'described', proteinG: null }), // T1 partial
      mealObs('2026-07-01T12:00:00Z', { inputMethod: 'photo' }), // T2
    ];
    const s = nutritionBehaviorStatus(FIDELITY_FACE, entries, NOW, TODAY);
    expect(s).toEqual({
      kind: 'share',
      pct: 75,
      targetPct: 80,
      minTier: 'T2',
      windowLabel: 'this week',
    });
    expect(behaviorLine(s!)).toBe('75% at T2+ this week · target 80%');
  });

  it('is honestly empty before any entry', () => {
    const s = nutritionBehaviorStatus(FIDELITY_FACE, [], NOW, TODAY);
    expect(s).toMatchObject({ kind: 'share', pct: null });
    expect(behaviorLine(s!)).toBe('no entries yet this week');
  });
});

describe('outcomeStatus — energyBalance', () => {
  const face: OutcomeFace = {
    dimension: { metric: 'energyBalance' },
    direction: 'down',
    target: 300,
  };
  const measured: ExpenditureWindow = {
    windowStart: '2026-06-15',
    windowEnd: '2026-06-28',
    meanIntakeKcal: 2200,
    trendDeltaKg: -0.5,
    inferredTdeeKcal: 2480,
    residualConfidence: 0.8,
    logCompleteness: 0.9,
    errorBandKcal: { low: 2300, high: 2660 },
  };

  it('reads the measured window: intake − burn, with the user target alongside', () => {
    const s = outcomeStatus(face, [], measured);
    expect(s).toEqual({ kind: 'balance', kcalPerDay: -280, targetKcal: 300 });
    expect(outcomeLine(s, 'kg')).toBe('≈ 280 cal/day deficit · measured · target ~300');
  });

  it('says "not enough data" until measurement exists — never a guess', () => {
    const s = outcomeStatus(face, [], null);
    expect(s).toEqual({ kind: 'noData', what: 'balance' });
    expect(outcomeLine(s, 'kg')).toBe('not enough data to measure yet');
  });
});

describe('nutritionWindowCounts — three-valued rhythm', () => {
  it('an undecidable past window renders hazed and never breaks the run', () => {
    // Three weeks: two weeks ago fully hit; last week undecidable (nothing
    // logged → every day unknowable); this week in progress.
    const twoAgoDays = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19'];
    const entries = twoAgoDays.map((d) => mealObs(`${d}T12:00:00Z`, { proteinG: 120 }));

    const counts = nutritionWindowCounts(PROTEIN_FACE, entries, NOW, 3, TODAY)!;
    expect(counts).toHaveLength(3);

    const [twoAgo, lastWeek, thisWeek] = counts;
    expect(twoAgo).toMatchObject({ count: 5, target: 5, complete: true, current: false });
    // Nothing logged last week: protein is unknowable, not missed — hazed.
    expect(lastWeek).toMatchObject({ count: 0, complete: false, current: false });
    expect(thisWeek).toMatchObject({ complete: false, current: true });

    // The revealed run reaches back through the haze to the hit week.
    expect(consecutiveAtTarget(counts)).toBe(1);
  });

  it('share rhythm: bars are percentages against the target pct', () => {
    const entries = [
      mealObs('2026-06-29T12:00:00Z', { inputMethod: 'weighed' }),
      mealObs('2026-06-30T12:00:00Z', { inputMethod: 'described' }),
    ];
    const counts = nutritionWindowCounts(FIDELITY_FACE, entries, NOW, 2, TODAY)!;
    const [lastWeek, thisWeek] = counts;
    expect(lastWeek).toMatchObject({ count: 0, complete: false }); // no entries → hazed zero
    expect(thisWeek).toMatchObject({ count: 100, target: 80, current: true });
  });
});

describe('currentWindowDayGrid — per-day cells (day-grain rhythm)', () => {
  it('one cell per calendar date in the window; days not yet reached are pending', () => {
    const entries = [
      // Monday: 120 g complete → hit
      mealObs('2026-06-29T12:00:00Z', { proteinG: 120 }),
      // Tuesday: partial, known 60 < 100 → unknowable
      mealObs('2026-06-30T12:00:00Z', { proteinG: 60 }),
      mealObs('2026-06-30T18:00:00Z', { proteinG: null }),
      // Wednesday (today, in progress): 50 so far → unknowable
      mealObs('2026-07-01T12:00:00Z', { proteinG: 50 }),
    ];
    const grid = currentWindowDayGrid(PROTEIN_FACE, entries, NOW, TODAY)!;
    expect(grid.map((c) => c.date)).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
    ]);
    // Thu–Sun haven't happened yet — 'pending', distinct from 'unknowable'
    // (a day that happened but proved nothing).
    expect(grid.map((c) => c.verdict)).toEqual([
      'hit',
      'unknowable',
      'unknowable',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('null for measures other than days (share, count)', () => {
    expect(currentWindowDayGrid(FIDELITY_FACE, [], NOW, TODAY)).toBeNull();
  });
});
