/**
 * captureTier.ts — capture method as the legible unit (expenditure build,
 * Pass C; Dylan's tier revision, locked in the handoff):
 *
 *   T1 — incomplete log: a bare macro ("42g protein"). Lowest, regardless of
 *        method — incompleteness trumps how the rest was captured.
 *   T2 — describe OR photo (description gets surprisingly accurate).
 *   T3 — weighed / scanned. Precise.
 *
 * This is the chunk users can SEE and control — the substrate the fidelity
 * benchmark counts ("80% of entries at T2+", a capture-method distribution).
 * Three things it is NOT:
 *   - the continuous 0..1 fidelity (never a number on screen);
 *   - the engine's derived earned-fidelity score (a benchmark must NEVER
 *     target that — Goodhart; see the handoff's fidelity-benchmark firewall);
 *   - the Observation evidence tier 1/2/3 — hence string codes 'T1'|'T2'|'T3',
 *     so the two can't be mixed by accident.
 */
import type { FoodEntryPayload } from '../observation';
import { isPartial } from '../observation';

export type CaptureTier = 'T1' | 'T2' | 'T3';

type MealCapture = Pick<
  FoodEntryPayload,
  'inputMethod' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG'
>;

/** The capture tier of one logged meal — structural, read from the data. */
export function captureTier(meal: MealCapture): CaptureTier {
  if (isPartial(meal)) return 'T1';
  switch (meal.inputMethod) {
    case 'weighed':
    case 'barcode':
      return 'T3';
    case 'described':
    case 'photo':
      return 'T2';
  }
}

/** Numeric rank for threshold comparisons ("at T2 or above"). */
export function captureTierRank(tier: CaptureTier): 1 | 2 | 3 {
  return tier === 'T3' ? 3 : tier === 'T2' ? 2 : 1;
}

/** The method word an entry shows — user vocabulary, not enum names. */
const METHOD_WORD: Record<FoodEntryPayload['inputMethod'], string> = {
  weighed: 'weighed',
  barcode: 'scanned',
  described: 'described',
  photo: 'photo',
};

/** The on-entry label: "T3 · weighed", "T2 · photo", "T1 · partial". */
export function captureLabel(meal: MealCapture): string {
  const tier = captureTier(meal);
  return tier === 'T1' ? 'T1 · partial' : `${tier} · ${METHOD_WORD[meal.inputMethod]}`;
}
