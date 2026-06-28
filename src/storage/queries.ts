/**
 * queries.ts — typed helpers over the generic Observation store.
 *
 * These are thin wrappers around `listObservations` for the common questions
 * the UI asks: "what did I eat today?" "what's my intake total?". The engine
 * never touches these — they belong to the UI/storage seam.
 */
import type { ObservationOf } from '@core/observation';
import { listObservations } from './observations';
import type { SqlDatabase } from './db';

/**
 * Food entries that occurred within the device's local civil day for `date`.
 * "Today" by default. The boundary is midnight in the device's current
 * timezone — late-night entries land on the day they were logged, per
 * data-model.md principle 4.
 *
 * Cross-tz reads (logged in one tz, viewed in another) are intentionally not
 * handled here yet — capture-time tz is on the obs, and proper per-tz day
 * bucketing belongs in `core/timeline.ts` once the engine needs it.
 */
export async function listFoodEntriesForDay(
  date: Date = new Date(),
  db?: SqlDatabase
): Promise<ObservationOf<'foodEntry'>[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const obs = await listObservations(
    {
      from: start.toISOString(),
      to: end.toISOString(),
      kinds: ['foodEntry'],
    },
    db
  );
  return obs as ObservationOf<'foodEntry'>[];
}

export type DailyIntakeTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  fidelity: number; // weighted by kcal; 0..1
  entryCount: number;
};

/** Sums macros and computes a kcal-weighted fidelity across the day's entries. */
export function totalsFromEntries(
  entries: ObservationOf<'foodEntry'>[]
): DailyIntakeTotals {
  if (entries.length === 0) {
    return { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, fidelity: 0, entryCount: 0 };
  }
  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let fiberG = 0;
  let weightedFid = 0;
  let fidWeight = 0;

  for (const o of entries) {
    const p = o.payload;
    kcal += p.kcal;
    proteinG += p.proteinG;
    carbsG += p.carbsG;
    fatG += p.fatG;
    fiberG += p.fiberG ?? 0;
    // Weight fidelity by kcal so a 5kcal salt entry doesn't drag down a 700kcal meal.
    const w = Math.max(p.kcal, 1);
    weightedFid += o.fidelity * w;
    fidWeight += w;
  }

  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    kcal: Math.round(kcal),
    proteinG: r1(proteinG),
    carbsG: r1(carbsG),
    fatG: r1(fatG),
    fiberG: r1(fiberG),
    fidelity: fidWeight > 0 ? weightedFid / fidWeight : 0,
    entryCount: entries.length,
  };
}
