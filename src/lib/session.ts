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
  BodySide,
  BreathworkBlock,
  ClimbOutcome,
  ElevationGainSource,
  EnergySystem,
  LiftingBlock,
  GeoPoint,
  Modality,
  MovementPattern,
  ObservationOf,
  PracticeBlock,
  PracticeContextTag,
  SessionPayload,
  SkyBlock,
  SkySegment,
  SwimLength,
  SwimmingBlock,
  SwimStroke,
  WhitewaterBlock,
  WindBlock,
} from '@core/observation';
import { isSentOutcome } from '@core/observation';
import type { GaugeSnapshot, WindSnapshot } from '@core/conditions/snapshot';
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
import { parseClimbGrade } from '@core/climbGrade';
import type { LatLng } from '@core/geo';

// The legacy modality set the Today quick-log picker and older sessions use
// directly. New sessions carry an `activity` identity instead; `resolveSurface`
// maps either onto a logging surface.
export type SessionModality = 'gym' | 'run' | 'ride' | 'climb' | 'paddle' | 'hike' | 'other';
export type ClimbStyle = 'sport' | 'trad' | 'boulder' | 'top-rope';
export type SwimMode = 'pool' | 'open'; // pool: laps × length; open: estimated distance

// ─── Form state ──────────────────────────────────────────────────────────────
// All numeric fields are strings — raw TextInput values, parsed at build time.

export type SetDraft = {
  id: string;
  weight: string;
  reps: string;
  holdSec: string; // isometric hold seconds — a set is a hold set when this is filled (Body P1a)
  rir: string;
  isWarmup: boolean;
  completedAt?: string; // ISO instant, stamped when the set is marked complete (Pass 3b)
};

export type ExerciseDraft = {
  id: string;
  name: string;
  exerciseId?: string; // Free Exercise DB slug or ladder step id when picked from the library; `name` stays the stored fact
  movementPattern: MovementPattern | null; // required to save; null until tagged
  // UI-only entry mode: which column (reps or hold-seconds) the set table shows.
  // Absent = reps (the default). Auto-set from a library/ladder pick's entryType,
  // otherwise a manual per-exercise toggle (Body P3). Never persisted directly —
  // buildLifting still derives each SET's kind from what's actually filled.
  entryType?: 'reps' | 'duration';
  sets: SetDraft[];
};

export type SendDraft = {
  id: string;
  grade: string;
  attempts: string;
  // Always meaningful: did this send happen, yes/no. The old checkbox fact,
  // unchanged — a new row defaults false (unconfirmed), same as before E4.
  sent: boolean;
  // Richer than sent/not-sent (⚑ E-13/E-14, the granularity ladder's level-3
  // extension). null = not specified — a fresh row the user hasn't picked a
  // chip for yet, or a pre-E4 row with no richer record than `sent`. NEVER
  // backfilled with a guessed member (constitution: never fabricate) — build()
  // and the inverse both treat null as "defer to `sent`", not "assume redpoint".
  outcome: ClimbOutcome | null;
  route: string; // optional per-climb name; '' when not set
  pitches: string; // multipitch count (⚑ E-17); '' when not set, meaningful for sport/trad/top-rope only
  // The imported row this send came from (⚑ E-16), if any. Never set by the
  // UI — carried through inverse -> build untouched so editing an unrelated
  // field on an imported session can't silently drop its audit trail.
  raw?: Record<string, string>;
};

// A body area worked in a practice session (mobility). Tightness is an optional
// 1–5 rating as a raw string; empty = not rated (absent, never a middle default).
export type BodyAreaDraft = {
  id: string;
  zoneId: string; // '' until picked
  side?: BodySide;
  tightness: string;
};

// A pain reading attached to the session being logged — any surface. `pain` is
// the raw 0–10 string; '0' is a deliberate pain-free reading, '' is unfilled.
export type PainAreaDraft = {
  id: string;
  zoneId: string; // '' until picked
  side?: BodySide;
  pain: string;
};

