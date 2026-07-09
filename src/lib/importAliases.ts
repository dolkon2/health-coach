/**
 * importAliases.ts — Strong/Hevy exercise-name resolution for CSV import
 * (Body P5). Both apps name exercises "Name (Equipment)" — "Bench Press
 * (Barbell)", "Lat Pulldown (Cable)" — a convention the Free Exercise DB
 * doesn't share (it's "Barbell Bench Press", equipment-first). Two layers:
 *
 *   1. `rewriteStrongHevyName` — a mechanical rule: move the parenthetical
 *      equipment to the front. Cheap and gets the common case free.
 *   2. `EXERCISE_ALIASES` — hand-verified overrides for names the mechanical
 *      rewrite doesn't land on an exact FEDB entry (e.g. Strong's default
 *      "Bench Press (Barbell)" means the flat/medium-grip version, which
 *      FEDB lists as "Barbell Bench Press - Medium Grip", not a bare
 *      "Barbell Bench Press" that doesn't exist in the dataset). ⚑ 36
 *      entries covering the highest-volume lifts this round — not the ~50
 *      ceiling the spec estimated; extend the table as real exports surface
 *      more misses (never guess when the mechanical rewrite already lands
 *      correctly, e.g. "Barbell Squat", "Barbell Deadlift").
 *
 * Keys are the OUTPUT of rewriteStrongHevyName, normalized (lowercase, no
 * punctuation) — the same normalization exercisePicker.ts's picker search
 * uses, so alias keys and FEDB name lookups compare on equal footing.
 */
import { normalizeExerciseName } from './exercisePicker';

/**
 * "Bench Press (Barbell)" -> "Barbell Bench Press". A name with no
 * parenthetical (e.g. "Push Up", "Plank") passes through unchanged.
 */
export function rewriteStrongHevyName(rawName: string): string {
  const m = rawName.trim().match(/^(.*\S)\s*\(([^)]+)\)\s*$/);
  if (!m) return rawName.trim();
  const [, base, equipment] = m;
  return `${equipment.trim()} ${base.trim()}`;
}

/** Alias key (normalized rewritten name) -> exact Free Exercise DB name. */
export const EXERCISE_ALIASES: Record<string, string> = {
  [normalizeExerciseName('Barbell Bench Press')]: 'Barbell Bench Press - Medium Grip',
  [normalizeExerciseName('Barbell Incline Bench Press')]: 'Barbell Incline Bench Press - Medium Grip',
  [normalizeExerciseName('Barbell Overhead Press')]: 'Standing Military Press',
  [normalizeExerciseName('Barbell Shoulder Press')]: 'Standing Military Press',
  [normalizeExerciseName('Barbell Row')]: 'Bent Over Barbell Row',
  [normalizeExerciseName('Barbell Bent Over Row')]: 'Bent Over Barbell Row',
  [normalizeExerciseName('Barbell Curl')]: 'Barbell Curl',
  [normalizeExerciseName('Barbell Hip Thrust')]: 'Barbell Hip Thrust',
  [normalizeExerciseName('Barbell Front Squat')]: 'Front Barbell Squat',
  [normalizeExerciseName('Barbell Romanian Deadlift')]: 'Romanian Deadlift',
  [normalizeExerciseName('Barbell Sumo Deadlift')]: 'Sumo Deadlift',
  [normalizeExerciseName('Cable Lat Pulldown')]: 'Wide-Grip Lat Pulldown',
  [normalizeExerciseName('Cable Row')]: 'Seated Cable Rows',
  [normalizeExerciseName('Cable Row Seated')]: 'Seated Cable Rows',
  [normalizeExerciseName('Cable Tricep Pushdown')]: 'Triceps Pushdown',
  [normalizeExerciseName('Cable Triceps Pushdown')]: 'Triceps Pushdown',
  [normalizeExerciseName('Dumbbell Bicep Curl')]: 'Dumbbell Bicep Curl',
  [normalizeExerciseName('Dumbbell Shoulder Press')]: 'Dumbbell Shoulder Press',
  [normalizeExerciseName('Dumbbell Lateral Raise')]: 'Side Lateral Raise',
  [normalizeExerciseName('Dumbbell Row')]: 'One-Arm Dumbbell Row',
  [normalizeExerciseName('Dumbbell Fly')]: 'Dumbbell Flyes',
  [normalizeExerciseName('Dumbbell Chest Fly')]: 'Dumbbell Flyes',
  [normalizeExerciseName('Machine Leg Press')]: 'Leg Press',
  [normalizeExerciseName('Machine Leg Extension')]: 'Leg Extensions',
  [normalizeExerciseName('Machine Leg Curl')]: 'Lying Leg Curls',
  [normalizeExerciseName('Machine Chest Press')]: 'Machine Bench Press',
  [normalizeExerciseName('Assisted Pull Up')]: 'Band Assisted Pull-Up',
  [normalizeExerciseName('Bodyweight Pull Up')]: 'Pullups',
  [normalizeExerciseName('Bodyweight Dip')]: 'Dips - Triceps Version',
  [normalizeExerciseName('Bodyweight Push Up')]: 'Pushups',
  [normalizeExerciseName('Bodyweight Squat')]: 'Bodyweight Squat',
  // No-equipment-suffix bodyweight names — common in Strong/Hevy exports for
  // moves that have no equipment variant. FEDB spells several of these as one
  // word (Pushups/Pullups), which the token-overlap fuzzy match can't bridge
  // ({push, up} vs {pushups} shares zero tokens) — direct aliases needed.
  [normalizeExerciseName('Push Up')]: 'Pushups',
  [normalizeExerciseName('Pull Up')]: 'Pullups',
  [normalizeExerciseName('Chin Up')]: 'Chin-Up',
  [normalizeExerciseName('Sit Up')]: 'Sit-Up',
  [normalizeExerciseName('Dip')]: 'Dips - Triceps Version',
};
