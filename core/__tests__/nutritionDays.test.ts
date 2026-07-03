/**
 * Three-valued day-predicate tests (expenditure build, Pass E) — the honesty
 * win, proven:
 *   - a complete day is HIT or MISSED; an incomplete-data day is UNKNOWABLE —
 *     never counted a miss;
 *   - verdicts use BOUNDS: a partial day whose known protein already clears
 *     "≥ X" is a provable hit; a day already over "≤ Y" is a provable miss;
 *   - the in-progress day yields only irreversible verdicts;
 *   - 'logged' is deliberately two-valued on closed days — not logging IS the
 *     miss;
 *   - a window is missed only when mathematically dead, hit only when proven,
 *     otherwise unknowable;
 *   - runs skip unknowable days (never broken, never extended);
 *   - averages run over complete days only, completeness shown, never
 *     zero-padded;
 *   - the fidelity share counts capture tiers over entries — the
 *     capture-method distribution, nothing else.
 */
import { describe, it, expect } from '@jest/globals';
import type { DayCondition } from '@core/benchmark';
import {
  evaluateDayCondition,
  evaluateDaysWindow,
  revealedRun,
  completeDayAverage,
  captureTierShare,
  type DayVerdict,
  type MealForDay,
  type NutritionDay,
} from '@core/nutrition/days';
import type { InputMethod } from '@core/observation';

function m(
  proteinG: number | null,
  over: Partial<MealForDay> = {},
  inputMethod: InputMethod = 'weighed'
): MealForDay {
  return { kcal: 500, proteinG, carbsG: 40, fatG: 20, inputMethod, ...over };
}

function day(date: string, meals: MealForDay[], inProgress = false): NutritionDay {
  return { date, meals, inProgress };
}

const PROTEIN_150: DayCondition = { kind: 'macro', macro: 'protein', op: 'atLeast', grams: 150 };
const KCAL_MAX_2000: DayCondition = { kind: 'calories', op: 'atMost', kcal: 2000 };
const LOGGED: DayCondition = { kind: 'logged' };

describe('evaluateDayCondition — closed days', () => {
  it('atLeast: complete day hits or misses on the total', () => {
    expect(evaluateDayCondition(day('2026-06-01', [m(90), m(70)]), PROTEIN_150)).toBe('hit');
    expect(evaluateDayCondition(day('2026-06-01', [m(90), m(40)]), PROTEIN_150)).toBe('missed');
  });

  it('atLeast: a partial day whose KNOWN protein already clears the bar is a provable hit', () => {
    // 160g known + one protein-unknown meal — the lower bound crossed 150.
    const d = day('2026-06-01', [m(160), m(null)]);
    expect(evaluateDayCondition(d, PROTEIN_150)).toBe('hit');
  });

  it('atLeast: a partial day below the bar is UNKNOWABLE, never a miss', () => {
    const d = day('2026-06-01', [m(90), m(null)]);
    expect(evaluateDayCondition(d, PROTEIN_150)).toBe('unknowable');
  });

  it('atMost: already over the ceiling is a provable miss, even on a partial day', () => {
    const over = day('2026-06-01', [m(90, { kcal: 1400 }), m(null, { kcal: 900 })]);
    expect(evaluateDayCondition(over, KCAL_MAX_2000)).toBe('missed');
  });

  it('atMost: a complete day under the ceiling hits; a partial day under it is unknowable', () => {
    expect(evaluateDayCondition(day('2026-06-01', [m(90, { kcal: 1800 })]), KCAL_MAX_2000)).toBe('hit');
    const partial = day('2026-06-01', [m(90, { kcal: 1200 }), m(50, { kcal: null })]);
    expect(evaluateDayCondition(partial, KCAL_MAX_2000)).toBe('unknowable');
  });

  it('a day with nothing logged is unknowable for intake conditions', () => {
    expect(evaluateDayCondition(day('2026-06-01', []), PROTEIN_150)).toBe('unknowable');
    expect(evaluateDayCondition(day('2026-06-01', []), KCAL_MAX_2000)).toBe('unknowable');
  });

  it('fiber rides the optional field honestly: absent fiber → unknowable', () => {
    const fiber30: DayCondition = { kind: 'macro', macro: 'fiber', op: 'atLeast', grams: 30 };
    expect(evaluateDayCondition(day('2026-06-01', [m(90)]), fiber30)).toBe('unknowable');
    expect(
      evaluateDayCondition(day('2026-06-01', [m(90, { fiberG: 18 }), m(80, { fiberG: 14 })]), fiber30)
    ).toBe('hit');
  });

  it('logged is two-valued on closed days: absence IS the miss', () => {
    expect(evaluateDayCondition(day('2026-06-01', [m(90)]), LOGGED)).toBe('hit');
    expect(evaluateDayCondition(day('2026-06-01', []), LOGGED)).toBe('missed');
    // A partial meal fails "complete-enough".
    expect(evaluateDayCondition(day('2026-06-01', [m(90), m(null)]), LOGGED)).toBe('missed');
  });
});

