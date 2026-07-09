/**
 * importExerciseResolve.ts — resolves a Strong/Hevy raw exercise name to a
 * Free Exercise DB entry for CSV import (Body P5). Never blocks an import:
 * an unmatched exercise still imports as a custom set with pattern 'other',
 * preserving the raw name (constitution: the sets are facts regardless of
 * taxonomy; pattern assignment refines analysis later, format-spec.md §3).
 *
 * Pipeline, in order: exact normalized match -> hand-verified alias table
 * (importAliases.ts) -> Jaccard token-overlap fuzzy match. >=0.90 auto-
 * accepts; 0.75-0.90 is surfaced as a confirm candidate on the import-review
 * screen but is NOT applied automatically; below 0.75 is unmatched.
 */
import type { MovementPattern } from '@core/observation';
import { exerciseLibrary, type LibraryExercise } from '@/data/exerciseLibrary';
import { normalizeExerciseName } from './exercisePicker';
import { EXERCISE_ALIASES, rewriteStrongHevyName } from './importAliases';

export const FUZZY_AUTO_THRESHOLD = 0.9;
export const FUZZY_CONFIRM_THRESHOLD = 0.75;

export type ExerciseCandidate = { exerciseId: string; name: string; score: number };

export type ExerciseResolution = {
  status: 'exact' | 'alias' | 'fuzzy' | 'ambiguous' | 'unmatched';
  /** Set only when status is exact/alias/fuzzy (score >= FUZZY_AUTO_THRESHOLD). */
  exerciseId?: string;
  /** The movement pattern to write — 'other' when unmatched/ambiguous, never a guess. */
  movementPattern: MovementPattern;
  /** Set only when status is 'ambiguous' — for the import-review confirm list. */
  candidates?: ExerciseCandidate[];
};

function tokenSet(name: string): Set<string> {
  return new Set(normalizeExerciseName(name).split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

let libraryTokenCache: Array<{ entry: LibraryExercise; tokens: Set<string> }> | null = null;
function libraryTokens() {
  if (!libraryTokenCache) {
    libraryTokenCache = exerciseLibrary().map((entry) => ({ entry, tokens: tokenSet(entry.name) }));
  }
  return libraryTokenCache;
}

export function resolveExerciseName(rawName: string): ExerciseResolution {
  const rewritten = rewriteStrongHevyName(rawName);
  const key = normalizeExerciseName(rewritten);

  const aliasTarget = EXERCISE_ALIASES[key];
  if (aliasTarget) {
    const lib = exerciseLibrary().find((e) => e.name === aliasTarget);
    if (lib) return { status: 'alias', exerciseId: lib.id, movementPattern: lib.movementPattern };
  }

  const exact = exerciseLibrary().find((e) => normalizeExerciseName(e.name) === key);
  if (exact) return { status: 'exact', exerciseId: exact.id, movementPattern: exact.movementPattern };

  const wantTokens = tokenSet(rewritten);
  const candidates: ExerciseCandidate[] = [];
  let best: { entry: LibraryExercise; score: number } | null = null;
  for (const { entry, tokens } of libraryTokens()) {
    const score = jaccard(wantTokens, tokens);
    if (score >= FUZZY_CONFIRM_THRESHOLD) candidates.push({ exerciseId: entry.id, name: entry.name, score });
    if (!best || score > best.score) best = { entry, score };
  }
  candidates.sort((a, b) => b.score - a.score);

  if (best && best.score >= FUZZY_AUTO_THRESHOLD) {
    return { status: 'fuzzy', exerciseId: best.entry.id, movementPattern: best.entry.movementPattern };
  }
  if (candidates.length > 0) {
    return { status: 'ambiguous', movementPattern: 'other', candidates: candidates.slice(0, 5) };
  }
  return { status: 'unmatched', movementPattern: 'other' };
}
