/**
 * Expenditure-input assembly tests (expenditure build, Pass D). Proof:
 *   - a fully-known day sums its meals' calories;
 *   - a day holding ANY kcal-unknown meal is `null` — too partial to total
 *     honestly; an undercount would bias the residual TDEE low (stricter than
 *     the Today card's dailyTotals, on purpose);
 *   - days bucket by each observation's own local civil day (tz-aware);
 *   - no-entry days simply don't appear (the engine treats absent as missing).
 */
import { describe, it, expect } from '@jest/globals';
import type { ObservationOf } from '@core/observation';
import { dailyIntakeFromEntries } from '@/lib/expenditureInputs';

let n = 0;
function mealObs(
  occurredAt: string,
  kcal: number | null,
  tz = 'UTC'
): ObservationOf<'foodEntry'> {
  n += 1;
  return {
    id: `f${n}`,
    kind: 'foodEntry',
    occurredAt,
    loggedAt: occurredAt,
    tz,
    tier: 1,
    fidelity: 0.9,
    source: { type: 'manual' },
    payload: {
      kind: 'foodEntry',
      description: 'test meal',
      servings: 1,
      kcal,
      proteinG: 10,
      carbsG: 10,
      fatG: 10,
      items: [],
      inputMethod: 'weighed',
      fidelityCeiling: 0.98,
    },
  };
}

describe('dailyIntakeFromEntries', () => {
  it('sums a fully-known day', () => {
    const days = dailyIntakeFromEntries([
      mealObs('2026-06-01T08:00:00Z', 500),
      mealObs('2026-06-01T13:00:00Z', 700),
      mealObs('2026-06-01T19:00:00Z', 800),
    ]);
    expect(days).toEqual([{ date: '2026-06-01', kcal: 2000 }]);
  });

  it('a day with ANY kcal-unknown meal is null — never an undercount', () => {
    const days = dailyIntakeFromEntries([
      mealObs('2026-06-01T08:00:00Z', 500),
      mealObs('2026-06-01T13:00:00Z', null), // partial lunch
      mealObs('2026-06-02T08:00:00Z', 600),
    ]);
    expect(days).toEqual([
      { date: '2026-06-01', kcal: null },
      { date: '2026-06-02', kcal: 600 },
    ]);
  });

  it('buckets by each observation own local day (late-night meal lands on its civil day)', () => {
    // 2026-06-02T04:30Z in Los Angeles is still the evening of June 1.
    const days = dailyIntakeFromEntries([
      mealObs('2026-06-02T04:30:00Z', 900, 'America/Los_Angeles'),
    ]);
    expect(days).toEqual([{ date: '2026-06-01', kcal: 900 }]);
  });

  it('returns days sorted ascending, and no-entry days are simply absent', () => {
    const days = dailyIntakeFromEntries([
      mealObs('2026-06-03T12:00:00Z', 100),
      mealObs('2026-06-01T12:00:00Z', 200),
    ]);
    expect(days.map((d) => d.date)).toEqual(['2026-06-01', '2026-06-03']);
  });

  it('empty in, empty out', () => {
    expect(dailyIntakeFromEntries([])).toEqual([]);
  });
});
