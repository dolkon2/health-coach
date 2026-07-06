/**
 * exerciseLibrary.ts — the vendored Free Exercise DB, plus our vendor-time derivations.
 *
 * Provenance: github.com/yuhonas/free-exercise-db, commit 5197c055, Unlicense
 * (public domain). `exercises.json` is the trimmed upstream dataset VERBATIM —
 * 873 records of { id, name, primaryMuscles, secondaryMuscles, equipment,
 * category, level, mechanic, force }. We never edit the JSON in place; every
 * app-side addition below is code, so it stays readable, testable and
 * auditable against upstream.
 *
 * Four vendor-time additions (build spec P2):
 *   (a) equipment patch — upstream leaves 14 strength/plyometrics records with
 *       equipment: null that are plainly bodyweight movements; patched to
 *       'body only' via the explicit id list NULL_EQUIPMENT_PATCH. Other
 *       null-equipment rows (all stretching/cardio, all pickerScope 'hidden')
 *       are left null — patching them would be a fabrication with no consumer.
 *   (b) movementPattern — derived for every entry from mechanic + force +
 *       primaryMuscles through the MUSCLE_PATTERN table (rules documented at
 *       derivePattern). The engine requires a pattern per set; this derivation
 *       is a PREFILL, not a truth claim, so:
 *   (c) patternReviewed — true only for the hand-reviewed common lifts in
 *       REVIEWED below. Reviewed entries auto-fill silently in the picker
 *       flow; UNreviewed entries prefill but stay visibly editable. Rows with
 *       mechanic AND force both null derive to 'other', never a guess.
 *   (d) pickerScope — which picker dataset(s) an entry belongs to.
 *       stretching (incl. the 13 -SMR rows) and cardio (not set-loggable) are
 *       'hidden'; 'other'-equipment strength rows stay 'gym' deliberately.
 *   (+) entryType — 'duration' seeded from force === 'static' plus the
 *       hand-review pass; drives the hold-seconds auto-toggle. Absent means
 *       reps entry (the default), not a fabricated value.
 */
import type { MovementPattern } from '@core/observation';

import rawExercises from './exercises.json';

// ─── Types ───────────────────────────────────────────────────────────────────

/** One upstream record, exactly as vendored (no derived fields). */
export type RawExercise = {
  id: string;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string | null;
  category: string;
  level: string;
  mechanic: string | null;
  force: string | null;
};

/** Which picker dataset(s) an entry appears in. 'hidden' = never listed. */
export type PickerScope = 'gym' | 'calisthenics' | 'both' | 'hidden';

/** How sets of this exercise are entered: reps (default) or hold seconds. */
export type ExerciseEntryType = 'reps' | 'duration';

/** A library entry: the raw record plus our vendor-time derivations. */
export type LibraryExercise = RawExercise & {
  movementPattern: MovementPattern;
  patternReviewed: boolean;
  pickerScope: PickerScope;
  entryType?: ExerciseEntryType; // absent = reps
};

// ─── (a) Equipment patch ─────────────────────────────────────────────────────

/**
 * The 14 strength/plyometrics rows upstream ships with equipment: null.
 * All are plainly bodyweight movements; patched to 'body only'.
 */
export const NULL_EQUIPMENT_PATCH: readonly string[] = [
  'Alternate_Leg_Diagonal_Bound',
  'Bodyweight_Walking_Lunge',
  'Carioca_Quick_Step',
  'Decline_Push-Up',
  'Floor_Glute-Ham_Raise',
  'Inverted_Row',
  'Kneeling_Arm_Drill',
  'Linear_3-Part_Start_Technique',
  'Linear_Acceleration_Wall_Drill',
  'Mountain_Climbers',
  'Moving_Claw_Series',
  'Prone_Manual_Hamstring',
  'Scapular_Pull-Up',
  'Side_Standing_Long_Jump',
];

// ─── (b) Movement-pattern derivation table ───────────────────────────────────

