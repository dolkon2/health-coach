/**
 * ladderTrend.ts — calisthenics skill-ladder progress (Body P3).
 *
 * Pure math over already-resolved ladder-step samples. Core never imports app
 * data (the vendored ladders dataset lives in src/data/), so this file takes
 * chain/step SHAPES as plain parameters — the app resolves which logged sets
 * belong to which chain/step and passes them in.
 *
 * Two views per chain, per ladders-notes.md's "Trend math" section:
 *
 *   - raw score: leverage-weighted best/volume set (effectiveLeverage ×
 *     reps/seconds) — an ordinal difficulty trend, NEVER an estimated 1RM or a
 *     joules figure (reps/seconds scale nonlinearly with difficulty).
 *   - ladder position: stepIndex + min(1, achieved / step.advancement
 *     threshold) — a unit-free, monotone position on the community-standard
 *     ladder that works across metric seams (dip: hold→reps; anti-extension:
 *     hold→reps). L-sit's "achieved" is ACCUMULATED seconds across the
 *     occurrence's sets (Antranik's accumulate-60s rule); every other chain
 *     uses the best single set — see ladders-notes.md's L-sit section. ⚑
 *
 * Loadable steps (weighted dip, weighted pull-up) compute a continuous
 * effectiveLeverage from trend bodyweight so the line has no seam at +0 kg
 * (ladders-notes.md "External load model": lf × (trendBW + addedLoad) /
 * trendBW, evaluated per set since added load can vary set to set). Missing
 * trend bodyweight on a loadable-step date degrades to the step's raw factor
 * (added load contributes nothing to the score that day) rather than
 * inventing a bodyweight — a known-conservative undercount, never a
 * fabricated one. ⚑
 */
import type { LocalDate } from './observation';

export type LadderTrendStep = {
  id: string;
  setType: 'reps' | 'duration';
  leverageFactor: number;
  advancement: { sets: number; repsOrSeconds: number };
  loadable?: boolean;
};

export type LadderTrendChain = {
  id: string;
  goal: 'reps' | 'duration';
  steps: LadderTrendStep[]; // ladder order — index IS stepIndex
};

/** One logged occurrence of a step: every set from one session, in order. */
export type LadderStepOccurrence = {
  date: LocalDate;
  stepId: string;
  sets: Array<{ reps?: number; holdSec?: number; weightKg: number }>;
};

export type LadderChainTrendPoint = {
  date: LocalDate;
  stepId: string;
  stepIndex: number;
  /** The best set's effective leverage (== leverageFactor for non-loadable steps). */
  effectiveLeverage: number;
  /** Best single set's leverage-weighted score. */
  bestScore: number;
  /** Leverage-weighted volume across the occurrence's sets. */
  volumeScore: number;
  /** stepIndex + min(1, achieved / threshold) — see header ⚑. */
  ladderPosition: number;
};

function amountFor(
  setType: 'reps' | 'duration',
  s: { reps?: number; holdSec?: number }
): number {
  return (setType === 'duration' ? s.holdSec : s.reps) ?? 0;
}

function setScore(
  step: LadderTrendStep,
  s: { reps?: number; holdSec?: number; weightKg: number },
  trendBwKg: number | null
): { effectiveLeverage: number; amount: number; score: number } {
  let effectiveLeverage = step.leverageFactor;
  if (step.loadable && trendBwKg != null && trendBwKg > 0) {
    effectiveLeverage = step.leverageFactor * ((trendBwKg + s.weightKg) / trendBwKg);
  }
  const amount = amountFor(step.setType, s);
  return { effectiveLeverage, amount, score: effectiveLeverage * amount };
}

/**
 * One chain's trend points, oldest first. Occurrences whose stepId isn't a
 * step of this chain are ignored (callers may pass a mixed-chain occurrence
 * list). `trendBodyweightKgAt` looks up the app's smoothed EWMA weight
 * (core/trend.ts) for a date — return null when there isn't one yet.
 */
export function computeLadderChainTrend(
  chain: LadderTrendChain,
  occurrences: LadderStepOccurrence[],
  trendBodyweightKgAt: (date: LocalDate) => number | null
): LadderChainTrendPoint[] {
  const stepIndexById = new Map(chain.steps.map((s, i) => [s.id, i]));
  return occurrences
    .filter((o) => stepIndexById.has(o.stepId))
    .map((o): LadderChainTrendPoint => {
      const stepIndex = stepIndexById.get(o.stepId)!;
      const step = chain.steps[stepIndex];
      const trendBw = trendBodyweightKgAt(o.date);
      const perSet = o.sets.map((s) => setScore(step, s, trendBw));
      const best = perSet.reduce<{ effectiveLeverage: number; amount: number; score: number }>(
        (a, b) => (b.score > a.score ? b : a),
        { effectiveLeverage: step.leverageFactor, amount: 0, score: 0 }
      );
      const volumeScore = perSet.reduce((sum, p) => sum + p.score, 0);
      // L-sit's achievement is accumulated seconds (Antranik's accumulate-60s
      // rule); every other chain compares its best single set.
      const achieved =
        chain.id === 'lsit-line'
          ? perSet.reduce((sum, p) => sum + p.amount, 0)
          : perSet.reduce((max, p) => Math.max(max, p.amount), 0);
      const ladderPosition =
        stepIndex + Math.min(1, achieved / step.advancement.repsOrSeconds);
      return {
        date: o.date,
        stepId: o.stepId,
        stepIndex,
        effectiveLeverage: best.effectiveLeverage,
        bestScore: best.score,
        volumeScore,
        ladderPosition,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The most recently logged step for a chain — "what step am I on now".
 *  Null if the chain has never been logged. */
export function currentLadderStep(
  points: LadderChainTrendPoint[]
): LadderChainTrendPoint | null {
  return points.length > 0 ? points[points.length - 1] : null;
}
