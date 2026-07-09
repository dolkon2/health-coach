/**
 * exercisePicker.ts — the exercise picker's query layer (Body P3).
 *
 * Pure functions over the vendored seed data (src/data/exerciseLibrary,
 * src/data/ladders): normalized search with prefix-over-substring ranking, and
 * the two picker DATASETS — gym and calisthenics are deliberately separate
 * (Dylan's 3rd check-in: shared resolver mechanism, separate picker datasets).
 *
 *   gym           = Free Exercise DB entries scoped 'gym' | 'both'
 *   calisthenics  = skill-ladder steps + entries scoped 'calisthenics' | 'both'
 *
 * A pick fills the draft's `exerciseId` — a Free Exercise DB slug OR a ladder
 * step id (disjoint namespaces: Capitalized_Underscore vs kebab-case; both
 * resolve, via exerciseById / ladderStepById). The typed `name` stays the
 * stored fact; free-text entry is always allowed — the library is a
 * convenience, never a gate (constitution: never rewrite what the user logs).
 *
 * Ladder steps carry a hand-assigned movement pattern per chain (with per-step
 * unilateral overrides) — each assignment is individually judged and auditable
 * here, so they autofill silently like reviewed library entries. ⚑
 *
 * The Strong/Hevy alias table is NOT here — it ships with the CSV import (P5).
 */
import type { MovementPattern } from '@core/observation';
import { exerciseLibrary } from '@/data/exerciseLibrary';
import { ladderChains } from '@/data/ladders';

// ─── Types ───────────────────────────────────────────────────────────────────

/** One pickable row: a library exercise or a skill-ladder step. */
export type PickerEntry = {
  /** Free Exercise DB slug ('Barbell_Squat') or ladder step id ('dip-weighted'). */
  id: string;
  /** Display name; becomes the stored `exercise` fact when picked. */
  name: string;
  source: 'library' | 'ladder';
  movementPattern: MovementPattern;
  /** True → autofill the pattern silently; false → prefill, visibly editable. */
  patternReviewed: boolean;
  /** 'duration' auto-enables the hold-seconds column. Absent = reps entry. */
  entryType?: 'reps' | 'duration';
  /** Ladder entries only: the chain the step belongs to. */
  chainId?: string;
  /** Pre-normalized name, computed once at dataset build (search hot path). */
  normName: string;
};

// ─── Normalization ───────────────────────────────────────────────────────────

/**
 * The one normalization both search and the ghost-memory keys share:
 * lowercase, punctuation → space, whitespace collapsed. "Pull-Up" ≡ "pull up".
 */
export function normalizeExerciseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Ladder-step movement patterns (hand-assigned, auditable) ────────────────

/**
 * Chain → movement pattern. Judgment calls, one line each: levers are
 * straight-arm pulling (lats) → upper-pull; planche / handstand lines load
 * pressing shoulders → upper-push; L-sit and anti-extension are core work;
 * the squat chain is quad-dominant until its single-leg steps (see
 * STEP_PATTERN_OVERRIDES).
 */
export const CHAIN_PATTERN: Record<string, MovementPattern> = {
  'pushup-line': 'upper-push',
  'dip-line': 'upper-push',
  'pullup-line': 'upper-pull',
  'row-line': 'upper-pull',
  'squat-line': 'quad-dom',
  'hinge-line': 'hip-hinge',
  'lsit-line': 'core',
  'front-lever-line': 'upper-pull',
  'back-lever-line': 'upper-pull',
  'planche-line': 'upper-push',
  'handstand-line': 'upper-push',
  'handstand-pushup-line': 'upper-push',
  'anti-extension-line': 'core',
};

/** Steps whose stance diverges from their chain's pattern (single-leg work). */
export const STEP_PATTERN_OVERRIDES: Record<string, MovementPattern> = {
  'squat-split': 'unilateral-leg',
  'squat-bulgarian-split': 'unilateral-leg',
  'squat-shrimp-beginner': 'unilateral-leg',
  'squat-shrimp-intermediate': 'unilateral-leg',
  'squat-shrimp-advanced': 'unilateral-leg',
  'hinge-single-leg-deadlift': 'unilateral-leg',
};

