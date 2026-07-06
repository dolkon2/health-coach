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
  ElevationGainSource,
  EnergySystem,
  LiftingBlock,
  GeoPoint,
  Modality,
  MovementPattern,
  ObservationOf,
  SessionPayload,
  SwimmingBlock,
  SwimStroke,
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
import type { GearCategory } from '@core/gear';
import type { ConditionsSnapshot } from '@core/conditions';

// The legacy modality set the Today quick-log picker and older sessions use
// directly. New sessions carry an `activity` identity instead; `resolveSurface`
// maps either onto a logging surface.
export type SessionModality = 'gym' | 'run' | 'ride' | 'climb' | 'paddle' | 'hike' | 'other';
export type ClimbStyle = 'sport' | 'trad' | 'boulder' | 'top-rope' | 'gym';
export type SwimMode = 'pool' | 'open'; // pool: laps × length; open: estimated distance

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
  // Gear tagged on this session (quiver, E1). Always an array in the form;
  // written to the payload only when non-empty. Never gates saving.
  gearIds: string[];
  gym: { exercises: ExerciseDraft[] };
  endurance: {
    distance: string;
    avgHr: string;
    energySystem: EnergySystem;
    // Attached by GPX file import, never hand-edited. Present -> build() writes
    // gpsPath/elevation onto the payload, tags the fileimport source, raises
    // fidelity to the device-recorded level, and dates the session at the
    // file's start time (occurredAt = when it happened, loggedAt = now).
    gpsPath?: GeoPoint[];
    // Prefilled by a GPX import / live capture (source 'gps') or typed by the
    // user (source 'manual', via applyElevationGainEdit). The two travel
    // together: no gain, no source label.
    elevationGainM?: number;
    elevationGainSource?: ElevationGainSource;
    importMeta?: { format: 'gpx'; filename?: string; startTime?: string };
    // Attached by an in-app live GPS recording (lib/gpsTrack). Present -> build()
    // writes the same gpsPath/elevation, keeps the source `manual` (a recording
    // isn't a file), raises fidelity to the live-phone level (0.7), and dates the
    // session at the recording's start (occurredAt = when it happened).
    captureMeta?: { startTime: string };
    // Earth conditions frozen when a route attached (freezeEarthConditions,
    // best-effort ⚑ E-2): rides the form like captureMeta/importMeta and is
    // written to payload.conditions at build. A save that lands before the
    // fetch resolves simply has none. Never carried across a route change —
    // enduranceWithRoute rebuilds the slice without it (the old route's sky
    // is not the new route's sky).
    conditionsMeta?: ConditionsSnapshot;
  };
  climb: { style: ClimbStyle; sends: SendDraft[] };
  swim: {
    mode: SwimMode;
    poolLengthM: string; // pool length in metres (pool mode)
    laps: string; // lap count (pool mode)
    distance: string; // estimated distance in display units (open-water mode)
    stroke: SwimStroke;
    energySystem: EnergySystem;
  };
  practice: { style: string }; // optional free style tag for yoga/pilates/mobility
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
    gearIds: [],
    gym: { exercises: [] },
    endurance: { distance: '', avgHr: '', energySystem: 'aerobic' },
    climb: { style: 'gym', sends: [] },
    swim: {
      mode: 'pool',
      poolLengthM: '',
      laps: '',
      distance: '',
      stroke: 'freestyle',
      energySystem: 'aerobic',
    },
    practice: { style: '' },
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

/**
 * The gear tags that survive switching the form to an activity offering
 * `allowedCategories`. The chip row only renders gear in those categories, so
 * any other tag would be invisible on screen yet still written to the payload
 * — the session would silently accrue distance/days to another sport's gear
 * (E1, ⚑ E-4). Ids with no record in `gear` are dropped for the same reason:
 * no chip, no way to untag. An activity with no categories keeps no tags.
 */
