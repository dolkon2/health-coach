/**
 * ladders.ts — typed loader for the vendored calisthenics skill-ladder dataset.
 *
 * Provenance: hand-built at research time from the r/bodyweightfitness
 * Recommended Routine and its linked progressions (Antranik, GMB,
 * startbodyweight) — full per-chain sourcing and every leverage-factor
 * estimate is documented in the companion doc `ladders-notes.md`, which lives
 * beside this file so data and rationale never drift apart.
 *
 * Semantics the loader preserves (see the notes doc for the full spec):
 * - leverageFactor 1.0 = the chain's canonical full expression, not the last
 *   step; harder steps run past 1.0.
 * - `loadable: true` (weighted dip / weighted pull-up only) marks steps whose
 *   base factor deliberately EQUALS the unweighted anchor — position comes
 *   from effectiveLeverage as external load is added, so the trend line is
 *   continuous at +0 kg. Kept per ⚑ flag.
 * - advancement thresholds are DATA for opt-in prompts only — descriptive by
 *   default, never surfaced as prescriptions.
 */
import rawLadders from './ladders.json';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LadderGoal = 'reps' | 'duration';
export type LadderSetType = 'reps' | 'duration';

export type LadderStep = {
  id: string;
  name: string;
  setType: LadderSetType;
  /** Difficulty multiplier vs the chain anchor (1.0). Not a strict %BW. */
  leverageFactor: number;
  /** Community-standard move-up threshold — opt-in prompt data only. */
  advancement: { sets: number; repsOrSeconds: number };
  /** Present + true only on weighted steps (see header). */
  loadable?: boolean;
};

export type LadderChain = {
  id: string;
  name: string;
  goal: LadderGoal;
  steps: LadderStep[];
};

// ─── Loader ──────────────────────────────────────────────────────────────────

const chains = rawLadders as LadderChain[];

/** All 13 chains, in vendored order. */
export function ladderChains(): LadderChain[] {
  return chains;
}

/** Lookup a chain by id. */
export function ladderChainById(id: string): LadderChain | undefined {
  return chains.find((c) => c.id === id);
}

/** Find the chain + index a step belongs to (step ids are globally unique). */
export function ladderStepById(
  stepId: string,
): { chain: LadderChain; step: LadderStep; stepIndex: number } | undefined {
  for (const chain of chains) {
    const stepIndex = chain.steps.findIndex((s) => s.id === stepId);
    if (stepIndex >= 0) return { chain, step: chain.steps[stepIndex], stepIndex };
  }
  return undefined;
}
