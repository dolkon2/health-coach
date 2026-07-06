/**
 * breathwork.ts — typed loader for the vendored breathwork pattern library.
 *
 * Provenance: `breathwork-patterns.json` was hand-built at research time from
 * primary/clinical sources (each pattern carries its own `sources` list) and
 * is vendored VERBATIM — the `cautions` arrays are non-negotiable copy and
 * must reach the display layer word for word (the WHM shallow-water-blackout
 * warnings in particular). Never trim, soften, or summarize them.
 *
 * Capture semantics (mirrors core/src/observation.ts BreathworkRound):
 * - `untimed: true` phases end on user action or the urge to breathe — a
 *   pacer must never count them down.
 * - `capture: 'retention'` marks the untimed hold whose elapsed time is
 *   recorded per round as BreathworkRound.retentionSeconds. Capture is
 *   provenance only; best/avg are derived at render, never stored.
 * - Exactly one of defaultCycles / defaultMinutes is present per pattern.
 * - Descriptions are descriptive — what the pattern IS and where it comes
 *   from, never what it will do for you (constitution).
 */
import rawPatterns from './breathwork-patterns.json';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BreathPhaseType = 'inhale' | 'hold' | 'exhale' | 'holdEmpty';

export type BreathPhase = {
  type: BreathPhaseType;
  /** Seconds for the phase; null ONLY when untimed is true. */
  seconds: number | null;
  /** True = ends on user action / urge to breathe, never a timer. */
  untimed?: boolean;
  /** 'retention' = elapsed time recorded as BreathworkRound.retentionSeconds. */
  capture?: 'retention';
  /** Phases sharing a group id repeat together; count in pattern.groups[id]. */
  group?: string;
  /** Display-only cue text. */
  label?: string;
};

export type BreathPatternGroup = { repeat: number; repeatMax?: number; label?: string };

export type BreathPattern = {
  id: string;
  name: string;
  phases: BreathPhase[];
  groups?: Record<string, BreathPatternGroup>;
  /** Exactly one of the two is present. */
  defaultCycles?: number;
  defaultMinutes?: number;
  /** Display noun for one pass through phases; default 'cycle'. */
  cycleLabel?: string;
  /** Honesty note where sources prescribe a shape/ratio, not exact seconds. */
  timingNote?: string;
  description: string;
  /** Non-negotiable copy — display verbatim. May be empty, never absent. */
  cautions: string[];
  sources: string[];
};

type PatternsFile = { version: number; patterns: BreathPattern[] };

// ─── Loader ──────────────────────────────────────────────────────────────────

const file = rawPatterns as unknown as PatternsFile;

/** All 8 patterns, in vendored order. */
export function breathPatterns(): BreathPattern[] {
  return file.patterns;
}

/** Lookup by id. */
export function breathPatternById(id: string): BreathPattern | undefined {
  return file.patterns.find((p) => p.id === id);
}
