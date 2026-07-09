/**
 * benchmarkSuggest.ts — the calculator-suggested-but-editable targets
 * (expenditure build, Pass F; locked decision: "the calculator may OFFER a
 * target … but it lands as a benchmark the user owns and edits —
 * prescription-on-request, never imposed. Default the field to the
 * suggestion; let them overwrite it.").
 *
 * Suggestions are pure functions of what the app already measures (trend
 * weight, current TDEE estimate) — null when the data isn't there, so an
 * empty field stays honestly empty rather than defaulting a number into
 * existence. All constants are documented, tunable heuristics.
 */

/** ≈ 0.8 g protein per lb bodyweight (the handoff's example rule), in g/kg. */
export const PROTEIN_G_PER_KG = 1.76;

/** ⚑ Suggested deficit under a "stay under" calorie benchmark. The handoff
 *  locks "deficit for a weight goal" but not its size; 300 kcal/day is the
 *  honest middle default (modest, sustainable) — flagged, not silently decided. */
export const SUGGESTED_DEFICIT_KCAL = 300;

const round5 = (x: number): number => Math.round(x / 5) * 5;
const round10 = (x: number): number => Math.round(x / 10) * 10;

/** Suggested daily protein grams from the measured trend weight. */
export function suggestProteinGrams(weightKg: number | null): number | null {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  return round5(weightKg * PROTEIN_G_PER_KG);
}

/** Suggested "stay under" calorie ceiling: the current TDEE estimate (measured
 *  when available, else the predicted baseline) minus a modest deficit. */
export function suggestCalorieCeiling(tdeeKcal: number | null): number | null {
  if (tdeeKcal == null || !Number.isFinite(tdeeKcal) || tdeeKcal <= 0) return null;
  return round10(tdeeKcal - SUGGESTED_DEFICIT_KCAL);
}

// ─── Ladder advancement (Body P6) ────────────────────────────────────────────

export type LadderAdvancementSuggestion = {
  /** e.g. "3×8 reps" / "3×20s" — the community-standard move-up gate for the
   *  user's CURRENT step (ladders-notes.md), descriptive text only. */
  title: string;
  metric: 'reps' | 'seconds';
  target: number;
};

/**
 * The current ladder step's own advancement threshold, as a suggestion
 * string a "suggest a benchmark" surface can show — OPT-IN, informational.
 * This function creates nothing: it has no storage access and returns a
 * plain value, never a Benchmark. Wiring it to an actual create action (a
 * future pass) must keep it opt-in — the spec is explicit that a ladder
 * benchmark is never auto-created from a logged step.
 */
export function suggestLadderAdvancement(step: {
  setType: 'reps' | 'duration';
  advancement: { sets: number; repsOrSeconds: number };
}): LadderAdvancementSuggestion {
  const isDuration = step.setType === 'duration';
  return {
    title: `${step.advancement.sets}×${step.advancement.repsOrSeconds}${isDuration ? 's' : ' reps'}`,
    metric: isDuration ? 'seconds' : 'reps',
    target: step.advancement.repsOrSeconds,
  };
}
