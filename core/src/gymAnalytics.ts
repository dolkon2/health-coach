/**
 * gymAnalytics.ts — e1RM trend, PR detection, and muscle-group tonnage
 * (Body P4). Pure math over already-logged `LiftingBlock` sets — no storage,
 * no React. Descriptive only: nothing here is stored (PRs/e1RM are
 * recomputed against history at render/save time, never persisted as their
 * own fact — constitution: don't invent a second source of truth for
 * something derivable from what was actually logged).
 *
 * Exercise grouping (e1RM/PR) keys on `exerciseId` when a set carries one
 * (library/ladder pick), normalized `exercise` name otherwise — the same
 * precedence as the ghost resolver (useExercisePatternMemory).
 *
 * Muscle tonnage needs primary/secondary muscle tags, which live in the
 * vendored exercise library (app data) — core never imports app data, so
 * callers resolve `exerciseId -> { primary, secondary }` and pass it in per
 * set. A set with no resolvable muscle data contributes nothing to tonnage,
 * never a guess (constitution: null ≠ 0).
 */
import type { LiftingBlock, LocalDate } from './observation';

// ─── e1RM ────────────────────────────────────────────────────────────────────

/** Epley gets noisy at high rep counts — sets above this are excluded from
 *  the e1RM series entirely, never clamped into the formula. */
export const EPLEY_MAX_REPS = 12;

// A minimal, self-contained normalization (core can't import the app-side
// normalizers in exercisePicker.ts / useExercisePatternMemory.ts — the core/
// app boundary, see file header). Fine here: this only needs to tell apart
// exercises the app itself already typed consistently, not fuzzy-match
// free text the way the picker's search does. Exported so app-side callers
// (e.g. benchmarkStatus.ts) key against the exact same derivation instead of
// re-deriving it.
export function exerciseKey(s: { exercise: string; exerciseId?: string }): string {
  return s.exerciseId ?? s.exercise.trim().toLowerCase();
}

function epley1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/** A working set: not a warmup, not a hold set (reps-based lifts only). */
function isWorkingRepsSet(s: LiftingBlock['sets'][number]): boolean {
  return !s.isWarmup && s.holdSec == null && s.reps > 0;
}

export type E1rmPoint = {
  date: LocalDate;
  exerciseKey: string;
  exercise: string; // display name, from the set that produced this point
  e1rmKg: number;
};

export type SessionSets = { date: LocalDate; sets: LiftingBlock['sets'] };

/**
 * Best-of-session e1RM per exercise, oldest first. Working sets only; a set
 * with reps > EPLEY_MAX_REPS contributes no point at all (Brzycki not in v1
 * — one estimator, applied honestly within its valid range).
 */
export function computeE1rmSeries(sessions: SessionSets[]): E1rmPoint[] {
  const points: E1rmPoint[] = [];
  for (const session of sessions) {
    const bestByKey = new Map<string, { exercise: string; e1rmKg: number }>();
    for (const s of session.sets) {
      if (!isWorkingRepsSet(s) || s.reps > EPLEY_MAX_REPS) continue;
      const e1rm = epley1rm(s.weightKg, s.reps);
      const key = exerciseKey(s);
      const cur = bestByKey.get(key);
      if (!cur || e1rm > cur.e1rmKg) bestByKey.set(key, { exercise: s.exercise, e1rmKg: e1rm });
    }
    for (const [key, v] of bestByKey) {
      points.push({ date: session.date, exerciseKey: key, exercise: v.exercise, e1rmKg: v.e1rmKg });
    }
  }
  return points;
}

// ─── PR detection ────────────────────────────────────────────────────────────

export type PrFlag =
  | { kind: 'e1rm'; exerciseKey: string; exercise: string; e1rmKg: number }
  | { kind: 'repsAtWeight'; exerciseKey: string; exercise: string; weightKg: number; reps: number }
  | { kind: 'setVolume'; exerciseKey: string; exercise: string; volumeKg: number };

// Round to 10 g (2 decimal places of kg) to absorb unit-conversion float
// noise (displayToKg) while still treating genuinely different weights —
// even a small plate change — as different.
function weightBucket(kg: number): number {
  return Math.round(kg * 100) / 100;
}

/**
 * PRs a new session's working sets against everything logged before it — new
 * best e1RM / best reps at an exact weight / best single-set volume, per
 * exercise. Flags are computed fresh from `history`, never read from a
 * stored flag (there isn't one). Hold sets never produce a PR of any kind —
 * volume/reps-at-weight are rep-based facts a hold set doesn't have. Nested
 * maps (never composite string keys) throughout, so an exercise name
 * containing a space or any other separator character can never corrupt a
 * key split.
 */
