/**
 * Nutrition-benchmark form tests (expenditure build, Pass F). Proof:
 *   - the four nutrition picks seed BEHAVIOR faces with the right dimensions
 *     and measures (days predicates; entry-share for fidelity);
 *   - the fidelity benchmark builds a capture-tier share — the capture-method
 *     distribution, never anything derived;
 *   - a nutrition behavior can pair a bodyweight OR energy-balance outcome;
 *   - build → hydrate is an inverse for every nutrition path;
 *   - validation catches each missing field with a user-facing reason;
 *   - default titles read descriptively.
 */
import { describe, it, expect } from '@jest/globals';
import {
  emptyBenchmarkForm,
  buildBenchmarkFields,
  validateBenchmarkForm,
  formFromBenchmark,
  defaultTitle,
  summarizeBenchmark,
  type BenchmarkForm,
} from '@/lib/benchmarkForm';
import type { Benchmark } from '@core/benchmark';

const UNIT = 'kg' as const;

function calorieForm(over: Partial<BenchmarkForm> = {}): BenchmarkForm {
  return {
    ...emptyBenchmarkForm(),
    dimension: { kind: 'calories' },
    calorieOp: 'atMost',
    calorieKcal: '2200',
    daysTarget: '5',
    window: 'week',
    ...over,
  };
}

function benchmarkOf(form: BenchmarkForm): Benchmark {
  return {
    id: 'b1',
    createdAt: '2026-07-03T00:00:00Z',
    status: 'active',
    pinned: true,
    ...buildBenchmarkFields(form, UNIT),
  };
}

describe('nutrition behavior faces', () => {
  it('calories → days predicate over daily calories', () => {
    const { behavior, outcome } = buildBenchmarkFields(calorieForm(), UNIT);
    expect(outcome).toBeUndefined();
    expect(behavior).toEqual({
      dimension: { metric: 'calories' },
      window: 'week',
      measure: {
        type: 'days',
        target: 5,
        condition: { kind: 'calories', op: 'atMost', kcal: 2200 },
      },
    });
  });

  it('macro → days predicate carrying the chosen macro', () => {
    const form = {
      ...emptyBenchmarkForm(),
      dimension: { kind: 'macro' } as const,
      macro: 'protein' as const,
      macroOp: 'atLeast' as const,
      macroGrams: '150',
      daysTarget: '5',
    };
    const { behavior } = buildBenchmarkFields(form, UNIT);
    expect(behavior).toEqual({
      dimension: { metric: 'macro', macro: 'protein' },
      window: 'week',
      measure: {
        type: 'days',
        target: 5,
        condition: { kind: 'macro', macro: 'protein', op: 'atLeast', grams: 150 },
      },
    });
  });

  it('logging → days predicate on "complete-enough log"', () => {
    const form = { ...emptyBenchmarkForm(), dimension: { kind: 'logging' } as const, daysTarget: '6' };
    const { behavior } = buildBenchmarkFields(form, UNIT);
    expect(behavior?.dimension).toEqual({ metric: 'loggingConsistency' });
    expect(behavior?.measure).toEqual({ type: 'days', target: 6, condition: { kind: 'logged' } });
  });

  it('fidelity → entry share at a capture tier (the distribution, nothing else)', () => {
    const form = {
      ...emptyBenchmarkForm(),
      dimension: { kind: 'fidelity' } as const,
      fidelityPct: '80',
      fidelityMinTier: 'T2' as const,
    };
    const { behavior } = buildBenchmarkFields(form, UNIT);
    expect(behavior?.dimension).toEqual({ metric: 'loggingFidelity' });
    expect(behavior?.measure).toEqual({ type: 'share', targetPct: 80, minTier: 'T2' });
  });
});