// ─── Datasets ────────────────────────────────────────────────────────────────

let gymCache: PickerEntry[] | null = null;
let caliCache: PickerEntry[] | null = null;

/** Gym picker dataset: library entries scoped 'gym' or 'both'. Memoized. */
export function gymPickerEntries(): PickerEntry[] {
  if (gymCache) return gymCache;
  gymCache = exerciseLibrary()
    .filter((e) => e.pickerScope === 'gym' || e.pickerScope === 'both')
    .map((e) => ({
      id: e.id,
      name: e.name,
      source: 'library' as const,
      movementPattern: e.movementPattern,
      patternReviewed: e.patternReviewed,
      ...(e.entryType != null ? { entryType: e.entryType } : {}),
      normName: normalizeExerciseName(e.name),
    }));
  return gymCache;
}

/**
 * Calisthenics picker dataset: every skill-ladder step (the calisthenics-native
 * movements — tuck levers, shrimp squats — that Free Exercise DB doesn't carry)
 * plus library entries scoped 'calisthenics' or 'both'. Ladder steps lead the
 * list so a progression name outranks a same-prefix library row. Memoized.
 */
export function calisthenicsPickerEntries(): PickerEntry[] {
  if (caliCache) return caliCache;
  const steps: PickerEntry[] = ladderChains().flatMap((chain) =>
    chain.steps.map((s) => ({
      id: s.id,
      name: s.name,
      source: 'ladder' as const,
      movementPattern: STEP_PATTERN_OVERRIDES[s.id] ?? CHAIN_PATTERN[chain.id] ?? 'other',
      patternReviewed: true, // hand-assigned above, per chain — see header ⚑
      entryType: s.setType,
      chainId: chain.id,
      normName: normalizeExerciseName(s.name),
    }))
  );
  const library = exerciseLibrary()
    .filter((e) => e.pickerScope === 'calisthenics' || e.pickerScope === 'both')
    .map((e) => ({
      id: e.id,
      name: e.name,
      source: 'library' as const,
      movementPattern: e.movementPattern,
      patternReviewed: e.patternReviewed,
      ...(e.entryType != null ? { entryType: e.entryType } : {}),
      normName: normalizeExerciseName(e.name),
    }));
  caliCache = [...steps, ...library];
  return caliCache;
}

/**
 * The dataset for a logging context. Only the calisthenics identity gets the
 * ladder-aware dataset; every other gym-surface activity (gym, strength,
 * crossfit) and the legacy modality-only quick-log path use the gym dataset.
 */
export function pickerEntriesForActivity(activityId: string | undefined): PickerEntry[] {
  return activityId === 'calisthenics' ? calisthenicsPickerEntries() : gymPickerEntries();
}

/** Resolve a stored exerciseId back to its entry — either namespace. */
export function pickerEntryById(id: string): PickerEntry | undefined {
  return (
    calisthenicsPickerEntries().find((e) => e.id === id) ??
    gymPickerEntries().find((e) => e.id === id)
  );
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Normalized search over a dataset: prefix matches rank above substring
 * matches; within each band the dataset's own order is preserved (ladder steps
 * stay in progression order). Empty/whitespace query → no results, never the
 * whole list.
 */
export function searchExercises(
  entries: PickerEntry[],
  query: string,
  limit = 8
): PickerEntry[] {
  const q = normalizeExerciseName(query);
  if (q === '') return [];
  const prefix: PickerEntry[] = [];
  const substr: PickerEntry[] = [];
  for (const e of entries) {
    if (e.normName.startsWith(q)) prefix.push(e);
    else if (e.normName.includes(q)) substr.push(e);
  }
  return [...prefix, ...substr].slice(0, limit);
}