describe('evaluateDayCondition — the in-progress day (only irreversible verdicts)', () => {
  it('atLeast: crossed → hit; not yet → unknowable (never missed mid-day)', () => {
    expect(evaluateDayCondition(day('2026-06-01', [m(160)], true), PROTEIN_150)).toBe('hit');
    expect(evaluateDayCondition(day('2026-06-01', [m(90)], true), PROTEIN_150)).toBe('unknowable');
  });

  it('atMost: blown → missed; under → unknowable (dinner still coming)', () => {
    expect(
      evaluateDayCondition(day('2026-06-01', [m(90, { kcal: 2200 })], true), KCAL_MAX_2000)
    ).toBe('missed');
    expect(
      evaluateDayCondition(day('2026-06-01', [m(90, { kcal: 1400 })], true), KCAL_MAX_2000)
    ).toBe('unknowable');
  });

  it('logged: complete-so-far → hit; nothing yet → unknowable, not missed', () => {
    expect(evaluateDayCondition(day('2026-06-01', [m(90)], true), LOGGED)).toBe('hit');
    expect(evaluateDayCondition(day('2026-06-01', [], true), LOGGED)).toBe('unknowable');
  });
});

describe('evaluateDaysWindow — three-valued at the window grain', () => {
  const hitDay = (date: string) => day(date, [m(160)]);
  const missDay = (date: string) => day(date, [m(40)]);
  const hazyDay = (date: string) => day(date, [m(90), m(null)]);

  it('hit when proven, with the full tally exposed', () => {
    const r = evaluateDaysWindow(
      [hitDay('2026-06-01'), hitDay('2026-06-02'), missDay('2026-06-03'), hazyDay('2026-06-04')],
      PROTEIN_150,
      2
    );
    expect(r.verdict).toBe('hit');
    expect(r).toMatchObject({ hits: 2, misses: 1, unknowable: 1, target: 2 });
    expect(r.byDate.map((d) => d.verdict)).toEqual(['hit', 'hit', 'missed', 'unknowable']);
  });

  it('unknowable days never count as misses: short of target but not dead → unknowable', () => {
    const r = evaluateDaysWindow(
      [hitDay('2026-06-01'), hazyDay('2026-06-02'), missDay('2026-06-03')],
      PROTEIN_150,
      2
    );
    expect(r.verdict).toBe('unknowable'); // the hazy day COULD have hit
  });

  it('missed only when mathematically dead', () => {
    const r = evaluateDaysWindow(
      [missDay('2026-06-01'), missDay('2026-06-02'), hitDay('2026-06-03')],
      PROTEIN_150,
      2,
      { totalDays: 3 }
    );
    expect(r.verdict).toBe('missed'); // 1 hit, no unknowables, no days left
  });

  it('an in-progress window with days still to come stays open (never dead early)', () => {
    // Tuesday of a 7-day window: 2 misses so far, target 5 — 5 future days remain.
    const r = evaluateDaysWindow(
      [missDay('2026-06-01'), missDay('2026-06-02')],
      PROTEIN_150,
      5,
      { totalDays: 7 }
    );
    expect(r.verdict).toBe('unknowable');
    // …but target 6 with only 5 possible days left IS dead:
    const dead = evaluateDaysWindow(
      [missDay('2026-06-01'), missDay('2026-06-02')],
      PROTEIN_150,
      6,
      { totalDays: 7 }
    );
    expect(dead.verdict).toBe('missed');
  });
});