// One breathwork round. `retentionSec` holds whole seconds as a string (the
// m:ss capture UI converts before writing here); '' = round not captured.
export type BreathworkRoundDraft = {
  id: string;
  retentionSec: string;
  breaths: string;
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
    // Device-measured total (healthkit-ingested sessions), carried whole so an
    // edit round-trips it exactly — the display-unit `distance` string rounds
    // (2 dp km = a 10 m quantum). When present the `distance` field restores
    // empty; a user-typed distance overrides the measured value (honest edit).
    measuredDistanceM?: number;
  };
  climb: {
    // null = not chosen. emptySessionForm() pre-selects 'boulder' for a BRAND
    // NEW entry (an editable UI starting point, same as endurance's default
    // energySystem) — but editing an existing session whose style was never
    // recorded (an ambiguous import, ⚑ E-17) must show null, not a guess,
    // or resaving without touching the chip would silently write a
    // fabricated style over a genuine absence (the same bug class E4's
    // review caught for `outcome`).
    style: ClimbStyle | null;
    // Indoor vs outdoor (⚑ E-17) — independent of style; null = not specified,
    // never defaulted. Manual entry always has a definite style but often
    // genuinely doesn't need to say where.
    indoor: boolean | null;
    sends: SendDraft[];
    totalProblems: string; // raw count, alternative/supplement to enumerating every send
    // Crag pin (⚑ E-5): a device fix captured via useCragPin, or absent — never
    // reverse-geocoded, `name` is free text the user may add by hand.
    location?: LatLng & { name?: string };
  };
  swim: {
    mode: SwimMode;
    poolLengthM: string; // pool length in metres (pool mode)
    laps: string; // lap count (pool mode)
    distance: string; // estimated distance in display units (open-water mode)
    stroke: SwimStroke;
    energySystem: EnergySystem;
    // Per-length rows from wearable ingestion — ride the form whole and are never
    // hand-edited (importMeta pattern). Present -> buildSwimming() writes them back
    // and keeps the MEASURED total below instead of recomputing laps × poolLengthM.
    lengths?: SwimLength[];
    // The device-measured total distance in metres, carried whole so an edit
    // round-trips it exactly (a display-unit string would round it). Carried
    // whenever the session is healthkit-ingested — with or without `lengths`
    // (a watch swim may report a total but no per-length rows).
    measuredDistanceM?: number;
  };
  practice: {
    style: string; // optional free style tag for yoga/pilates/mobility — stays the stored fact
    styleId: string; // taxonomy id when picked from the bundled list; '' = none
    contextTag: PracticeContextTag | null; // dance: class/social/practice/rehearsal/performance
    bodyAreas: BodyAreaDraft[]; // mobility: areas worked (+ optional tightness)
  };
  // Breathwork fields — read by build() only when the chosen activity is
  // 'breathwork' (it logs through this form on the practice surface, not a
  // bypass screen, so the edit path stays unified).
  breathwork: {
    patternId: string; // bundled-pattern id; '' = freeform breathwork
    cycles: string; // timed patterns: cycles completed
    capture: 'stopwatch' | 'manual' | null; // provenance, set by the capture UI — never defaulted here
    rounds: BreathworkRoundDraft[];
  };
  // Pain the user attaches to THIS session — any surface (pt-model: a knee can
  // hurt on a run or under a bar).
  painAreas: PainAreaDraft[];
  // Whitewater section (whitewater/kayak on the gps surface). String drafts for
  // user-typed fields; machine data (gauge snapshot, precip) rides the form whole
  // — frozen at save, restored untouched on edit, NEVER refetched.
  whitewater: {
    riverName: string;
    sectionName: string;
    sectionClass: string; // free text — 'IV-V', 'III(IV)' are legitimate; never validated hard
    waterTempC: string;
    hazards: string; // free text, private-first
    swims: string;
    rolls: string;
    spotId?: string;
    boatGearId?: string;
    gauge?: GaugeSnapshot; // IMMUTABLE once saved — carried whole (importMeta pattern)
    precip72hMm?: number; // machine-fetched 3-day rain sum, carried whole
  };
  // Wind-sport section (wingfoil/windsurf/kitesurf/parawing/sail on the gps
  // surface). Same split: `note` is the only typed draft; everything else is
  // picked or fetched and rides the form whole.
  wind: {
    note: string; // subjective session note ("lit on the 9m")
    spotId?: string;
    spotName?: string; // denormalized snapshot of the name
    sessionStyle?: 'downwind' | 'back-and-forth';
    endSpotId?: string; // downwinders: the landing spot
    endSpotName?: string;
    wind?: WindSnapshot; // IMMUTABLE once saved — carried whole, never refetched
    kitId?: string; // provenance if a kit was picked
    gearIds?: string[]; // resolved gear refs (kit expansion or loose picks)
  };
  sky: {
    track?: GeoPoint[]; // RAW, retained; never trimmed once attached
    trackSource?: 'igc' | 'liveGps';
    segments: SkySegment[]; // detector proposals + any user edits
    ascentMode: '' | 'hike' | 'lift' | 'shuttle' | 'tour'; // speedflying only; '' = unset
    onSkis: boolean; // ski-vs-air tag — never inferred (sky-research-track-b.md §2)
  };
};

export function emptySetDraft(id: string): SetDraft {
  return { id, weight: '', reps: '', holdSec: '', rir: '', isWarmup: false };
}

export function emptyExerciseDraft(id: string, setId: string): ExerciseDraft {
  return { id, name: '', movementPattern: null, sets: [emptySetDraft(setId)] };
}

/** Body P7a: a fresh mobility body-area row — no zone picked yet. */
export function emptyBodyAreaDraft(id: string): BodyAreaDraft {
  return { id, zoneId: '', tightness: '' };
}

/** Body P7b: a fresh breathwork round — not captured yet. */
export function emptyRoundDraft(id: string): BreathworkRoundDraft {
  return { id, retentionSec: '', breaths: '' };
}