/**
 * Primary-muscle → pattern mapping, the core of the derivation. 'byForce'
 * marks muscles whose pattern depends on push vs pull (shoulders: overhead
 * press vs face pull). The upstream vocabulary is exactly these 17 muscles;
 * the integrity test fails if upstream ever adds one we don't map.
 */
export const MUSCLE_PATTERN: Record<string, MovementPattern | 'byForce'> = {
  abdominals: 'core',
  quadriceps: 'quad-dom',
  hamstrings: 'hip-hinge',
  glutes: 'hip-hinge',
  'lower back': 'hip-hinge',
  chest: 'upper-push',
  triceps: 'upper-push',
  lats: 'upper-pull',
  'middle back': 'upper-pull',
  traps: 'upper-pull',
  biceps: 'upper-pull',
  shoulders: 'byForce',
  forearms: 'isolation',
  calves: 'isolation',
  neck: 'isolation',
  adductors: 'isolation',
  abductors: 'isolation',
};

/**
 * Derive a movement pattern from mechanic + force + primaryMuscles.
 * Rules, in order (each one auditable against the table above):
 *   1. mechanic AND force both null → 'other' — too little signal, never guess.
 *   2. no primary muscle listed → 'other'.
 *   3. mechanic 'isolation' → 'isolation' (single-joint work regardless of muscle).
 *   4. first primary muscle through MUSCLE_PATTERN ('byForce' shoulders:
 *      push → upper-push, pull → upper-pull, static/null → upper-push).
 *   5. force flips a mismatched upper pattern (chest+pull pullover → upper-pull;
 *      shoulder-blade push work → upper-push).
 * What this table cannot see — unilateral stance (lunges), carries, rotation —
 * is exactly what the hand-review pass in REVIEWED corrects.
 */
export function derivePattern(
  mechanic: string | null,
  force: string | null,
  primaryMuscles: string[],
): MovementPattern {
  if (mechanic == null && force == null) return 'other'; // rule 1
  const muscle = primaryMuscles[0];
  if (muscle == null) return 'other'; // rule 2
  if (mechanic === 'isolation') return 'isolation'; // rule 3
  const mapped = MUSCLE_PATTERN[muscle] ?? 'other';
  let pattern: MovementPattern =
    mapped === 'byForce' ? (force === 'pull' ? 'upper-pull' : 'upper-push') : mapped;
  // rule 5 — force disambiguation for upper-body compounds
  if (pattern === 'upper-push' && force === 'pull') pattern = 'upper-pull';
  else if (pattern === 'upper-pull' && force === 'push') pattern = 'upper-push';
  return pattern;
}

// ─── (c) Hand-reviewed common lifts ─────────────────────────────────────────

type Review = { pattern: MovementPattern; entryType?: ExerciseEntryType };

/**
 * The hand-review pass: ~130 of the most common lifts, each checked by a
 * human-judgment pass at vendor time. Most CONFIRM the derived value (so the
 * picker can auto-fill silently); the rest CORRECT what the muscle table
 * cannot see — unilateral-leg stance, carries, rotation, statics. Everything
 * not listed here keeps patternReviewed: false and stays editable in the UI.
 */