export function pruneGearIdsForCategories(
  gearIds: string[],
  gear: ReadonlyArray<{ id: string; category: GearCategory }>,
  allowedCategories: readonly GearCategory[] | undefined
): string[] {
  if (!allowedCategories || allowedCategories.length === 0) return [];
  return gearIds.filter((id) => {
    const g = gear.find((x) => x.id === id);
    return g != null && allowedCategories.includes(g.category);
  });
}

/**
 * The endurance slice after the user types in the elevation-gain field — the
 * pure reducer behind the input so the honesty rule is testable without React.
 * Any direct edit is the user's number, so the source becomes 'manual' — even
 * if a route prefilled the field first (they overrode the computed value).
 * Cleared (or unparsable) → BOTH keys removed: no value, no source label.
 */
export function applyElevationGainEdit(
  endurance: SessionForm['endurance'],
  text: string
): SessionForm['endurance'] {
  const { elevationGainM: _gain, elevationGainSource: _source, ...rest } = endurance;
  const n = num(text);
  // A negative "gain" is meaningless (gain is a non-negative accumulator) —
  // treated like an unparsable entry. 0 is a real declaration: a flat session
  // (null ≠ 0; house precedent: weight 0 = bodyweight).
  if (n === null || n < 0) return rest;
  return { ...rest, elevationGainM: n, elevationGainSource: 'manual' };
}

/**
 * The endurance slice after a route lands on the form — GPX file import or
 * live capture. Rebuilt, never spread, so a prior route's provenance can't
 * linger on new geometry: an earlier import's 'gps'-labeled gain surviving
 * onto an <ele>-less planned route (or a stale captureMeta riding under a
 * fresh importMeta) would be a fabricated provenance claim at save (⚑ E-9).
 * Only the hand-entered fields (distance/avgHr/energySystem) carry over;
 * elevation keys come exclusively from the incoming route, and the two still
 * travel together — no gain, no source label.
 */