describe('paired outcomes on nutrition paths', () => {
  it('pairs a bodyweight outcome by default', () => {
    const { outcome } = buildBenchmarkFields(
      calorieForm({ secondFace: true, direction: 'down' }),
      UNIT
    );
    expect(outcome).toEqual({ dimension: { metric: 'bodyweight' }, direction: 'down' });
  });

  it('pairs an energy-balance outcome with an optional kcal/day magnitude', () => {
    const { outcome } = buildBenchmarkFields(
      calorieForm({
        secondFace: true,
        outcomePairDim: 'energyBalance',
        balanceDirection: 'down',
        balanceKcal: '300',
      }),
      UNIT
    );
    expect(outcome).toEqual({
      dimension: { metric: 'energyBalance' },
      direction: 'down',
      target: 300,
    });
  });
});

describe('build ↔ hydrate (nutrition paths)', () => {
  it('round-trips a calorie benchmark with an energy-balance pairing', () => {
    const form = calorieForm({
      secondFace: true,
      outcomePairDim: 'energyBalance',
      balanceDirection: 'down',
      balanceKcal: '300',
    });
    const back = formFromBenchmark(benchmarkOf(form), UNIT);
    expect(back.dimension).toEqual({ kind: 'calories' });
    expect(back.calorieOp).toBe('atMost');
    expect(back.calorieKcal).toBe('2200');
    expect(back.daysTarget).toBe('5');
    expect(back.secondFace).toBe(true);
    expect(back.outcomePairDim).toBe('energyBalance');
    expect(back.balanceDirection).toBe('down');
    expect(back.balanceKcal).toBe('300');
  });

  it('round-trips macro, logging, and fidelity benchmarks', () => {
    const macro = formFromBenchmark(
      benchmarkOf({
        ...emptyBenchmarkForm(),
        dimension: { kind: 'macro' },
        macro: 'fiber',
        macroOp: 'atLeast',
        macroGrams: '30',
        daysTarget: '4',
      }),
      UNIT
    );
    expect(macro.dimension).toEqual({ kind: 'macro' });
    expect(macro.macro).toBe('fiber');
    expect(macro.macroGrams).toBe('30');

    const logging = formFromBenchmark(
      benchmarkOf({ ...emptyBenchmarkForm(), dimension: { kind: 'logging' }, daysTarget: '6' }),
      UNIT
    );
    expect(logging.dimension).toEqual({ kind: 'logging' });
    expect(logging.daysTarget).toBe('6');

    const fidelity = formFromBenchmark(
      benchmarkOf({
        ...emptyBenchmarkForm(),
        dimension: { kind: 'fidelity' },
        fidelityPct: '80',
        fidelityMinTier: 'T3',
      }),
      UNIT
    );
    expect(fidelity.dimension).toEqual({ kind: 'fidelity' });
    expect(fidelity.fidelityPct).toBe('80');
    expect(fidelity.fidelityMinTier).toBe('T3');
  });
});

describe('validation (user-facing reasons)', () => {
  it('catches missing amounts and day targets', () => {
    expect(validateBenchmarkForm(calorieForm({ calorieKcal: '' }))).toMatch(/calorie/i);
    expect(validateBenchmarkForm(calorieForm({ daysTarget: '' }))).toMatch(/days/i);
    expect(validateBenchmarkForm(calorieForm({ daysTarget: '9' }))).toMatch(/at most 7/i);
    expect(
      validateBenchmarkForm({
        ...emptyBenchmarkForm(),
        dimension: { kind: 'fidelity' },
        fidelityPct: '120',
      })
    ).toMatch(/between 1 and 100/i);
    expect(validateBenchmarkForm(calorieForm())).toBeNull();
  });
});

describe('titles + summaries (descriptive, never prescriptive)', () => {
  it('reads the calorie and fidelity defaults plainly', () => {
    expect(defaultTitle(calorieForm(), UNIT)).toBe('Under 2200 cal, 5 days/week');
    expect(
      defaultTitle(
        { ...emptyBenchmarkForm(), dimension: { kind: 'fidelity' }, fidelityPct: '80', fidelityMinTier: 'T2' },
        UNIT
      )
    ).toBe('80% of logs at T2+');
  });

  it('summarizes a days benchmark for the list', () => {
    expect(summarizeBenchmark(benchmarkOf(calorieForm()), UNIT)).toBe('Calories · 5 days/week');
  });
});