export const REVIEWED: Record<string, Review> = {
  // Squat family — quad-dominant bilateral
  'Barbell_Squat': { pattern: 'quad-dom' },
  'Barbell_Full_Squat': { pattern: 'quad-dom' },
  'Front_Barbell_Squat': { pattern: 'quad-dom' },
  'Box_Squat': { pattern: 'quad-dom' },
  'Goblet_Squat': { pattern: 'quad-dom' },
  'Hack_Squat': { pattern: 'quad-dom' },
  'Barbell_Hack_Squat': { pattern: 'quad-dom' },
  'Smith_Machine_Squat': { pattern: 'quad-dom' },
  'Overhead_Squat': { pattern: 'quad-dom' },
  'Zercher_Squats': { pattern: 'quad-dom' },
  'Dumbbell_Squat': { pattern: 'quad-dom' },
  'Bodyweight_Squat': { pattern: 'quad-dom' },
  'Freehand_Jump_Squat': { pattern: 'quad-dom' },
  'Leg_Press': { pattern: 'quad-dom' },
  // Hinge family
  'Barbell_Deadlift': { pattern: 'hip-hinge' },
  'Romanian_Deadlift': { pattern: 'hip-hinge' },
  'Stiff-Legged_Barbell_Deadlift': { pattern: 'hip-hinge' },
  'Sumo_Deadlift': { pattern: 'hip-hinge' },
  'Deficit_Deadlift': { pattern: 'hip-hinge' },
  'Rack_Pulls': { pattern: 'hip-hinge' },
  'Good_Morning': { pattern: 'hip-hinge' },
  'Barbell_Hip_Thrust': { pattern: 'hip-hinge' },
  'Barbell_Glute_Bridge': { pattern: 'hip-hinge' },
  'Butt_Lift_Bridge': { pattern: 'hip-hinge' },
  'Glute_Ham_Raise': { pattern: 'hip-hinge' },
  'Floor_Glute-Ham_Raise': { pattern: 'hip-hinge' },
  'Hyperextensions_Back_Extensions': { pattern: 'hip-hinge' },
  'Superman': { pattern: 'hip-hinge' },
  'One-Arm_Kettlebell_Swings': { pattern: 'hip-hinge' },
  // Olympic pulls — hinge-dominant whole-body
  'Clean': { pattern: 'hip-hinge' },
  'Power_Clean': { pattern: 'hip-hinge' },
  'Hang_Clean': { pattern: 'hip-hinge' },
  'Clean_and_Jerk': { pattern: 'hip-hinge' },
  'Snatch': { pattern: 'hip-hinge' },
  'Power_Snatch': { pattern: 'hip-hinge' },
  // Horizontal + vertical push
  'Barbell_Bench_Press_-_Medium_Grip': { pattern: 'upper-push' },
  'Barbell_Incline_Bench_Press_-_Medium_Grip': { pattern: 'upper-push' },
  'Decline_Barbell_Bench_Press': { pattern: 'upper-push' },
  'Close-Grip_Barbell_Bench_Press': { pattern: 'upper-push' },
  'Wide-Grip_Barbell_Bench_Press': { pattern: 'upper-push' },
  'Dumbbell_Bench_Press': { pattern: 'upper-push' },
  'Machine_Bench_Press': { pattern: 'upper-push' },
  'Smith_Machine_Bench_Press': { pattern: 'upper-push' },
  'Pushups': { pattern: 'upper-push' },
  'Decline_Push-Up': { pattern: 'upper-push' },
  'Incline_Push-Up': { pattern: 'upper-push' },
  'Dips_-_Chest_Version': { pattern: 'upper-push' },
  'Dips_-_Triceps_Version': { pattern: 'upper-push' },
  'Bench_Dips': { pattern: 'upper-push' },
  'Barbell_Shoulder_Press': { pattern: 'upper-push' },
  'Standing_Military_Press': { pattern: 'upper-push' },
  'Dumbbell_Shoulder_Press': { pattern: 'upper-push' },
  'Seated_Dumbbell_Press': { pattern: 'upper-push' },
  'Arnold_Dumbbell_Press': { pattern: 'upper-push' },
  'Push_Press': { pattern: 'upper-push' },
  'Handstand_Push-Ups': { pattern: 'upper-push' },
  // Pulls
  'Pullups': { pattern: 'upper-pull' },
  'Chin-Up': { pattern: 'upper-pull' },
  'V-Bar_Pullup': { pattern: 'upper-pull' },
  'Weighted_Pull_Ups': { pattern: 'upper-pull' },
  'Muscle_Up': { pattern: 'upper-pull' },
  'Scapular_Pull-Up': { pattern: 'upper-pull' },
  'Wide-Grip_Lat_Pulldown': { pattern: 'upper-pull' },
  'Full_Range-Of-Motion_Lat_Pulldown': { pattern: 'upper-pull' },
  'Close-Grip_Front_Lat_Pulldown': { pattern: 'upper-pull' },
  'Bent_Over_Barbell_Row': { pattern: 'upper-pull' },
  'One-Arm_Dumbbell_Row': { pattern: 'upper-pull' },
  'Seated_Cable_Rows': { pattern: 'upper-pull' },
  'T-Bar_Row_with_Handle': { pattern: 'upper-pull' },
  'Inverted_Row': { pattern: 'upper-pull' },
  'Upright_Barbell_Row': { pattern: 'upper-pull' },
  'Face_Pull': { pattern: 'upper-pull' },
  'Barbell_Shrug': { pattern: 'upper-pull' },
  // Arm + shoulder + chest isolation
  'Barbell_Curl': { pattern: 'isolation' },
  'Dumbbell_Bicep_Curl': { pattern: 'isolation' },
  'EZ-Bar_Curl': { pattern: 'isolation' },
  'Hammer_Curls': { pattern: 'isolation' },
  'Preacher_Curl': { pattern: 'isolation' },
  'Concentration_Curls': { pattern: 'isolation' },
  'Triceps_Pushdown': { pattern: 'isolation' },
  'EZ-Bar_Skullcrusher': { pattern: 'isolation' },
  'Cable_Rope_Overhead_Triceps_Extension': { pattern: 'isolation' },
  'Dumbbell_One-Arm_Triceps_Extension': { pattern: 'isolation' },
  'Side_Lateral_Raise': { pattern: 'isolation' },
  'Front_Dumbbell_Raise': { pattern: 'isolation' },
  'Reverse_Flyes': { pattern: 'isolation' },
  'Cable_Rear_Delt_Fly': { pattern: 'isolation' },
  'Dumbbell_Flyes': { pattern: 'isolation' },
  'Cable_Crossover': { pattern: 'isolation' },
  'Butterfly': { pattern: 'isolation' },
  // Leg isolation
  'Leg_Extensions': { pattern: 'isolation' },
  'Lying_Leg_Curls': { pattern: 'isolation' },
  'Seated_Leg_Curl': { pattern: 'isolation' },
  'Standing_Calf_Raises': { pattern: 'isolation' },
  'Seated_Calf_Raise': { pattern: 'isolation' },
  'Donkey_Calf_Raises': { pattern: 'isolation' },
  // Core — flexion + anti-extension
  'Crunches': { pattern: 'core' },
  'Sit-Up': { pattern: 'core' },
  '3_4_Sit-Up': { pattern: 'core' },
  'Hanging_Leg_Raise': { pattern: 'core' },
  'Flat_Bench_Lying_Leg_Raise': { pattern: 'core' },
  'Cable_Crunch': { pattern: 'core' },
  'Ab_Roller': { pattern: 'core' },
  'Leg_Pull-In': { pattern: 'core' },
  'Plank': { pattern: 'core', entryType: 'duration' },
  'Side_Bridge': { pattern: 'core', entryType: 'duration' },
  'Mountain_Climbers': { pattern: 'core' },
  // Rotation — the muscle table reads these as abdominals/core
  'Russian_Twist': { pattern: 'rotation' },
  'Cable_Russian_Twists': { pattern: 'rotation' },
  'Plate_Twist': { pattern: 'rotation' },
  'Seated_Barbell_Twist': { pattern: 'rotation' },
  'Standing_Cable_Wood_Chop': { pattern: 'rotation' },
  'Pallof_Press': { pattern: 'rotation' },
  'Pallof_Press_With_Rotation': { pattern: 'rotation' },
  'Landmine_180s': { pattern: 'rotation' },
  'Medicine_Ball_Full_Twist': { pattern: 'rotation' },
  // Unilateral leg — the muscle table reads these as quad-dom/hinge
  'Barbell_Lunge': { pattern: 'unilateral-leg' },
  'Dumbbell_Lunges': { pattern: 'unilateral-leg' },
  'Barbell_Walking_Lunge': { pattern: 'unilateral-leg' },
  'Bodyweight_Walking_Lunge': { pattern: 'unilateral-leg' },
  'Dumbbell_Rear_Lunge': { pattern: 'unilateral-leg' },
  'Elevated_Back_Lunge': { pattern: 'unilateral-leg' },
  'Barbell_Step_Ups': { pattern: 'unilateral-leg' },
  'Dumbbell_Step_Ups': { pattern: 'unilateral-leg' },
  'Split_Squat_with_Dumbbells': { pattern: 'unilateral-leg' },
  'Barbell_Side_Split_Squat': { pattern: 'unilateral-leg' },
  'Smith_Single-Leg_Split_Squat': { pattern: 'unilateral-leg' },
  'One_Leg_Barbell_Squat': { pattern: 'unilateral-leg' },
  'Kettlebell_Pistol_Squat': { pattern: 'unilateral-leg' },
  'Smith_Machine_Pistol_Squat': { pattern: 'unilateral-leg' },
  'Single_Leg_Glute_Bridge': { pattern: 'unilateral-leg' },
  'Kettlebell_One-Legged_Deadlift': { pattern: 'unilateral-leg' },
  // Carries — invisible to the muscle table (primary: forearms/quads)
  'Farmers_Walk': { pattern: 'carry' },
  'Rickshaw_Carry': { pattern: 'carry' },
  'Yoke_Walk': { pattern: 'carry' },
};