export function enduranceWithRoute(
  prev: SessionForm['endurance'],
  route: {
    gpsPath: GeoPoint[];
    distance?: string; // display-units string, converted by the caller; absent → keep the typed one
    elevationGainM?: number;
    elevationGainSource?: ElevationGainSource;
  },
  meta:
    | { importMeta: NonNullable<SessionForm['endurance']['importMeta']> }
    | { captureMeta: NonNullable<SessionForm['endurance']['captureMeta']> }
): SessionForm['endurance'] {
  return {
    distance: route.distance ?? prev.distance,
    avgHr: prev.avgHr,
    energySystem: prev.energySystem,
    gpsPath: route.gpsPath,
    ...(route.elevationGainM != null
      ? {
          elevationGainM: route.elevationGainM,
          ...(route.elevationGainSource != null
            ? { elevationGainSource: route.elevationGainSource }
            : {}),
        }
      : {}),
    ...meta,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Returns the first reason the form can't be saved, or null if it's ready.
 * The modal uses this for the Save button's disabled state and inline message;
 * buildSessionObservation() re-checks it so the rule holds at the data layer too.
 */
export function validateSessionForm(form: SessionForm): string | null {
  if (form.activity == null && form.modality === null) return 'Pick an activity.';

  const surface = resolveSurface(form);

  // Gym duration is derived from the set-timestamp spread, not entered, so it
  // isn't required. Every other surface still needs a manual duration.
  if (surface !== 'gym') {
    const duration = num(form.durationMin);
    if (duration === null || duration <= 0) return 'Enter a duration in minutes.';
  }

  if (surface === 'gym') {
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

function buildSwimming(swim: SessionForm['swim'], distanceUnit: DistanceUnit): SwimmingBlock {
  const block: SwimmingBlock = { energySystem: swim.energySystem, stroke: swim.stroke };
  if (swim.mode === 'pool') {
    const poolLengthM = num(swim.poolLengthM);
    const laps = num(swim.laps);
    if (poolLengthM !== null && poolLengthM > 0) block.poolLengthM = poolLengthM;
    if (laps !== null && laps > 0) block.laps = Math.round(laps);
    // Total distance is laps × pool length — an audited figure, not an estimate.
    if (block.poolLengthM != null && block.laps != null) {
      block.distanceM = block.poolLengthM * block.laps;
    }
  } else {
    const distance = num(swim.distance);
    if (distance !== null && distance > 0) {
      block.distanceM = displayToMeters(distance, distanceUnit);
    }
  }
  return block;
}

/**
 * Maps validated form state to a tier-1 manual session Observation. Throws (via
 * validateSessionForm / buildLifting) if the form is incomplete — most importantly
 * if any gym exercise lacks a movement pattern. Fidelity follows the surface.
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
    ...(form.perceivedEffort != null ? { perceivedEffort: form.perceivedEffort } : {}),
    // Written only when the user tagged gear — an untagged session carries no
    // gearIds key at all (absent, not []), matching the other optional fields.
    ...(form.gearIds.length > 0 ? { gearIds: [...form.gearIds] } : {}),
  };

  // Non-gym surfaces carry a manually entered duration (validated > 0). Gym's
  // duration is derived from the set-timestamp spread below; when that spread is
  // unknowable (batch/clustered entry) the field stays absent — honest, never a
  // fabricated 0 (constitution: null ≠ 0).
  if (surface !== 'gym') {
    payload.durationMin = Number(form.durationMin);
  }

  if (surface === 'gym') {
    payload.lifting = buildLifting(form.gym.exercises, ctx.weightUnit);
    const derived = deriveSessionDuration(payload.lifting.sets);
    if (derived.durationMin != null) {
      payload.durationMin = derived.durationMin;
      fidelity = derived.fidelity;
    }
  } else if (surface === 'gps') {
    const distance = num(form.endurance.distance);
    const avgHr = num(form.endurance.avgHr);
    const gpsPath = form.endurance.gpsPath;
    const hasRoute = gpsPath != null && gpsPath.length >= 2;
    const gain = form.endurance.elevationGainM;
    const gainSource = form.endurance.elevationGainSource;
    // A positive gain always writes; an explicit 0 writes only when it carries
    // a source — a measured flat track ('gps') or the user's typed zero
    // ('manual') is a declared fact the form already displays, not absence
    // (null ≠ 0). A sourceless 0, or anything negative, never lands.
    const gainEntry =
      gain != null && (gain > 0 || (gain === 0 && gainSource != null))
        ? {
            elevationGainM: Math.round(gain),
            // Source rides only with a written gain — a label alone would fabricate.
            ...(gainSource != null ? { elevationGainSource: gainSource } : {}),
          }
        : {};
    payload.endurance = {
      energySystem: form.endurance.energySystem,
      ...(distance !== null && distance > 0
        ? { distanceM: displayToMeters(distance, ctx.distanceUnit) }
        : {}),
      ...(avgHr !== null && avgHr > 0 ? { avgHr: Math.round(avgHr) } : {}),
      ...gainEntry,
      ...(hasRoute ? { gpsPath } : {}),
    };
    // Frozen conditions ride only with the route they were fetched for —
    // tier-3 context sitting BESIDE the tier-1 session, never gating it.
    if (hasRoute && form.endurance.conditionsMeta) {
      payload.conditions = form.endurance.conditionsMeta;
    }
    // A device-recorded trace imported from a file is measured, not guessed:
    // 0.9 — below a live watch import (~0.95, Phase 3), well above manual 0.5.
    if (hasRoute && form.endurance.importMeta) fidelity = 0.9;
    // A live in-app phone recording sits between: measured, but phone GPS drifts
    // and drops indoors, so 0.7 — above a manual guess (0.5), below a file import.
    else if (hasRoute && form.endurance.captureMeta) fidelity = 0.7;
  } else if (surface === 'climbing') {
    payload.climbing = {
      style: form.climb.style,
      sends: form.climb.sends.filter(sendFilled).map((s) => ({
        grade: s.grade.trim(),
        attempts: Math.max(1, Math.round(num(s.attempts) ?? 1)),
        sent: s.sent,
      })),
    };
  } else if (surface === 'swim') {
    payload.swimming = buildSwimming(form.swim, ctx.distanceUnit);
    // A pool total (laps × length) is audited, so it earns higher fidelity than an
    // open-water estimate (which is a guess, like a manual GPS distance).
    fidelity =
      payload.swimming.poolLengthM != null && payload.swimming.laps != null ? 0.85 : 0.5;
  } else if (surface === 'practice') {
    // Session-level only; the optional style tag is the sole structured field. A
    // styleless practice carries no block — the activity identity + duration says it.
    const style = form.practice.style.trim();
    if (style) payload.practice = { style };
  }
  // 'other' → duration + effort + notes only (no block).

  // File-imported GPS sessions carry their provenance and happen when the file
  // says they happened; a live recording likewise happened when it started. Both
  // date occurredAt to the route's start; everything else is a manual log dated now.
  const imp =
    surface === 'gps' && form.endurance.importMeta && payload.endurance?.gpsPath
      ? form.endurance.importMeta
      : null;
  const cap =
    surface === 'gps' && form.endurance.captureMeta && payload.endurance?.gpsPath
      ? form.endurance.captureMeta
      : null;

  return {
    id: ctx.id,
    kind: 'session',
    occurredAt: imp?.startTime ?? cap?.startTime ?? ctx.now,
    loggedAt: ctx.now,
    tz: ctx.tz,
    tier: 1,
    fidelity,
    source: imp
      ? { type: 'fileimport', format: imp.format, ...(imp.filename ? { filename: imp.filename } : {}) }
      : { type: 'manual' },
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
    gearIds: p.gearIds ?? [], // absent on the payload hydrates to the form's empty default
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
      ...(p.endurance.elevationGainM != null
        ? { elevationGainM: p.endurance.elevationGainM }
        : {}),
      // Pre-E2 rows carry no source — the key stays absent, never defaulted.
      ...(p.endurance.elevationGainSource != null
        ? { elevationGainSource: p.endurance.elevationGainSource }
        : {}),
      ...(p.endurance.gpsPath ? { gpsPath: p.endurance.gpsPath } : {}),
      // Restore frozen conditions so an edit round-trips them (absent → absent;
      // pre-E3 rows carry none and hydrate with the key absent, never {}).
      ...(p.conditions ? { conditionsMeta: p.conditions } : {}),
      // Restore import provenance so an edit round-trips it (the edit path also
      // preserves the original source/fidelity at save; this keeps build() honest).
      ...(obs.source.type === 'fileimport'
        ? {
            importMeta: {
              format: 'gpx' as const,
              ...(obs.source.filename ? { filename: obs.source.filename } : {}),
              startTime: obs.occurredAt,
            },
          }
        : {}),
      // Restore capture provenance for a live-recorded route (manual source +
      // geometry) so an edit keeps its 0.7 fidelity and start-dated occurredAt.
      ...(obs.source.type === 'manual' && p.endurance.gpsPath
        ? { captureMeta: { startTime: obs.occurredAt } }
        : {}),
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

  if (p.swimming) {
    const sw = p.swimming;
    form.swim = {
      mode: sw.poolLengthM != null ? 'pool' : 'open',
      poolLengthM: sw.poolLengthM != null ? numStr(sw.poolLengthM, 0) : '',
      laps: sw.laps != null ? String(sw.laps) : '',
      distance:
        sw.poolLengthM == null && sw.distanceM != null
          ? numStr(metersToDisplay(sw.distanceM, units.distanceUnit), 2)
          : '',
      stroke: sw.stroke ?? 'freestyle',
      energySystem: sw.energySystem,
    };
  }

  if (p.practice) {
    form.practice = { style: p.practice.style ?? '' };
  }

  return form;
}
