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
import {
  displayToKg,
  displayToMeters,
  kgToDisplay,
  metersToDisplay,
  type DistanceUnit,
  type WeightUnit,
} from './units';
import { activityById, type Surface } from './activity';
import { deriveSessionDuration } from '@core/sessionTiming';

// The legacy modality set the Today quick-log picker and older sessions use
// directly. New sessions carry an `activity` identity instead; `resolveSurface`
// maps either onto a logging surface.
export type SessionModality = 'gym' | 'run' | 'ride' | 'climb' | 'paddle' | 'hike' | 'other';
export type ClimbStyle = 'sport' | 'trad' | 'boulder' | 'top-rope' | 'gym';

// ─── Form state ──────────────────────────────────────────────────────────────
// All numeric fields are strings — raw TextInput values, parsed at build time.

export type SetDraft = {
  id: string;
  weight: string;
  reps: string;
  rir: string;
  isWarmup: boolean;
  completedAt?: string; // ISO instant, stamped when the set is marked complete (Pass 3b)
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
  // The chosen identity (registry id, e.g. 'calisthenics'). Resolves the logging
  // surface and the engine modality. Optional: the Today quick-log picker can set
  // `modality` directly without an identity. When both are present, `activity` wins.
  activity?: string;
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

// ─── Surface + identity resolution ───────────────────────────────────────────
// The body the logger shows and the block the builder writes are chosen by the
// session's *surface*, resolved from the chosen activity (registry) or — for the
// quick-log picker and legacy sessions that carry only a modality — from the
// modality. The user never picks a surface; the router is invisible plumbing
// (training-logging-spec.md, three-layer model). 'other' has no sport block.

export type SessionSurface = Surface | 'other';

const MODALITY_SURFACE: Record<SessionModality, SessionSurface> = {
  gym: 'gym',
  run: 'gps',
  ride: 'gps',
  paddle: 'gps',
  hike: 'gps',
  climb: 'climbing',
  other: 'other',
};

/** The logging surface for a form: the activity's surface if one is chosen, else the modality's. */
export function resolveSurface(form: Pick<SessionForm, 'activity' | 'modality'>): SessionSurface {
  if (form.activity) {
    const a = activityById(form.activity);
    if (a) return a.surface;
  }
  return form.modality ? MODALITY_SURFACE[form.modality] : 'other';
}

/** The engine modality to store: the activity's nearest modality if chosen, else the picked one. */
function resolveModality(form: Pick<SessionForm, 'activity' | 'modality'>): Modality {
  if (form.activity) {
    const a = activityById(form.activity);
    if (a) return a.modality;
  }
  return (form.modality ?? 'other') as Modality;
}

/**
 * Capture precision by surface (constitution: honest fidelity, never fabricated).
 * Gym set-by-set logging is precise; a manually-typed GPS distance/HR is a guess
 * without a wearable, so it drops to 0.5 (Phase 3 import will raise it). Climbing
 * sends and the footer-only 'other' keep the prior 0.95 until their passes refine
 * them; swim/practice are placeholders their surfaces (Pass 5/6) will tune.
 */
const SURFACE_FIDELITY: Record<SessionSurface, number> = {
  gym: 0.95,
  gps: 0.5,
  swim: 0.5,
  climbing: 0.95,
  practice: 0.95,
  other: 0.95,
};

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
  if (form.activity == null && form.modality === null) return 'Pick an activity.';

  const duration = num(form.durationMin);
  if (duration === null || duration <= 0) return 'Enter a duration in minutes.';

  if (resolveSurface(form) === 'gym') {
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
      ...(s.completedAt ? { completedAt: s.completedAt } : {}),
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

  const surface = resolveSurface(form);
  const modality = resolveModality(form);
  let fidelity = SURFACE_FIDELITY[surface];

  const payload: SessionPayload = {
    kind: 'session',
    modality,
    ...(form.activity ? { activity: form.activity } : {}),
    durationMin: Number(form.durationMin),
    ...(form.perceivedEffort != null ? { perceivedEffort: form.perceivedEffort } : {}),
  };

  if (surface === 'gym') {
    payload.lifting = buildLifting(form.gym.exercises, ctx.weightUnit);
    // Duration falls out of the set-timestamp spread when the session was lived
    // set-by-set; otherwise the manually entered value stands (the gym duration
    // field is removed in Pass 3b, when the live set-complete affordance lands).
    const derived = deriveSessionDuration(payload.lifting.sets);
    if (derived.durationMin != null) {
      payload.durationMin = derived.durationMin;
      fidelity = derived.fidelity;
    }
  } else if (surface === 'gps') {
    const distance = num(form.endurance.distance);
    const avgHr = num(form.endurance.avgHr);
    payload.endurance = {
      energySystem: form.endurance.energySystem,
      ...(distance !== null && distance > 0
        ? { distanceM: displayToMeters(distance, ctx.distanceUnit) }
        : {}),
      ...(avgHr !== null && avgHr > 0 ? { avgHr: Math.round(avgHr) } : {}),
    };
  } else if (surface === 'climbing') {
    payload.climbing = {
      style: form.climb.style,
      sends: form.climb.sends.filter(sendFilled).map((s) => ({
        grade: s.grade.trim(),
        attempts: Math.max(1, Math.round(num(s.attempts) ?? 1)),
        sent: s.sent,
      })),
    };
  }
  // swim → Pass 5, practice → Pass 6, 'other' → duration + effort + notes only (no block).

  return {
    id: ctx.id,
    kind: 'session',
    occurredAt: ctx.now,
    loggedAt: ctx.now,
    tz: ctx.tz,
    tier: 1,
    fidelity,
    source: { type: 'manual' },
    payload,
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  };
}

// ─── Inverse: Observation -> SessionForm ─────────────────────────────────────

/** Modalities the SessionForm picker offers. Engine-side `Modality` is broader. */
const FORM_MODALITIES: ReadonlyArray<SessionModality> = [
  'gym',
  'run',
  'ride',
  'climb',
  'paddle',
  'hike',
  'other',
];

function normalizeModality(m: Modality): SessionModality {
  return (FORM_MODALITIES as ReadonlyArray<Modality>).includes(m)
    ? (m as SessionModality)
    : 'other';
}

function numStr(n: number | undefined | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '';
  // Trim trailing zeros so "100" stays "100" instead of "100.00".
  const fixed = n.toFixed(digits);
  return fixed.replace(/\.?0+$/, '');
}

/**
 * Rebuilds the form state from a saved session — the inverse of
 * buildSessionObservation. The log-session screen uses this to prefill its
 * fields when opened in edit mode (?editId=…), and the round-trip
 * (form → build → from → build) is what the tests guard.
 *
 * Units are inverted to the user's display unit so the form shows what the
 * user originally entered, not the engine-native kg / metres.
 */
export function sessionFormFromObservation(
  obs: ObservationOf<'session'>,
  units: { weightUnit: WeightUnit; distanceUnit: DistanceUnit },
  idFactory: () => string
): SessionForm {
  const p = obs.payload;
  const base = emptySessionForm();

  const form: SessionForm = {
    ...base,
    ...(p.activity ? { activity: p.activity } : {}),
    modality: normalizeModality(p.modality),
    durationMin: numStr(p.durationMin, 1),
    perceivedEffort: p.perceivedEffort ?? null,
    notes: obs.notes ?? '',
  };

  // Rebuild from whichever block is populated (not the coarse modality) so an
  // identity that normalises to 'other' (Surf, Wingfoil) still restores its body.
  if (p.lifting) {
    // Group flat sets back under their exercise (name + pattern). Same name
    // logged with different patterns becomes two groups, preserving order.
    const groups: ExerciseDraft[] = [];
    const indexByKey = new Map<string, number>();
    for (const s of p.lifting.sets) {
      const key = `${s.exercise}${s.movementPattern}`;
      let idx = indexByKey.get(key);
      if (idx === undefined) {
        idx = groups.length;
        indexByKey.set(key, idx);
        groups.push({
          id: idFactory(),
          name: s.exercise,
          movementPattern: s.movementPattern,
          sets: [],
        });
      }
      groups[idx].sets.push({
        id: idFactory(),
        weight: numStr(kgToDisplay(s.weightKg, units.weightUnit), 2),
        reps: String(s.reps),
        rir: s.rir != null ? String(s.rir) : '',
        isWarmup: s.isWarmup === true,
        ...(s.completedAt ? { completedAt: s.completedAt } : {}),
      });
    }
    form.gym = { exercises: groups };
  }

  if (p.endurance) {
    form.endurance = {
      distance:
        p.endurance.distanceM != null
          ? numStr(metersToDisplay(p.endurance.distanceM, units.distanceUnit), 2)
          : '',
      avgHr: p.endurance.avgHr != null ? String(p.endurance.avgHr) : '',
      energySystem: p.endurance.energySystem,
    };
  }

  if (p.climbing) {
    form.climb = {
      style: p.climbing.style as ClimbStyle,
      sends: p.climbing.sends.map((s) => ({
        id: idFactory(),
        grade: s.grade,
        attempts: String(s.attempts),
        sent: s.sent,
      })),
    };
  }

  return form;
}