/** Body P7b: a fresh standalone pain entry (any surface) — no zone yet. */
export function emptyPainAreaDraft(id: string): PainAreaDraft {
  return { id, zoneId: '', pain: '' };
}

/**
 * Applies an entry-mode switch (reps ↔ hold-seconds) to an exercise draft:
 * sets the mode and clears whichever field the switch just hid on every set.
 * Without this, a set could carry both a typed `reps` and a typed `holdSec`
 * after a mid-entry toggle, which would violate buildLifting's "hold sets
 * store reps: 0" convention (a code-review catch, Body P3).
 */
export function withEntryType(
  ex: ExerciseDraft,
  entryType: 'reps' | 'duration'
): ExerciseDraft {
  return {
    ...ex,
    entryType,
    sets: ex.sets.map((s) =>
      entryType === 'duration' ? { ...s, reps: '' } : { ...s, holdSec: '' }
    ),
  };
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
    climb: { style: 'boulder', indoor: null, sends: [], totalProblems: '' },
    swim: {
      mode: 'pool',
      poolLengthM: '',
      laps: '',
      distance: '',
      stroke: 'freestyle',
      energySystem: 'aerobic',
    },
    practice: { style: '', styleId: '', contextTag: null, bodyAreas: [] },
    breathwork: { patternId: '', cycles: '', capture: null, rounds: [] },
    painAreas: [],
    // Always present so every gps activity (whitewater/kayak, the wind sports)
    // has a seeded section to fill; untouched sections build to no block at all.
    whitewater: {
      riverName: '',
      sectionName: '',
      sectionClass: '',
      waterTempC: '',
      hazards: '',
      swims: '',
      rolls: '',
    },
    wind: { note: '' },
    sky: { segments: [], ascentMode: '', onSkis: false },
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
 * them; swim/practice are placeholders their surfaces (Pass 5/6) will tune. Sky
 * follows the same pattern as gps: a bare hand-log is a 0.5 guess; a track
 * (igc/liveGps) raises it, same as endurance's import/capture bump.
 */
const SURFACE_FIDELITY: Record<SessionSurface, number> = {
  gym: 0.95,
  gps: 0.5,
  swim: 0.5,
  climbing: 0.95,
  practice: 0.95,
  sky: 0.5,
  other: 0.95,
};

// ─── Parsing helpers ─────────────────────────────────────────────────────────

function num(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * A set the user actually filled in: positive reps OR a positive hold time.
 * A reps set still needs an explicit weight (0 = bodyweight) — unchanged rule.
 * A hold set may leave weight empty (empty = strict bodyweight, stored as 0 kg
 * of ADDED load); if a weight is typed it must parse to >= 0.
 */
export function isSetFilled(s: SetDraft): boolean {
  const weight = num(s.weight);
  const holdSec = num(s.holdSec);
  if (holdSec !== null && holdSec > 0) {
    return s.weight.trim() === '' || (weight !== null && weight >= 0);
  }
  const reps = num(s.reps);
  return reps !== null && reps > 0 && weight !== null && weight >= 0;
}

/** An exercise the user is actually working: it has a name or at least one filled set. */
function isExerciseActive(ex: ExerciseDraft): boolean {
  return ex.name.trim() !== '' || ex.sets.some(isSetFilled);
}

function sendFilled(s: SendDraft): boolean {
  return s.grade.trim() !== '';
}

/** A captured breathwork round: a positive retention time. An aborted round is
 *  simply never recorded (null ≠ 0). */
export function isRoundFilled(r: BreathworkRoundDraft): boolean {
  const sec = num(r.retentionSec);
  return sec !== null && sec > 0;
}

function bodyAreaFilled(a: BodyAreaDraft): boolean {
  return a.zoneId.trim() !== '';
}

/** A pain entry the user actually made: a zone AND a score. '0' counts — it is
 *  a deliberate pain-free reading, distinct from an untouched draft. */
function painAreaFilled(a: PainAreaDraft): boolean {
  return a.zoneId.trim() !== '' && a.pain.trim() !== '';
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
  // isn't required. Every other surface still needs a manual duration — except a
  // breathwork log carrying at least one captured round: rounds-present is its
  // filled criterion (mirroring gym's derived-duration exemption), and forcing a
  // duration there would fabricate one. Only an EMPTY field is exempt; a typed
  // duration must still parse > 0 (typed garbage errors, it is never dropped).
  if (surface !== 'gym') {
    const duration = num(form.durationMin);
    const roundsPresent =
      form.activity === 'breathwork' && form.breathwork.rounds.some(isRoundFilled);
    if (duration === null || duration <= 0) {
      if (!(roundsPresent && form.durationMin.trim() === '')) {
        return 'Enter a duration in minutes.';
      }
    }
  }

  // Out-of-range entries block the save instead of being clamped or silently
  // dropped — never rewrite what the user typed.
  for (const a of form.painAreas) {
    if (!painAreaFilled(a)) continue;
    const v = num(a.pain);
    if (v === null || !Number.isInteger(v) || v < 0 || v > 10) {
      return 'Pain is a whole number from 0 to 10.';
    }
  }
  for (const a of form.practice.bodyAreas) {
    if (!bodyAreaFilled(a) || a.tightness.trim() === '') continue;
    const v = num(a.tightness);
    if (v === null || !Number.isInteger(v) || v < 1 || v > 5) {
      return 'Tightness is a whole number from 1 to 5.';
    }
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

  // Water sections (whitewater/wind) never gate saving: every field is optional,
  // and sectionClass takes free text ('IV-V', 'III(IV)') — soft hint only, no
  // hard validation here.
  return null;
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
    return ex.sets.filter(isSetFilled).map((s) => {
      // A hold set stores reps: 0 — the hold time is the work, not a fabricated
      // rep count. An empty weight on a hold set is strict bodyweight: 0 kg of
      // ADDED load (weightKg on a bodyweight movement means added external load).
      const reps = num(s.reps);
      const holdSec = num(s.holdSec);
      return {
        exercise: ex.name.trim(),
        ...(ex.exerciseId ? { exerciseId: ex.exerciseId } : {}),
        movementPattern: pattern,
        weightKg: displayToKg(num(s.weight) ?? 0, weightUnit),
        reps: reps !== null && reps > 0 ? Math.round(reps) : 0,
        ...(holdSec !== null && holdSec > 0 ? { holdSec: Math.round(holdSec) } : {}),
        ...(num(s.rir) !== null ? { rir: Number(s.rir) } : {}),
        ...(s.isWarmup ? { isWarmup: true } : {}),
        ...(s.completedAt ? { completedAt: s.completedAt } : {}),
      };
    });
  });
  return { sets };
}

function buildSwimming(swim: SessionForm['swim'], distanceUnit: DistanceUnit): SwimmingBlock {
  // Ingested per-length rows ride the form whole (importMeta pattern). When
  // present, the block keeps the device-MEASURED total — never a recomputed
  // laps × poolLengthM (the watch total is the fact) — and carries no session-
  // level stroke: the per-length strokes are the truth, and a whole-session
  // stroke tag on a mixed ingested swim would be fabricated.
  if (swim.lengths != null && swim.lengths.length > 0) {
    const block: SwimmingBlock = { energySystem: swim.energySystem };
    if (swim.measuredDistanceM != null) block.distanceM = swim.measuredDistanceM;
    const poolLengthM = num(swim.poolLengthM);
    const laps = num(swim.laps);
    if (poolLengthM !== null && poolLengthM > 0) block.poolLengthM = poolLengthM;
    if (laps !== null && laps > 0) block.laps = Math.round(laps);
    block.lengths = swim.lengths;
    return block;
  }
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
    // A typed estimate wins (honest hand-edit); otherwise a carried device-
    // measured total (healthkit swim without per-length rows) round-trips exactly.
    const distance = num(swim.distance);
    if (distance !== null && distance > 0) {
      block.distanceM = displayToMeters(distance, distanceUnit);
    } else if (swim.measuredDistanceM != null) {
      block.distanceM = swim.measuredDistanceM;
    }
  }
  return block;
}

