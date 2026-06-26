/**
 * session.ts — the Log Session form model and its mapping to an Observation.
 *
 * Pure and platform-free so the modal and the tests drive the exact same path:
 * form state -> validate -> buildSessionObservation -> a tier-1 session
 * Observation the engine can read. No React, no storage here.
 *
 * The gym set logger groups sets under exercises for the UI, but data-model.md's
 * LiftingBlock is a *flat* list where every set carries its own exercise name and
 * movement pattern. buildLifting() flattens, repeating those per set.
 *
 * Movement pattern is required — the stimulus engine depends on it. The rule is
 * enforced here, not only in the UI: an active exercise without a pattern makes
 * validate() return a reason and build() throw, so an untagged set can never
 * reach storage (constitution: the engine's inputs stay honest).
 */
import type {
  EnergySystem,
  LiftingBlock,
  Modality,
  MovementPattern,
  ObservationOf,
  SessionPayload,
} from '@core/observation';
import { displayToKg, displayToMeters, type DistanceUnit, type WeightUnit } from './units';

// The seven modalities the Phase-1 picker offers.
export type SessionModality = 'gym' | 'run' | 'ride' | 'climb' | 'paddle' | 'hike' | 'other';
export type ClimbStyle = 'sport' | 'trad' | 'boulder' | 'top-rope' | 'gym';

export const ENDURANCE_MODALITIES: SessionModality[] = ['run', 'ride', 'paddle'];

export function isEndurance(m: Modality): boolean {
  return m === 'run' || m === 'ride' || m === 'paddle';
}

// ─── Form state ──────────────────────────────────────────────────────────────
// All numeric fields are strings — raw TextInput values, parsed at build time.

export type SetDraft = {
  id: string;
  weight: string;
  reps: string;
  rir: string;
  isWarmup: boolean;
};

export type ExerciseDraft = {
  id: string;
  name: string;
  movementPattern: MovementPattern | null; // required to save; null until tagged
  sets: SetDraft[];
};

export type SendDraft = {
  id: string;
  grade: string;
  attempts: string;
  sent: boolean;
};

export type SessionForm = {
  modality: SessionModality | null;
  durationMin: string;
  perceivedEffort: number | null; // 1–10, optional
  notes: string;
  gym: { exercises: ExerciseDraft[] };
  endurance: { distance: string; avgHr: string; energySystem: EnergySystem };
  climb: { style: ClimbStyle; sends: SendDraft[] };
};

export function emptySetDraft(id: string): SetDraft {
  return { id, weight: '', reps: '', rir: '', isWarmup: false };
}

export function emptyExerciseDraft(id: string, setId: string): ExerciseDraft {
  return { id, name: '', movementPattern: null, sets: [emptySetDraft(setId)] };
}