describe('revealedRun — unknowable neither breaks nor extends', () => {
  const run = (vs: DayVerdict[]) => revealedRun(vs);

  it('counts consecutive hits back from the end, skipping unknowable', () => {
    expect(run(['hit', 'missed', 'hit', 'unknowable', 'hit'])).toBe(2);
    expect(run(['hit', 'hit', 'unknowable'])).toBe(2);
    expect(run(['unknowable', 'unknowable'])).toBe(0);
    expect(run([])).toBe(0);
  });

  it('a miss ends the run; unknowable in between does not', () => {
    expect(run(['hit', 'hit', 'missed'])).toBe(0);
    expect(run(['missed', 'hit', 'unknowable', 'hit'])).toBe(2);
  });
});

describe('completeDayAverage — never zero-padded, completeness shown', () => {
  it('averages complete closed days only ("2,180 avg · 5 of 7 days logged")', () => {
    const days: NutritionDay[] = [
      day('2026-06-01', [m(90, { kcal: 2000 })]),
      day('2026-06-02', [m(90, { kcal: 2360 })]),
      day('2026-06-03', [m(90, { kcal: null })]), // partial — excluded
      day('2026-06-04', []), // nothing logged — excluded
      day('2026-06-05', [m(90, { kcal: 2180 })]),
    ];
    const avg = completeDayAverage(days, 'kcal');
    expect(avg).toEqual({ avgPerDay: 2180, knownDays: 3, totalDays: 5 });
  });

  it('skips the in-progress day entirely (a half-eaten day would skew low)', () => {
    const days: NutritionDay[] = [
      day('2026-06-01', [m(90, { kcal: 2000 })]),
      day('2026-06-02', [m(90, { kcal: 600 })], true),
    ];
    expect(completeDayAverage(days, 'kcal')).toEqual({
      avgPerDay: 2000,
      knownDays: 1,
      totalDays: 1,
    });
  });

  it('no complete days → null, never a fabricated 0', () => {
    expect(completeDayAverage([day('2026-06-01', [])], 'kcal')).toBeNull();
  });

  it('averages macros too (protein)', () => {
    const days = [day('2026-06-01', [m(100), m(60)]), day('2026-06-02', [m(120)])];
    expect(completeDayAverage(days, 'protein')).toEqual({
      avgPerDay: 140,
      knownDays: 2,
      totalDays: 2,
    });
  });
});

describe('captureTierShare — the capture-method distribution (firewall-safe)', () => {
  it('counts entries at/above the tier across the window', () => {
    const days: NutritionDay[] = [
      day('2026-06-01', [m(90), m(80, {}, 'described')]), // T3, T2
      day('2026-06-02', [m(70, {}, 'photo'), m(null, {}, 'described')]), // T2, T1(partial)
    ];
    expect(captureTierShare(days, 'T2')).toEqual({ pct: 75, atOrAbove: 3, totalEntries: 4 });
    expect(captureTierShare(days, 'T3')).toEqual({ pct: 25, atOrAbove: 1, totalEntries: 4 });
  });

  it('no entries → null (a share of nothing is not 0%)', () => {
    expect(captureTierShare([day('2026-06-01', [])], 'T2')).toBeNull();
  });
});