export function detectPRs(history: SessionSets[], newSession: SessionSets): PrFlag[] {
  const bestE1rm = new Map<string, number>();
  for (const p of computeE1rmSeries(history)) {
    bestE1rm.set(p.exerciseKey, Math.max(bestE1rm.get(p.exerciseKey) ?? -Infinity, p.e1rmKg));
  }
  // exerciseKey -> weightBucket -> max reps ever done at that exact weight.
  const bestRepsAtWeight = new Map<string, Map<number, number>>();
  const bestVolume = new Map<string, number>();
  for (const session of history) {
    for (const s of session.sets) {
      if (!isWorkingRepsSet(s)) continue;
      const key = exerciseKey(s);
      const byWeight = bestRepsAtWeight.get(key) ?? new Map<number, number>();
      bestRepsAtWeight.set(key, byWeight);
      const bucket = weightBucket(s.weightKg);
      byWeight.set(bucket, Math.max(byWeight.get(bucket) ?? -Infinity, s.reps));
      bestVolume.set(key, Math.max(bestVolume.get(key) ?? -Infinity, s.weightKg * s.reps));
    }
  }

  // Collapse the new session to its OWN best-of-session per exercise/weight
  // first, so a session with two improving sets on the same lift produces one
  // flag (the best), not one per qualifying set.
  const sessionBestRepsAtWeight = new Map<
    string,
    Map<number, { exercise: string; weightKg: number; reps: number }>
  >();
  const sessionBestVolume = new Map<string, { exercise: string; volumeKg: number }>();
  for (const s of newSession.sets) {
    if (!isWorkingRepsSet(s)) continue;
    const key = exerciseKey(s);
    const bucket = weightBucket(s.weightKg);
    const byWeight = sessionBestRepsAtWeight.get(key) ?? new Map();
    sessionBestRepsAtWeight.set(key, byWeight);
    const curW = byWeight.get(bucket);
    if (!curW || s.reps > curW.reps) {
      byWeight.set(bucket, { exercise: s.exercise, weightKg: s.weightKg, reps: s.reps });
    }
    const volume = s.weightKg * s.reps;
    const curV = sessionBestVolume.get(key);
    if (!curV || volume > curV.volumeKg) sessionBestVolume.set(key, { exercise: s.exercise, volumeKg: volume });
  }

  const flags: PrFlag[] = [];
  for (const p of computeE1rmSeries([newSession])) {
    if (p.e1rmKg > (bestE1rm.get(p.exerciseKey) ?? -Infinity)) {
      flags.push({ kind: 'e1rm', exerciseKey: p.exerciseKey, exercise: p.exercise, e1rmKg: p.e1rmKg });
    }
  }
  for (const [key, byWeight] of sessionBestRepsAtWeight) {
    for (const [bucket, v] of byWeight) {
      const priorBest = bestRepsAtWeight.get(key)?.get(bucket) ?? -Infinity;
      if (v.reps > priorBest) {
        flags.push({
          kind: 'repsAtWeight',
          exerciseKey: key,
          exercise: v.exercise,
          weightKg: v.weightKg,
          reps: v.reps,
        });
      }
    }
  }
  for (const [key, v] of sessionBestVolume) {
    if (v.volumeKg > (bestVolume.get(key) ?? -Infinity)) {
      flags.push({ kind: 'setVolume', exerciseKey: key, exercise: v.exercise, volumeKg: v.volumeKg });
    }
  }
  return flags;
}

// ─── Weekly tonnage by muscle group ─────────────────────────────────────────

/** The 14-group display vocabulary over the vendored 17-muscle tag set
 *  (Free Exercise DB) — lats/middle back/traps collapse to `back`,
 *  adductors/abductors collapse to `adductorsAbductors`. */
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'lowerBack',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'adductorsAbductors',
  'calves',
  'neck',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const RAW_MUSCLE_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  traps: 'back',
  'lower back': 'lowerBack',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abdominals: 'core',
  quadriceps: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  adductors: 'adductorsAbductors',
  abductors: 'adductorsAbductors',
  calves: 'calves',
  neck: 'neck',
};

/** Raw muscle tags (Free Exercise DB vocabulary) for one set's exercise —
 *  resolved by the caller from the vendored library; absent when the set
 *  isn't linked to a library entry (no honest tonnage attribution possible). */
export type MuscleInvolvement = { primary: string[]; secondary: string[] };

/**
 * weight×reps × involvement (primary 1.0, secondary 0.5) grouped into the
 * 14-group vocabulary. Hold sets, warmups, and sets with no resolvable
 * muscle data contribute NOTHING — never a fabricated or guessed group.
 */
export function computeMuscleTonnage(
  entries: Array<{ set: LiftingBlock['sets'][number]; muscles?: MuscleInvolvement }>
): Partial<Record<MuscleGroup, number>> {
  const totals: Partial<Record<MuscleGroup, number>> = {};
  for (const { set, muscles } of entries) {
    if (!isWorkingRepsSet(set) || !muscles) continue;
    const volume = set.weightKg * set.reps;
    if (volume <= 0) continue;
    for (const m of muscles.primary) {
      const group = RAW_MUSCLE_TO_GROUP[m];
      if (group) totals[group] = (totals[group] ?? 0) + volume;
    }
    for (const m of muscles.secondary) {
      const group = RAW_MUSCLE_TO_GROUP[m];
      if (group) totals[group] = (totals[group] ?? 0) + volume * 0.5;
    }
  }
  return totals;
}