/**
 * Which gps-surface activities carry each Water bespoke block. Single source
 * of truth for BOTH the form (which section renders) and the builder (which
 * block may be written) — the gate that keeps a stale section draft from
 * leaking onto the wrong activity after a switch.
 */
export const WHITEWATER_ACTIVITIES = ['whitewater', 'kayak'];
export const WIND_ACTIVITIES = ['wingfoil', 'windsurf', 'kitesurf', 'parawing', 'sail'];

/**
 * The instant conditions are frozen FOR. Editing keeps the session's own time;
 * a new log with an imported/recorded route happens when the route says it
 * happened (a GPX from last Saturday must freeze Saturday's gauge, not
 * today's); only a from-scratch manual log uses the screen-open time.
 */
export function sessionTimeForConditions(
  originalOccurredAt: string | undefined,
  form: SessionForm,
  screenOpenedAt: string
): string {
  return (
    originalOccurredAt ??
    form.endurance.importMeta?.startTime ??
    form.endurance.captureMeta?.startTime ??
    screenOpenedAt
  );
}

/**
 * The whitewater payload block, or null when the section is untouched — an
 * empty section writes NOTHING (omit-when-absent; absent ≠ empty-object).
 * Numeric drafts parse via num(): empty string → absent, never a fabricated 0 —
 * but a typed '0' (zero swims) is a fact and is kept (null ≠ 0).
 */
