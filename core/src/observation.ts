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

// ─── Food logging (Ring 2) ──────────────────────────────────────────────────

/**
 * The nutrition databases backing the food layer. Free sources only (USDA +
 * Open Food Facts). 'fatsecret' is reserved for a future input method and is
 * added only when adopted; 'nutritionix' was rejected (free tier killed). This
 * mirrors `ObservationSource.foodapi.provider` — keep the two in sync.
 */
export type FoodSourceDb = 'usda' | 'openfoodfacts';

/**
 * How a meal entered the timeline. Fidelity keys off what this method actually
 * extracted, never off the device/screen ("channel"). Phase 2 ships `weighed`
 * + `described`; `barcode` is the 2.7 fast-follow; `photo` is a schema-reserved
 * member with no Phase-2 build surface (see food-logging-spec.md).
 */
export type InputMethod = 'weighed' | 'barcode' | 'photo' | 'described';

/** How a FoodItem's portion quantity was determined. */
export type QuantityMethod = 'measured' | 'package' | 'estimated';

/**
 * One resolved food within a meal. The Pass 2.2 adapter normalizes an API
 * response into this shape: macros scaled to `quantity`, plus a per-item
 * default fidelity and its method/source-bound ceiling. A meal's flat macros
 * are the rollup of its items; a meal's composite fidelity is blendComposite()
 * over their per-item fidelities.
 *
 * Macros: `null` = not captured (partial), never `0`, never inferred.
 */
export interface FoodItem {
  sourceDb: FoodSourceDb;
  foodId: string;
  quantity: number; // canonical quantity; the 2.2 adapter reconciles unit bases
  quantityMethod: QuantityMethod;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG?: number;
  alcoholG?: number;
  fidelity: number; // 0..1, this item alone
  fidelityCeiling: number; // 0..1, set by method/source, never exceeded
}

/**
 * A saved meal definition — NOT an Observation. It lives in its own
 * `meal_templates` table (modeled on benchmarks) because it is a definition,
 * not a timeline event.
 *
 * It deliberately stores neither an earned fidelity nor an occurrences[] list:
 * earned fidelity is engine-derived (Phase 7) by joining occurrence *queries*
 * (foodEntry observations carrying this id) against the expenditure engine's
 * per-window residual confidence — it is never written by the logging layer.
 * See food-logging-spec.md § Earned fidelity and the build plan § 4.
 */
export interface MealTemplate {
  id: string;
  canonicalItems: FoodItem[];
  userConfirmed: boolean; // v1: created by the user saving a meal
  createdAt: ISOInstant;
}

// ─── Provenance ─────────────────────────────────────────────────────────────

export type ObservationSource =
  | { type: 'manual' }
  | { type: 'healthkit'; rawType: string }
  | { type: 'healthconnect'; rawType: string }
  | { type: 'garmin'; activityId: string }
  | { type: 'foodapi'; provider: FoodSourceDb; itemId: string }
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
  // Identity label (e.g. 'calisthenics', 'wingfoil') — the activity the user
  // picked. Maps to a logging surface and the nearest `modality` via the registry
  // (src/lib/activity.ts). Optional: legacy sessions and the quick-log picker may
  // carry only `modality`. Display + reveal() prefer it over the coarser modality.
  activity?: string;
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
  // The flat macros are the ROLLUP of `items`, always written when known —
  // regardless of the user's nutrition-focus (focus is display-only; there is
  // deliberately no `focus` field here). `null` = not captured (partial log),
  // distinct from `0` = captured zero, and never inferred. isPartial() reads it.
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG?: number;
  alcoholG?: number;
  // ─ Ring 2 additions ─
  items: FoodItem[]; // composite meals; the macros above are these rolled up
  inputMethod: InputMethod; // how the meal was captured (extraction, not channel)
  fidelityCeiling: number; // 0..1, set by inputMethod, never exceeded
  templateId?: string; // links to a saved MealTemplate, if re-logged from one
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

/**
 * A meal is *partial* precisely when any required macro is `null` — i.e. the
 * input genuinely yielded only some macros (e.g. a `described` "42g protein"
 * with no food/portion resolved). Partiality is structural, read from the data,
 * never a stored `is_partial` flag that could drift out of sync. Fiber and
 * alcohol are optional, not required, so their absence does not make a log
 * partial. See food-logging-spec.md § Partial logs are a first-class honest state.
 */
export function isPartial(meal: FoodEntryPayload): boolean {
  return (
    meal.kcal === null ||
    meal.proteinG === null ||
    meal.carbsG === null ||
    meal.fatG === null
  );
}
