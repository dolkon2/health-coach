/**
 * expenditureInputs.ts — assemble the measured-TDEE engine's intake input from
 * logged meals (expenditure build, Pass D). Pure; the hook queries, this shapes.
 *
 * The day-total rule here is STRICTER than the Today card's `dailyTotals`, on
 * purpose. The card answers "what do I know I ate so far?" — a partial lunch
 * shouldn't erase a known breakfast. The residual solver answers "what did this
 * whole day add up to?" — and a day holding any kcal-unknown meal cannot answer
 * that honestly. Summing what's known would UNDERCOUNT the day and bias the
 * inferred TDEE low, which is worse than admitting the day is unknowable:
 * `null` lowers the window's logCompleteness (and so its residualConfidence)
 * instead of quietly corrupting the number (core/expenditure.ts DayIntake).
 *
 * Firewall (spine rule 1): intake + weight trend are the ONLY inputs the
 * measured TDEE ever gets. Training sessions never enter this path.
 */
import type { ObservationOf } from '@core/observation';
import type { DayIntake } from '@core/expenditure';
import { bucketByLocalDay } from '@core/timeline';

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Per-local-day intake for the residual solver. A day appears only if it has
 *  entries; its kcal is the full-day sum, or null when any meal's kcal is
 *  unknown. Ascending by date. */
export function dailyIntakeFromEntries(
  entries: ReadonlyArray<ObservationOf<'foodEntry'>>
): DayIntake[] {
  const byDay = bucketByLocalDay([...entries]);
  const out: DayIntake[] = [];
  for (const [date, obs] of byDay) {
    let sum = 0;
    let unknowable = false;
    for (const o of obs as ObservationOf<'foodEntry'>[]) {
      const kcal = o.payload.kcal;
      if (kcal == null) {
        unknowable = true;
        break;
      }
      sum += kcal;
    }
    out.push({ date, kcal: unknowable ? null : round1(sum) });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