function buildWhitewater(ww: SessionForm['whitewater']): WhitewaterBlock | null {
  const waterTempC = num(ww.waterTempC);
  const swims = num(ww.swims);
  const rolls = num(ww.rolls);
  const block: WhitewaterBlock = {
    ...(ww.riverName.trim() ? { riverName: ww.riverName.trim() } : {}),
    ...(ww.sectionName.trim() ? { sectionName: ww.sectionName.trim() } : {}),
    ...(ww.spotId ? { spotId: ww.spotId } : {}),
    ...(ww.gauge ? { gauge: ww.gauge } : {}),
    // Free text, no hard validation — 'IV-V' and 'III(IV)' are legitimate.
    ...(ww.sectionClass.trim() ? { sectionClass: ww.sectionClass.trim() } : {}),
    ...(ww.boatGearId ? { boatGearId: ww.boatGearId } : {}),
    ...(waterTempC !== null ? { waterTempC } : {}),
    ...(ww.hazards.trim() ? { hazards: ww.hazards.trim() } : {}),
    ...(swims !== null ? { swims: Math.round(swims) } : {}),
    ...(rolls !== null ? { rolls: Math.round(rolls) } : {}),
    ...(ww.precip72hMm != null ? { precip72hMm: ww.precip72hMm } : {}),
  };
  return Object.keys(block).length > 0 ? block : null;
}

