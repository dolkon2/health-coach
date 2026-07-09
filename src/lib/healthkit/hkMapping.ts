/**
 * hkMapping.ts — Body session -> HealthKit write shape (Body P8, binding
 * doc `healthkit-write-layer.md` §2). Pure, no native import — numeric
 * WorkoutActivityType values are duplicated here as literals (verified
 * against node_modules/@kingstinct/react-native-healthkit's generated
 * types), the same convention reader.ts uses for SLEEP_VALUE_TO_STAGE, so
 * this module stays unit-testable without booting the native bridge.
 */
import type { ObservationOf } from '@core/observation';

export type HkWrite =
  | { kind: 'workout'; activityType: number }
  | { kind: 'mindful' } // HKCategoryTypeIdentifierMindfulSession — not a workout
  | null; // not exportable

// WorkoutActivityType raw values (generated/healthkit.generated.d.ts).
const TRADITIONAL_STRENGTH_TRAINING = 50;
const FUNCTIONAL_STRENGTH_TRAINING = 20;
const YOGA = 57;
const PILATES = 66;
const FLEXIBILITY = 62;
const CARDIO_DANCE = 77;
const SOCIAL_DANCE = 78;
const PREPARATION_AND_RECOVERY = 33;

/** Activity ids the binding doc's table names directly, plus the reasoned
 *  (⚑, see dev-log flags) extensions for gym-surface/practice-surface
 *  activities the table doesn't explicitly cover. Dance and breathwork are
 *  NOT here — dance branches on contextTag below; breathwork/meditation
 *  route to 'mindful', never a workout. */
const WORKOUT_ACTIVITY_TYPE: Record<string, number> = {
  gym: TRADITIONAL_STRENGTH_TRAINING,
  strength: TRADITIONAL_STRENGTH_TRAINING, // ⚑ not in the binding table; same identity as gym
  calisthenics: FUNCTIONAL_STRENGTH_TRAINING,
  crossfit: FUNCTIONAL_STRENGTH_TRAINING, // ⚑ not in the binding table; functional/mixed fits better than traditional
  yoga: YOGA,
  pilates: PILATES, // ⚑ not in the binding table; HK has a dedicated constant, used directly
  mobility: FLEXIBILITY,
  pt: PREPARATION_AND_RECOVERY,
};

/**
 * Maps one session Observation to what it should become in HealthKit, or
 * null when it isn't exportable at all. Never throws — an unrecognized or
 * legacy (no `activity`) session is honestly not-mappable, not a guess.
 */
export function mapSessionToHk(obs: ObservationOf<'session'>): HkWrite {
  const activity = obs.payload.activity;
  if (!activity) return null; // a legacy session with only a modality has no identity to map

  // Meditation and Breathwork are mindfulness sessions, not workouts — Apple's
  // own semantic for an unstructured mindful sit/breath practice.
  if (activity === 'meditation' || activity === 'breathwork') return { kind: 'mindful' };

  // Deprecated (dimension-body-build.md P1a) — no new exports for a dropped sport.
  if (activity === 'martial-arts') return null;

  if (activity === 'dance') {
    const social = obs.payload.practice?.contextTag === 'social';
    return { kind: 'workout', activityType: social ? SOCIAL_DANCE : CARDIO_DANCE };
  }

  const activityType = WORKOUT_ACTIVITY_TYPE[activity];
  return activityType != null ? { kind: 'workout', activityType } : null;
}
