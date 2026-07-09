/**
 * sessionTemplate.ts — A saved training shape.
 *
 * NOT an Observation. Observations are things that happened (occurredAt,
 * fidelity, tier). A template is a *recipe* — the user-authored plan for a
 * session — with no time of occurrence and no fidelity. It lives in its own
 * `session_templates` table (modeled on benchmarks / MealTemplate).
 *
 * Phase 6 absorbs the original Phase-4-Pass-7 SessionTemplate sketch and
 * generalizes it across the five logging surfaces. The library ships empty:
 * every template is user-authored.
 *
 * The `shape` field is a discriminated union per surface — only the relevant
 * target fields appear. Templates record *intent* (target sets/reps/weight,
 * target distance, planned style), not the live-session bookkeeping that
 * SessionPayload carries (timestamps, perceived effort, etc.).
 *
 * Pass 1 scope: the entity + CRUD only. Recurrence (dayAssignment, isActive)
 * is stored now but not consumed until Pass 4 (auto-populate). `templateId`
 * back-linking on logged Observations is wired in Pass 3 (placement).
 */
import type { EnergySystem, ISOInstant, MovementPattern, SwimStroke } from './observation';

/** The five logging surfaces, mirrors src/lib/activity.ts Surface. */
export type TemplateSurface = 'gym' | 'gps' | 'climbing' | 'swim' | 'practice';

// ─── Surface-specific shapes ────────────────────────────────────────────────

/**
 * One planned set in a gym template. Targets, not actuals: `targetReps` is a
 * freeform string so a set can read "5", "5-8", "AMRAP". Rest sits on the
 * exercise (one value applied between every consecutive pair of sets), not
 * the set — a Push Day rarely wants three different rests; that's the user's
 * feedback from the first iteration.
 */
export type GymTemplateSet = {
  id: string; // local id for keyed UI lists; not persisted as a separate row
  targetReps?: string;
  targetWeightKg?: number;
};

/**
 * One planned exercise in a gym template. Each exercise carries its OWN sets
 * array (a Push Day "warmup-build-top" looks different across its three sets)
 * — mirrors how the log form is shaped, so Pass 3 pre-fill is a 1:1 mapping
 * (target → placeholder; actual stays empty for the user to type).
 *
 * `restBetweenSetsSec` is the rest applied between every pair of sets in this
 * exercise. Null falls back to the user's global rest-timer default, so the
 * template only stores deviations from it.
 *
 * `exerciseId` (Body P3) is the library/ladder id from the picker
 * (src/lib/exercisePicker.ts) — the plan this file's header noted for "Pass 4
 * of Phase 4". Optional beside `name`, which stays the stored fact; no
 * template-editor picker UI ships this round (schema-only, template→session
 * pre-fill is still Pass 4's unbuilt auto-populate step).
 */
export type GymTemplateExercise = {
  id: string; // local id for keyed UI lists; not persisted as a separate row
  name: string;
  exerciseId?: string;
  movementPattern: MovementPattern;
  sets: GymTemplateSet[];
  restBetweenSetsSec?: number;
  notes?: string;
};

export type GymTemplateShape = {
  surface: 'gym';
  exercises: GymTemplateExercise[];
};

export type GpsTemplateShape = {
  surface: 'gps';
  // Target distance only — same fidelity ceiling as manual GPS logging
  // (constitution: fidelity-first; templates can't promise more than the
  // surface can capture).
  targetDistanceM?: number;
  energySystem: EnergySystem;
  notes?: string;
};

// ⚑ E-17: 'gym' dropped — it conflated climbing technique with indoor/outdoor,
// two independent axes (see core/observation.ts's ClimbingBlock doc).
export type ClimbStyle = 'sport' | 'trad' | 'boulder' | 'top-rope';

export type ClimbingTemplateShape = {
  surface: 'climbing';
  style: ClimbStyle;
  targetGradeRange?: string; // freeform, e.g. "V3-V5", "5.10a-5.11b"
  targetSends?: number; // approximate volume target
  notes?: string;
};

export type SwimMode = 'pool' | 'open';

export type SwimTemplateShape = {
  surface: 'swim';
  mode: SwimMode;
  poolLengthM?: number; // pool-mode only
  targetLaps?: number; // pool-mode preferred unit
  targetDistanceM?: number; // open-water or pool-as-distance
  stroke?: SwimStroke;
  energySystem: EnergySystem;
  notes?: string;
};

export type PracticeTemplateShape = {
  surface: 'practice';
  targetDurationMin?: number;
  style?: string; // freeform tag, e.g. "vinyasa", "hatha"
  notes?: string;
};

export type TemplateShape =
  | GymTemplateShape
  | GpsTemplateShape
  | ClimbingTemplateShape
  | SwimTemplateShape
  | PracticeTemplateShape;

// ─── The template record ────────────────────────────────────────────────────

export type SessionTemplate = {
  id: string;
  name: string; // user-given, e.g. "Push Day", "Park run"
  surface: TemplateSurface;
  activity: string; // activity id from the registry (run, gym, yoga, climb, …)
  shape: TemplateShape;
  // 0–6 = Mon–Sun. Optional. Consumed by Pass 4 (auto-populate active templates).
  dayAssignment?: number;
  // When true and `dayAssignment` is set, Pass 4 auto-populates future weeks
  // with this template on the assigned day. Default true at create.
  isActive: boolean;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
};