/** The wind payload block, or null when the section is untouched (same rule). */
function buildWind(wd: SessionForm['wind']): WindBlock | null {
  const block: WindBlock = {
    ...(wd.spotId ? { spotId: wd.spotId } : {}),
    ...(wd.spotName ? { spotName: wd.spotName } : {}),
    ...(wd.sessionStyle ? { sessionStyle: wd.sessionStyle } : {}),
    ...(wd.endSpotId ? { endSpotId: wd.endSpotId } : {}),
    ...(wd.endSpotName ? { endSpotName: wd.endSpotName } : {}),
    ...(wd.wind ? { wind: wd.wind } : {}),
    ...(wd.kitId ? { kitId: wd.kitId } : {}),
    ...(wd.gearIds != null && wd.gearIds.length > 0 ? { gearIds: wd.gearIds } : {}),
    ...(wd.note.trim() ? { note: wd.note.trim() } : {}),
  };
  return Object.keys(block).length > 0 ? block : null;
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
  // fabricated 0 (constitution: null ≠ 0). A rounds-carrying breathwork log may
  // leave the field empty (validated above); it then stays absent here too.
  if (surface !== 'gym') {
    const duration = num(form.durationMin);
    if (duration !== null && duration > 0) payload.durationMin = duration;
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
      // A typed distance wins (an honest hand-edit); otherwise the carried
      // device-measured total round-trips exactly (the display string rounds).
      ...(distance !== null && distance > 0
        ? { distanceM: displayToMeters(distance, ctx.distanceUnit) }
        : form.endurance.measuredDistanceM != null
          ? { distanceM: form.endurance.measuredDistanceM }
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
    // Water bespoke blocks ride ALONGSIDE the endurance envelope. Only a section
    // with at least one populated field writes a block — an untouched section
    // writes nothing at all (omit-when-absent). Gated on the activity id: the
    // form slices survive an activity switch (sections merely hide), so an
    // abandoned wingfoil draft must not leak a WindBlock onto a run.
    if (form.activity && WHITEWATER_ACTIVITIES.includes(form.activity)) {
      const whitewater = buildWhitewater(form.whitewater);
      if (whitewater) payload.whitewater = whitewater;
    }
    if (form.activity && WIND_ACTIVITIES.includes(form.activity)) {
      const wind = buildWind(form.wind);
      if (wind) payload.wind = wind;
    }
  } else if (surface === 'climbing') {
    const totalProblems = num(form.climb.totalProblems);
    payload.climbing = {
      ...(form.climb.style ? { style: form.climb.style } : {}),
      ...(form.climb.indoor != null ? { indoor: form.climb.indoor } : {}),
      sends: form.climb.sends.filter(sendFilled).map((s) => {
        const grade = s.grade.trim();
        const route = s.route.trim();
        // Best-effort scale match against sandbag, biased by style (⚑ E-13/
        // E-14). Absent when nothing matches — the grade string above stays
        // the tier-1 fact regardless.
        const gradeSystem = parseClimbGrade(grade, form.climb.style ?? undefined);
        // outcome absent (never chosen, or a pre-E4 row) -> defer to the
        // coarse `sent` fact rather than guess which of four send styles it
        // was (constitution: never fabricate a specific value from a boolean).
        const sent = s.outcome != null ? isSentOutcome(s.outcome) : s.sent;
        const pitches = num(s.pitches);
        return {
          grade,
          ...(gradeSystem ? { gradeSystem } : {}),
          attempts: Math.max(1, Math.round(num(s.attempts) ?? 1)),
          sent,
          ...(s.outcome != null ? { outcome: s.outcome } : {}),
          ...(route ? { route } : {}),
          ...(pitches !== null && pitches > 0 ? { pitches: Math.round(pitches) } : {}),
          ...(s.raw ? { raw: s.raw } : {}),
        };
      }),
      ...(totalProblems !== null && totalProblems > 0
        ? { totalProblems: Math.round(totalProblems) }
        : {}),
      ...(form.climb.location ? { location: form.climb.location } : {}),
    };
  } else if (surface === 'swim') {
    payload.swimming = buildSwimming(form.swim, ctx.distanceUnit);
    // A pool total (laps × length) is audited, so it earns higher fidelity than an
    // open-water estimate (which is a guess, like a manual GPS distance).
    fidelity =
      payload.swimming.poolLengthM != null && payload.swimming.laps != null ? 0.85 : 0.5;
  } else if (surface === 'practice') {
    // Session-level only. Every field is optional; a practice with none of them
    // carries no block at all — the activity identity + duration says it.
    const style = form.practice.style.trim();
    const styleId = form.practice.styleId.trim();
    const bodyAreas = form.practice.bodyAreas.filter(bodyAreaFilled).map((a) => {
      const tightness = num(a.tightness);
      return {
        zoneId: a.zoneId.trim(),
        ...(a.side ? { side: a.side } : {}),
        // Validated 1–5 above; an empty rating stays absent (not rated ≠ rated low).
        ...(tightness !== null
          ? { tightness: Math.round(tightness) as 1 | 2 | 3 | 4 | 5 }
          : {}),
      };
    });
    const practice: PracticeBlock = {
      ...(style ? { style } : {}),
      ...(styleId ? { styleId } : {}),
      ...(form.practice.contextTag ? { contextTag: form.practice.contextTag } : {}),
      ...(bodyAreas.length > 0 ? { bodyAreas } : {}),
    };
    if (Object.keys(practice).length > 0) payload.practice = practice;

    // Breathwork rides the practice surface, keyed on the activity identity —
    // the block only exists for breathwork sessions, never other practices.
    if (form.activity === 'breathwork') {
      const rounds = form.breathwork.rounds.filter(isRoundFilled).map((r) => {
        const breaths = num(r.breaths);
        return {
          retentionSeconds: Math.round(num(r.retentionSec) as number),
          ...(breaths !== null && breaths > 0 ? { breathsCount: Math.round(breaths) } : {}),
        };
      });
      const patternId = form.breathwork.patternId.trim();
      const cycles = num(form.breathwork.cycles);
      const breathwork: BreathworkBlock = {
        ...(patternId ? { patternId } : {}),
        ...(rounds.length > 0 ? { rounds } : {}),
        // capture is provenance the capture UI sets ('stopwatch'/'manual'); when
        // it never set one, the field stays honestly absent — never defaulted.
        ...(rounds.length > 0 && form.breathwork.capture
          ? { capture: form.breathwork.capture }
          : {}),
        ...(cycles !== null && cycles > 0 ? { cycles: Math.round(cycles) } : {}),
      };
      if (Object.keys(breathwork).length > 0) payload.breathwork = breathwork;
    }
  } else if (surface === 'sky') {
    const hasTrack = form.sky.track != null && form.sky.track.length >= 2;
    const sky: SkyBlock = {
      ...(hasTrack ? { track: form.sky.track, trackSource: form.sky.trackSource } : {}),
      ...(form.sky.segments.length > 0 ? { segments: form.sky.segments } : {}),
      // ascentMode is speedflying-only (research §Q3) — enforced here, not just
      // in the UI, so a stale value left over from switching activities can
      // never reach a non-speedflying session (constitution: the engine's
      // inputs stay honest, same rule buildLifting applies to movement pattern).
      ...(form.activity === 'speedflying' && form.sky.ascentMode !== ''
        ? { ascentMode: form.sky.ascentMode }
        : {}),
      ...(form.sky.onSkis ? { onSkis: true } : {}),
    };
    payload.sky = sky;
    // An IGC file is a flight recorder's own log — measured, same tier as a
    // GPX import (0.9). A live phone recording carries the same drift/indoor
    // caveats as gps's live capture (0.7).
    if (hasTrack && form.sky.trackSource === 'igc') fidelity = 0.9;
    else if (hasTrack && form.sky.trackSource === 'liveGps') fidelity = 0.7;
  }
  // 'other' → duration + effort + notes only (no block).

  // Pain attaches to ANY surface (a knee can hurt on a run or under a bar).
  // '0' persists as a recorded pain-free reading; untouched drafts drop.
  const painAreas = form.painAreas.filter(painAreaFilled).map((a) => ({
    zoneId: a.zoneId.trim(),
    ...(a.side ? { side: a.side } : {}),
    pain: Math.round(num(a.pain) as number),
  }));
  if (painAreas.length > 0) payload.painAreas = painAreas;

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
  // A sky track (IGC or live) carries its own fix timestamps, so the session's
  // occurredAt is read straight off the track's first point — no separate
  // import/capture metadata needed the way gps's importMeta/captureMeta are.
  const skyTrack = surface === 'sky' ? payload.sky?.track : undefined;
  const skyStartIso =
    skyTrack && skyTrack.length > 0 ? new Date(skyTrack[0].tsSec * 1000).toISOString() : null;

  return {
    id: ctx.id,
    kind: 'session',
    occurredAt: imp?.startTime ?? cap?.startTime ?? skyStartIso ?? ctx.now,
    loggedAt: ctx.now,
    tz: ctx.tz,
    tier: 1,
    fidelity,
    source: imp
      ? { type: 'fileimport', format: imp.format, ...(imp.filename ? { filename: imp.filename } : {}) }
      : payload.sky?.trackSource === 'igc'
        ? { type: 'fileimport', format: 'igc' }
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

export function numStr(n: number | undefined | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '';
  // Trim trailing zeros so "100" stays "100" instead of "100.00".
  const fixed = n.toFixed(digits);
  return fixed.replace(/\.?0+$/, '');
}

/** One stored lifting set, rendered as the draft's display strings (display
 *  units). Shared by the edit-path inverse and the ghost-placeholder helper
 *  below so the two never drift apart. */
function liftingSetDisplay(
  s: LiftingBlock['sets'][number],
  weightUnit: WeightUnit
): { weight: string; reps: string; holdSec: string; rir: string } {
  return {
    weight: numStr(kgToDisplay(s.weightKg, weightUnit), 2),
    // A hold set stored reps: 0 by convention — show the reps field empty,
    // the way the user left it, not a literal '0'.
    reps: s.reps === 0 && s.holdSec != null ? '' : String(s.reps),
    holdSec: s.holdSec != null ? String(s.holdSec) : '',
    rir: s.rir != null ? String(s.rir) : '',
  };
}

/**
 * The last session's sets for an exercise, formatted as display-unit
 * placeholder strings — Strong-style ghost text shown faintly in the set
 * table, never prefilled into the draft (constitution: never fabricate what
 * the user did today from what they did last time). Body P3.
 */
export function ghostSetPlaceholders(
  sets: LiftingBlock['sets'] | null,
  weightUnit: WeightUnit
): Array<{ weight: string; reps: string; holdSec: string; rir: string }> {
  if (!sets) return [];
  return sets.map((s) => liftingSetDisplay(s, weightUnit));
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
    // Group flat sets back under their exercise (name + pattern + library id,
    // \u0001-separated so names can't collide). Same name logged with different
    // patterns (or different library exercises) becomes two groups, preserving order.
    const groups: ExerciseDraft[] = [];
    const indexByKey = new Map<string, number>();
    for (const s of p.lifting.sets) {
      const key = `${s.exercise}\u0001${s.movementPattern}\u0001${s.exerciseId ?? ''}`;
      let idx = indexByKey.get(key);
      if (idx === undefined) {
        idx = groups.length;
        indexByKey.set(key, idx);
        groups.push({
          id: idFactory(),
          name: s.exercise,
          ...(s.exerciseId ? { exerciseId: s.exerciseId } : {}),
          movementPattern: s.movementPattern,
          sets: [],
        });
      }
      groups[idx].sets.push({
        id: idFactory(),
        ...liftingSetDisplay(s, units.weightUnit),
        isWarmup: s.isWarmup === true,
        ...(s.completedAt ? { completedAt: s.completedAt } : {}),
      });
    }
    // Infer the UI entry mode from what was actually stored — any hold-seconds
    // set in the group means the exercise was logged in hold mode.
    for (const g of groups) {
      if (g.sets.some((s) => s.holdSec !== '')) g.entryType = 'duration';
    }
    form.gym = { exercises: groups };
  }

  if (p.endurance) {
    // Healthkit-ingested distances are measured facts: carry them whole and
    // restore the display field empty — rendering to a 2 dp string would bake
    // a ~10 m rounding error into the payload on every edit.
    const measuredEnd = obs.source.type === 'healthkit' ? p.endurance.distanceM : undefined;
    form.endurance = {
      distance:
        p.endurance.distanceM != null && measuredEnd == null
          ? numStr(metersToDisplay(p.endurance.distanceM, units.distanceUnit), 2)
          : '',
      ...(measuredEnd != null ? { measuredDistanceM: measuredEnd } : {}),
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
      // Never guessed (⚑ E-17) — an ambiguous import may genuinely have no
      // style; null shows no chip selected rather than fabricating one that
      // becomes a permanent "fact" the moment the session is next resaved.
      style: p.climbing.style ?? null,
      indoor: p.climbing.indoor ?? null,
      sends: p.climbing.sends.map((s) => ({
        id: idFactory(),
        grade: s.grade,
        attempts: String(s.attempts),
        sent: s.sent,
        // Pre-E4 rows (and any row the user simply didn't pick a chip for)
        // carry sent but no outcome. Never guessed — sent:true alone can't
        // tell onsight from flash from redpoint from pinkpoint, so this stays
        // null rather than manufacturing a specific answer that would become
        // a permanent "fact" the moment the session is next resaved.
        outcome: s.outcome ?? null,
        route: s.route ?? '',
        pitches: s.pitches != null ? String(s.pitches) : '',
        ...(s.raw ? { raw: s.raw } : {}),
      })),
      totalProblems: p.climbing.totalProblems != null ? String(p.climbing.totalProblems) : '',
      ...(p.climbing.location ? { location: p.climbing.location } : {}),
    };
  }

  if (p.swimming) {
    const sw = p.swimming;
    const hasLengths = sw.lengths != null && sw.lengths.length > 0;
    // Measured totals (ingested lengths, or any healthkit swim — a watch may
    // report a total with no per-length rows) ride whole; the display-unit
    // estimate field stays empty (it would round the fact).
    const measuredSwim =
      hasLengths || obs.source.type === 'healthkit' ? sw.distanceM : undefined;
    form.swim = {
      mode: sw.poolLengthM != null ? 'pool' : 'open',
      // 2 digits, not 0: ingested yard pools are 22.86 m — rounding to '23'
      // would silently corrupt the pool length on edit. Trailing zeros are
      // trimmed, so a manual '25' still restores as '25'.
      poolLengthM: sw.poolLengthM != null ? numStr(sw.poolLengthM, 2) : '',
      laps: sw.laps != null ? String(sw.laps) : '',
      distance:
        measuredSwim == null && sw.poolLengthM == null && sw.distanceM != null
          ? numStr(metersToDisplay(sw.distanceM, units.distanceUnit), 2)
          : '',
      stroke: sw.stroke ?? 'freestyle',
      energySystem: sw.energySystem,
      // Carried whole, never hand-edited — buildSwimming() writes them back and
      // keeps the measured total instead of recomputing laps × poolLengthM.
      ...(hasLengths ? { lengths: sw.lengths } : {}),
      ...(measuredSwim != null ? { measuredDistanceM: measuredSwim } : {}),
    };
  }

  if (p.practice) {
    form.practice = {
      style: p.practice.style ?? '',
      styleId: p.practice.styleId ?? '',
      contextTag: p.practice.contextTag ?? null,
      bodyAreas: (p.practice.bodyAreas ?? []).map((a) => ({
        id: idFactory(),
        zoneId: a.zoneId,
        ...(a.side ? { side: a.side } : {}),
        tightness: a.tightness != null ? String(a.tightness) : '',
      })),
    };
  }

  if (p.breathwork) {
    form.breathwork = {
      patternId: p.breathwork.patternId ?? '',
      cycles: p.breathwork.cycles != null ? String(p.breathwork.cycles) : '',
      capture: p.breathwork.capture ?? null,
      rounds: (p.breathwork.rounds ?? []).map((r) => ({
        id: idFactory(),
        retentionSec: String(r.retentionSeconds),
        breaths: r.breathsCount != null ? String(r.breathsCount) : '',
      })),
    };
  }

  if (p.painAreas) {
    form.painAreas = p.painAreas.map((a) => ({
      id: idFactory(),
      zoneId: a.zoneId,
      ...(a.side ? { side: a.side } : {}),
      pain: String(a.pain),
    }));
  }

  // Water bespoke blocks: restore EVERY field — the edit path rebuilds the whole
  // payload from form state, so anything dropped here is silently destroyed on
  // edit. Gauge/wind snapshots restore carry-whole and are NEVER refetched.
  if (p.whitewater) {
    const ww = p.whitewater;
    form.whitewater = {
      riverName: ww.riverName ?? '',
      sectionName: ww.sectionName ?? '',
      sectionClass: ww.sectionClass ?? '',
      waterTempC: numStr(ww.waterTempC, 2),
      hazards: ww.hazards ?? '',
      swims: ww.swims != null ? String(ww.swims) : '',
      rolls: ww.rolls != null ? String(ww.rolls) : '',
      ...(ww.spotId ? { spotId: ww.spotId } : {}),
      ...(ww.boatGearId ? { boatGearId: ww.boatGearId } : {}),
      ...(ww.gauge ? { gauge: ww.gauge } : {}),
      ...(ww.precip72hMm != null ? { precip72hMm: ww.precip72hMm } : {}),
    };
  }

  if (p.wind) {
    const wd = p.wind;
    form.wind = {
      note: wd.note ?? '',
      ...(wd.spotId ? { spotId: wd.spotId } : {}),
      ...(wd.spotName ? { spotName: wd.spotName } : {}),
      ...(wd.sessionStyle ? { sessionStyle: wd.sessionStyle } : {}),
      ...(wd.endSpotId ? { endSpotId: wd.endSpotId } : {}),
      ...(wd.endSpotName ? { endSpotName: wd.endSpotName } : {}),
      ...(wd.wind ? { wind: wd.wind } : {}),
      ...(wd.kitId ? { kitId: wd.kitId } : {}),
      ...(wd.gearIds ? { gearIds: wd.gearIds } : {}),
    };
  }

  if (p.sky) {
    form.sky = {
      ...(p.sky.track ? { track: p.sky.track } : {}),
      ...(p.sky.trackSource ? { trackSource: p.sky.trackSource } : {}),
      segments: p.sky.segments ?? [],
      ascentMode: p.sky.ascentMode ?? '',
      onSkis: p.sky.onSkis === true,
    };
  }

  return form;
}