// ─── (d) Picker scope ────────────────────────────────────────────────────────

/**
 * Scope rules, in order:
 *   1. stretching (which includes all 13 '-SMR' rows) and cardio → 'hidden' —
 *      neither is set-loggable on the gym surface.
 *   2. 'body only' equipment (after the patch) → 'both' — bodyweight strength
 *      belongs to gym AND calisthenics pickers.
 *   3. everything else → 'gym'; 'other'-equipment strength rows stay 'gym'
 *      DELIBERATELY (spec) — odd implements are still gym work.
 * 'calisthenics' (alone) is reserved for future entries (e.g. ladder steps
 * logged as library items); no vendored row maps to it today.
 */
export function derivePickerScope(category: string, equipment: string | null): PickerScope {
  if (category === 'stretching' || category === 'cardio') return 'hidden';
  if (equipment === 'body only') return 'both';
  return 'gym';
}

// ─── Loader ──────────────────────────────────────────────────────────────────

let cache: LibraryExercise[] | null = null;

/** The full library with every vendor-time derivation applied. Memoized. */
export function exerciseLibrary(): LibraryExercise[] {
  if (cache) return cache;
  cache = (rawExercises as RawExercise[]).map((raw) => {
    const equipment =
      raw.equipment == null && NULL_EQUIPMENT_PATCH.includes(raw.id) ? 'body only' : raw.equipment;
    const review = REVIEWED[raw.id];
    const movementPattern =
      review?.pattern ?? derivePattern(raw.mechanic, raw.force, raw.primaryMuscles);
    const pickerScope = derivePickerScope(raw.category, equipment);
    // entryType: hand review wins; else statics are duration holds.
    const entryType = review?.entryType ?? (raw.force === 'static' ? 'duration' : undefined);
    return {
      ...raw,
      equipment,
      movementPattern,
      patternReviewed: review != null,
      pickerScope,
      ...(entryType != null ? { entryType } : {}),
    };
  });
  return cache;
}

/** Lookup by upstream id. */
export function exerciseById(id: string): LibraryExercise | undefined {
  return exerciseLibrary().find((e) => e.id === id);
}
