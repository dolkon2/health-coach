/**
 * observation.ts — The one record type everything becomes.
 *
 * Every input to the product — a weigh-in, a session, a food entry, a sleep
 * record — becomes an Observation. The variety lives in the `kind` discriminator
 * and the `payload`, never in parallel schemas. This is the contract the whole
 * product sits on. See planning/data-model.md.
 *
 * Two fields are load-bearing invariants (constitution, evidence hierarchy):
 *   - tier:     1 = HAPPENED, 2 = ACCUMULATED, 3 = MODELED. A tier-3 value may
 *               never overwrite, gate, or contradict a tier-1 value.
 *   - fidelity: 0..1 capture precision. A gram-weighed meal ~1.0, a photo
 *               guess ~0.4. Never absent.
 */

// ─── Supporting scalar types ────────────────────────────────────────────────

export type ObservationId = string; // uuid v7 (time-sortable)
export type ISOInstant = string; // ISO 8601 UTC, e.g. '2026-06-25T14:32:00Z'
export type IANATimezone = string; // e.g. 'America/Los_Angeles'
export type LocalDate = string; // 'YYYY-MM-DD' in the user's local civil day

export type GeoPoint = { lat: number; lng: number; tsSec: number; eleM?: number };

export type Tier = 1 | 2 | 3;

// ─── Discriminators ─────────────────────────────────────────────────────────

export type ObservationKind =
  | 'weighIn'
  | 'session' // a training session (lift, run, ride, climb, kayak, etc.)
  | 'foodEntry'
  | 'sleep'
  | 'steps'
  | 'subjective'; // RPE, mood, soreness, energy — user-defined

export type Modality =
  | 'gym' // lift-focused
  | 'run'
  | 'ride'
  | 'swim'
  | 'climb'
  | 'paddle'
  | 'surf'
  | 'hike'
  | 'hiit'
  | 'mobility'
  | 'other';

export type MovementPattern =
  | 'upper-push'
  | 'upper-pull'
  | 'hip-hinge'
  | 'quad-dom'
  | 'core'
  | 'carry'
  | 'rotation'
  | 'unilateral-leg'
  | 'isolation'
  | 'other';

export type EnergySystem = 'aerobic' | 'glycolytic' | 'mixed';

// ─── Provenance ─────────────────────────────────────────────────────────────

export type ObservationSource =
  | { type: 'manual' }
  | { type: 'healthkit'; rawType: string }
  | { type: 'healthconnect'; rawType: string }
  | { type: 'garmin'; activityId: string }
  | { type: 'foodapi'; provider: 'nutritionix' | 'usda' | 'openfoodfacts'; itemId: string }
  | { type: 'photoestimate'; modelVersion: string }
  | { type: 'derived'; from: ObservationId[]; engine: string }; // computed by an engine

// ─── Payloads by kind ───────────────────────────────────────────────────────

export type WeighInPayload = {
  kind: 'weighIn';
  weightKg: number;
  bodyFatPct?: number; // if scale measures it
};

export type LiftingBlock = {
  sets: Array<{
    exercise: string; // e.g. 'barbell back squat'
    movementPattern: MovementPattern; // required — the engine depends on it
    weightKg: number;
    reps: number;
    rir?: number; // reps in reserve, optional
    isWarmup?: boolean;
  }>;
};

export type EnduranceBlock = {
  distanceM?: number;
  elevationGainM?: number;
  avgHr?: number;
  energySystem: EnergySystem;
  gpsPath?: GeoPoint[]; // if synced from device
};

export type ClimbingBlock = {
  style: 'sport' | 'trad' | 'boulder' | 'top-rope' | 'gym';
  sends: Array<{ grade: string; attempts: number; sent: boolean; route?: string }>;
  totalProblems?: number; // for high-volume sessions where individual logging is impractical
};

export type PaddlingBlock = {
  discipline: 'whitewater' | 'flatwater' | 'sea' | 'sup' | 'surf-ski';
  distanceM?: number;
  gpsPath?: GeoPoint[];
  segmentTimes?: Array<{ name: string; durationSec: number }>;
};

export type SessionPayload = {
  kind: 'session';
  modality: Modality;
  durationMin: number;
  // Sport-specific blocks — only the relevant ones populated.
  lifting?: LiftingBlock;
  endurance?: EnduranceBlock;
  climbing?: ClimbingBlock;
  paddling?: PaddlingBlock;
  perceivedEffort?: number; // 1–10 RPE, optional but encouraged
  templateId?: string; // if launched from a saved template
  benchmarkRefs?: string[]; // benchmarks this session was logged toward
};

export type FoodEntryPayload = {
  kind: 'foodEntry';
  description: string;
  servings: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  alcoholG?: number;
  // Amount actually consumed, in grams. Optional for back-compat with non-weighed
  // sources (e.g. free-text "had a burrito"), but populated whenever the source
  // is API-search-with-quantity, barcode, or scale. Needed so edits can re-scale
  // macros proportionally without losing information.
  grams?: number;
};

export type SleepPayload = {
  kind: 'sleep';
  durationMin: number;
  // We trust duration. Stage breakdowns are tier-3 if present.
  stages?: { deepMin: number; remMin: number; lightMin: number; awakeMin: number };
};

export type StepsPayload = {
  kind: 'steps';
  count: number; // the day's total, inserted once per civil day
};

export type SubjectivePayload = {
  kind: 'subjective';
  metric: 'mood' | 'soreness' | 'energy' | 'stress' | 'custom';
  customLabel?: string;
  value: number; // 1–10 by convention
};

export type ObservationPayload =
  | WeighInPayload
  | SessionPayload
  | FoodEntryPayload
  | SleepPayload
  | StepsPayload
  | SubjectivePayload;

// ─── The universal record ───────────────────────────────────────────────────

export type Observation = {
  id: ObservationId;
  kind: ObservationKind;
  occurredAt: ISOInstant; // UTC instant the thing happened
  loggedAt: ISOInstant; // UTC instant the user logged it (may differ)
  tz: IANATimezone; // user's local timezone at occurrence
  tier: Tier;
  fidelity: number; // 0..1; capture confidence
  source: ObservationSource;
  payload: ObservationPayload;
  notes?: string;
  supersedes?: ObservationId; // edit history: this observation replaces an earlier one
};

// A typed Observation whose payload is narrowed to a specific kind.
export type ObservationOf<K extends ObservationKind> = Observation & {
  payload: Extract<ObservationPayload, { kind: K }>;
};

// ─── Type guards ────────────────────────────────────────────────────────────

export function isKind<K extends ObservationKind>(
  obs: Observation,
  kind: K
): obs is ObservationOf<K> {
  return obs.payload.kind === kind;
}