export function emptySessionForm(): SessionForm {
  return {
    modality: null,
    durationMin: '',
    perceivedEffort: null,
    notes: '',
    gym: { exercises: [] },
    endurance: { distance: '', avgHr: '', energySystem: 'aerobic' },
    climb: { style: 'gym', sends: [] },
  };
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

function num(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** A set the user actually filled in: a positive-rep entry (weight may be 0 = bodyweight). */
export function isSetFilled(s: SetDraft): boolean {
  const reps = num(s.reps);
  const weight = num(s.weight);
  return reps !== null && reps > 0 && weight !== null && weight >= 0;
}

/** An exercise the user is actually working: it has a name or at least one filled set. */
function isExerciseActive(ex: ExerciseDraft): boolean {
  return ex.name.trim() !== '' || ex.sets.some(isSetFilled);
}

function sendFilled(s: SendDraft): boolean {
  return s.grade.trim() !== '';
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Returns the first reason the form can't be saved, or null if it's ready.
 * The modal uses this for the Save button's disabled state and inline message;
 * buildSessionObservation() re-checks it so the rule holds at the data layer too.
 */
export function validateSessionForm(form: SessionForm): string | null {
  if (form.modality === null) return 'Pick a modality.';

  const duration = num(form.durationMin);
  if (duration === null || duration <= 0) return 'Enter a duration in minutes.';

  if (form.modality === 'gym') {
    const active = form.gym.exercises.filter(isExerciseActive);
    if (active.length === 0) return 'Add an exercise with at least one set.';

    for (const ex of active) {
      if (ex.name.trim() === '') return 'Name each exercise.';
      // The non-negotiable rule: the engine needs a movement pattern per exercise.
      if (ex.movementPattern === null) return `Tag a movement pattern for "${ex.name.trim()}".`;
      if (!ex.sets.some(isSetFilled)) return `Log a set for "${ex.name.trim()}".`;
    }
  }

  return null;
}

export function canSaveSession(form: SessionForm): boolean {
  return validateSessionForm(form) === null;
}

// ─── Build: form -> Observation ──────────────────────────────────────────────

export type BuildContext = {
  id: string; // uuid v7
  now: string; // ISO instant; occurredAt + loggedAt
  tz: string; // IANA timezone
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
};

function buildLifting(exercises: ExerciseDraft[], weightUnit: WeightUnit): LiftingBlock {
  const sets = exercises.filter(isExerciseActive).flatMap((ex) => {
    // Defence in depth: validate() already guarantees a pattern, but never let an
    // untagged set through to the engine even if a caller skips validation.
    if (ex.movementPattern === null) {
      throw new Error(`Movement pattern required for "${ex.name.trim() || 'exercise'}".`);
    }
    const pattern = ex.movementPattern;
    return ex.sets.filter(isSetFilled).map((s) => ({
      exercise: ex.name.trim(),
      movementPattern: pattern,
      weightKg: displayToKg(Number(s.weight), weightUnit),
      reps: Math.round(Number(s.reps)),
      ...(num(s.rir) !== null ? { rir: Number(s.rir) } : {}),
      ...(s.isWarmup ? { isWarmup: true } : {}),
    }));
  });
  return { sets };
}

/**
 * Maps validated form state to a tier-1, fidelity-0.95 manual session
 * Observation. Throws (via validateSessionForm / buildLifting) if the form is
 * incomplete — most importantly if any exercise lacks a movement pattern.
 */
export function buildSessionObservation(
  form: SessionForm,
  ctx: BuildContext
): ObservationOf<'session'> {
  const reason = validateSessionForm(form);
  if (reason) throw new Error(reason);

  const modality = form.modality as SessionModality; // non-null after validation
  const durationMin = Number(form.durationMin);

  const payload: SessionPayload = {
    kind: 'session',
    modality,
    durationMin,
    ...(form.perceivedEffort != null ? { perceivedEffort: form.perceivedEffort } : {}),
  };

  if (modality === 'gym') {
    payload.lifting = buildLifting(form.gym.exercises, ctx.weightUnit);
  } else if (isEndurance(modality)) {
    const distance = num(form.endurance.distance);
    const avgHr = num(form.endurance.avgHr);
    payload.endurance = {
      energySystem: form.endurance.energySystem,
      ...(distance !== null && distance > 0
        ? { distanceM: displayToMeters(distance, ctx.distanceUnit) }
        : {}),
      ...(avgHr !== null && avgHr > 0 ? { avgHr: Math.round(avgHr) } : {}),
    };
  } else if (modality === 'climb') {
    payload.climbing = {
      style: form.climb.style,
      sends: form.climb.sends.filter(sendFilled).map((s) => ({
        grade: s.grade.trim(),
        attempts: Math.max(1, Math.round(num(s.attempts) ?? 1)),
        sent: s.sent,
      })),
    };
  }
  // hike / other: duration + effort + notes only — no sport block.

  return {
    id: ctx.id,
    kind: 'session',
    occurredAt: ctx.now,
    loggedAt: ctx.now,
    tz: ctx.tz,
    tier: 1,
    fidelity: 0.95, // manual logging is high fidelity but not perfect (mis-entry).
    source: { type: 'manual' },
    payload,
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  };
}
