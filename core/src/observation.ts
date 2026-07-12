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

import type { GaugeSnapshot, WindSnapshot } from './conditions/snapshot';

// ─── Supporting scalar types ────────────────────────────────────────────────

export type ObservationId = string; // uuid v7 (time-sortable)
export type ISOInstant = string; // ISO 8601 UTC, e.g. '2026-06-25T14:32:00Z'
export type IANATimezone = string; // e.g. 'America/Los_Angeles'
export type LocalDate = string; // 'YYYY-MM-DD' in the user's local civil day

/**
 * Where a point's elevation reading came from. Precedence when merging:
 * barometric > gps > dem — a dem correction never overwrites a barometric
 * reading. Writers omit the field when eleM is absent (never 'none' on write);
 * 'none' is reserved for a processing stage that explicitly declares no
 * elevation was available.
 */
export type ElevationSource = 'barometric' | 'gps' | 'dem' | 'none';

// Type-only: erased at compile, so the conditions.ts ↔ observation.ts
// reference cycle has no runtime edge.
import type { ConditionsSnapshot } from './conditions';
import type { ClimbGradeSystem } from './climbGrade';
import type { LatLng } from './geo';

export type GeoPoint = {
  lat: number;
  lng: number;
  tsSec: number;
  eleM?: number;
  // Per-point elevation provenance (see ElevationSource). Absent when eleM is
  // absent — a source label without a reading would be a fabricated value.
  eleSource?: ElevationSource;
};

export type Tier = 1 | 2 | 3;

// ─── Discriminators ─────────────────────────────────────────────────────────

export type ObservationKind =
  | 'weighIn'
  | 'session' // a training session (lift, run, ride, climb, kayak, etc.)
  | 'foodEntry'
  | 'sleep'
  | 'steps'
  | 'subjective' // RPE, mood, soreness, energy — user-defined
  | 'romReading'; // a self-administered range-of-motion test value (weigh-in analog)

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
  | 'dance'
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

/** Which side of the body an entry refers to — only for sided zones, always optional. */
export type BodySide = 'left' | 'right' | 'both';

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
 * member with no Phase-2 build surface (see food-logging-spec.md). `label` is a
 * photographed Nutrition Facts panel TRANSCRIBED by the vision model — the data
 * is label-declared (like `barcode`), the extraction is a machine read of it.
 */
export type InputMethod = 'weighed' | 'barcode' | 'photo' | 'described' | 'label';

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
  // Keyless LLM estimates omit both `sourceDb` and `foodId` — they have no
  // food-database lineage (provenance lives on the Observation's `estimate`
  // source). USDA/OFF items carry both.
  sourceDb?: FoodSourceDb;
  foodId?: string;
  description?: string; // the food's human name (e.g. 'Cheddar cheese') from the source record; display-only, never gates anything
  portionText?: string; // an estimate's human portion phrasing ("2 eggs", "a handful"); display-only, never gates anything
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
  name?: string; // a readable label for the saved meal (its meal description, or its items' names joined); display-only
  canonicalItems: FoodItem[];
  userConfirmed: boolean; // v1: created by the user saving a meal
  createdAt: ISOInstant;
}

// ─── Provenance ─────────────────────────────────────────────────────────────

export type ObservationSource =
  | { type: 'manual' }
  // workoutUuid: HK workout UUID — the dedup key for ingested sessions (two
  // workouts in one civil day is normal; day-keyed dedup is for steps/sleep).
  | { type: 'healthkit'; rawType: string; workoutUuid?: string }
  | { type: 'healthconnect'; rawType: string }
  | { type: 'garmin'; activityId: string }
  // user-picked activity file, parsed client-side (wearable-ingestion-spec.md
  // Addendum, Layer 2). `platform` tags which exporter a generic 'csv' came
  // from (⚑ E-16 — climbing tick import, Pass E5); meaningless for
  // gpx/fit/tcx. strong-csv/hevy-csv are Body P5's gym imports; igc is Sky's
  // flight-recorder import.
  | {
      type: 'fileimport';
      format: 'gpx' | 'fit' | 'tcx' | 'igc' | 'csv' | 'strong-csv' | 'hevy-csv';
      filename?: string;
      platform?: string;
      // Strong/Hevy only: hash(date, workout name, exercise, set order,
      // weight, reps) per source row this session was built from — lets a
      // re-import of an overlapping export skip already-stored rows without
      // a new table (payload/source JSON is the only place this lives).
      rowHashes?: string[];
    }
  | { type: 'foodapi'; provider: FoodSourceDb; itemId: string }
  | { type: 'estimate'; modelVersion: string } // direct LLM nutrition estimate — keyless items, no food-db lineage
  | { type: 'photoestimate'; modelVersion: string }
  | { type: 'labelscan'; modelVersion: string } // vision-TRANSCRIBED Nutrition Facts panel — declared values, not an estimate; keyless (no food-db lineage)
  | { type: 'derived'; from: ObservationId[]; engine: string }; // computed by an engine

// ─── Payloads by kind ───────────────────────────────────────────────────────

export type WeighInPayload = {
  kind: 'weighIn';
  weightKg: number;
};

export type LiftingBlock = {
  sets: Array<{
    exercise: string; // e.g. 'barbell back squat' — the stored fact, always present
    exerciseId?: string; // Free Exercise DB slug when picked from the library; the name above stays the fact
    movementPattern: MovementPattern; // required — the engine depends on it
    weightKg: number; // external load; on a bodyweight movement this is ADDED load (0 = strict bodyweight)
    reps: number; // 0 for a pure hold set — the hold time is the work, so volume math (weightKg × reps) honestly contributes nothing
    holdSec?: number; // isometric hold time in seconds (planche, plank, L-sit). Absent = a reps set; never a fabricated 0
    rir?: number; // reps in reserve, optional
    isWarmup?: boolean;
    completedAt?: ISOInstant; // when the set was finished, stamped live by the logger.
    // Session duration is derived from the spread of these (deriveSessionDuration),
    // not declared — so it falls out of structure. Absent for batch-entered sets.
  }>;
};

/**
 * Provenance of EnduranceBlock.elevationGainM. 'gps' = computed from a
 * GPS-elevation track; 'manual' = typed by the user; 'barometric' is reserved
 * for sources that declare it (e.g. HealthKit elevationAscended); 'dem' for a
 * terrain-model correction. Written only alongside elevationGainM — never a
 * label without a value.
 */
export type ElevationGainSource = 'barometric' | 'gps' | 'dem' | 'manual';

export type EnduranceBlock = {
  distanceM?: number;
  elevationGainM?: number;
  elevationGainSource?: ElevationGainSource; // absent when elevationGainM is absent
  avgHr?: number;
  energySystem: EnergySystem;
  gpsPath?: GeoPoint[]; // if synced from device
  // Backlink to a saved Spot (pinned-spots-spec.md P1's save-as-spot pass),
  // set from gpsPath[0] (the start point) at save time. Optional — most
  // endurance sessions never get promoted to a spot.
  spotId?: string;
  // Backlink to a Route this session followed (routes-spec P1/M4, Session 9):
  // set when Record was armed with a routeId and the session finished.
  // Optional — most endurance sessions are never a follow.
  routeId?: string;
};

/**
 * Send outcome — the granularity ladder's level-3 extension (⚑ E-13/E-14,
 * dev-log/dimension-earth-build.md; the market convergently tracks this axis
 * per climbing-apps-research.md, citing Mountain Project's two-column model).
 * 'fell-hung' means the climber fell or weighted the rope/gear on this go — a
 * worked attempt, NOT a clean send, same category as 'attempt'. Only
 * onsight/flash/redpoint/pinkpoint are sends; use isSentOutcome() rather than
 * re-deriving this, since it's easy to assume "not attempt" means "sent" and
 * get fell-hung wrong (verified: that was this pass's own first draft).
 * Optional and layered on top of `sent`, never a replacement for it — `sent`
 * is the always-written coarse fact (did this send happen, yes/no) that stays
 * meaningful even when the richer outcome is unknown (a pre-E4 row) or simply
 * unspecified (the user didn't pick one). Never invent a specific `outcome`
 * from `sent` alone — sent:true is compatible with four different outcomes;
 * leave outcome absent rather than guess (constitution: never fabricate).
 */
export type ClimbOutcome = 'onsight' | 'flash' | 'redpoint' | 'pinkpoint' | 'fell-hung' | 'attempt';

/** Which ClimbOutcome values represent a completed, clean send. */
export function isSentOutcome(outcome: ClimbOutcome): boolean {
  return outcome === 'onsight' || outcome === 'flash' || outcome === 'redpoint' || outcome === 'pinkpoint';
}

export type ClimbingBlock = {
  // ⚑ E-17: 'gym' was removed as a style value — it conflated two independent
  // axes (climbing TECHNIQUE vs. WHERE it happened; Dylan's call, 2026-07-09).
  // A style is a real technique choice at manual-entry time, so the form
  // always has one; it's optional here only because an imported session can
  // be genuinely ambiguous (an 8a.nu row whose grade notation doesn't say
  // boulder or route) — absent, never a guessed value (constitution: never
  // fabricate). See `indoor` below for the axis 'gym' used to smuggle in.
  style?: 'sport' | 'trad' | 'boulder' | 'top-rope';
  // Indoor vs outdoor — independent of style (you can boulder or sport climb
  // either place). Optional: often not worth asking about, and unknown for
  // most imports. Certain only where the source guarantees it (BoardLib rows
  // are always a physical board, so the E5 importer sets this true).
  indoor?: boolean;
  sends: Array<{
    grade: string;
    // Which sandbag scale the grade matched at log time (core/climbGrade.ts),
    // frozen so a later read never has to re-guess or silently reinterpret it
    // under a different scale. Absent when the grade didn't parse against any
    // known scale — the string above stays the tier-1 fact either way.
    gradeSystem?: ClimbGradeSystem;
    attempts: number;
    sent: boolean;
    outcome?: ClimbOutcome;
    route?: string;
    // Multipitch count for outdoor routes (⚑ E-17, Dylan's call). Meaningful
    // for sport/trad/top-rope; boulder problems have none. Never defaulted to
    // 1 — a single-pitch route just carries no pitches key, same "don't
    // assert what wasn't declared" rule as everything else on a send.
    pitches?: number;
    // The original imported row, verbatim string cells, for audit (⚑ E-16 —
    // "frozen verbatim" per climbing-apps-research.md's convergent import
    // strategy). Import-only: never written by manual entry, absent on every
    // hand-logged send.
    raw?: Record<string, string>;
  }>;
  totalProblems?: number; // for high-volume sessions where individual logging is impractical
  // Crag pin (⚑ E-5): a device GPS fix taken at log time, not a Spot row —
  // Spot is a cross-dimension entity (Water hangs gauges off it); building it
  // unilaterally here would invite a merge collision. Promote pin -> Spot when
  // Spot lands. `name` is free text the user may add; never reverse-geocoded.
  location?: LatLng & { name?: string };
  // Promote-pin-to-Spot backlink (pinned-spots-spec.md P1/P4, fulfills the
  // TODO above): set once `location` is saved as a Spot from the logbook.
  // `location` itself stays untouched — this is additive, never a replacement.
  spotId?: string;
};

export type PaddlingBlock = {
  discipline: 'whitewater' | 'flatwater' | 'sea' | 'sup' | 'surf-ski';
  distanceM?: number;
  gpsPath?: GeoPoint[];
  segmentTimes?: Array<{ name: string; durationSec: number }>;
};

export type SwimStroke =
  | 'freestyle'
  | 'breaststroke'
  | 'backstroke'
  | 'butterfly'
  | 'medley'
  | 'mixed';

/**
 * One pool length, from HealthKit per-length samples (stroke count + distance
 * quantity samples joined with lap events). Times are offsets from session
 * start — tz-free and compact. Facts in, derivations out: sets, SWOLF, and
 * pace/100 are computed at read time (core/src/swim.ts), never stored.
 */
export type SwimLength = {
  startSec: number; // offset from session start
  durationS: number;
  distanceM?: number;
  strokes?: number;
  // 'kickboard'/'unknown' exist only on ingested lengths — do NOT extend the
  // SwimStroke union itself (it feeds the manual form's chip list).
  stroke?: SwimStroke | 'kickboard' | 'unknown';
  tag?: 'drill' | 'kick'; // manual annotation slot (watches can't detect kickboard work)
};

export type SwimmingBlock = {
  // Total distance. In a pool it's laps × poolLengthM — higher fidelity than a raw
  // guess; open-water is the swimmer's estimate. Optional: a timed swim with no
  // distance is still valid (null ≠ 0).
  distanceM?: number;
  poolLengthM?: number; // recorded for pool swims so the total stays auditable
  laps?: number;
  stroke?: SwimStroke;
  energySystem: EnergySystem; // lets the swim contribute energy-system minutes to the ledger
  // Per-length rows from wearable ingestion. When present, distanceM is the
  // MEASURED total (not recomputed laps × poolLengthM) and the block rides the
  // form whole so the edit path round-trips it (importMeta pattern).
  lengths?: SwimLength[];
};

/**
 * Whitewater kayaking — the purest conditions-freeze sport. The gauge reading
 * isn't context, it IS the log entry's meaning. Rides ALONGSIDE the endurance
 * block (which stays the GPS envelope); the session remains on the gps surface.
 * Private-first: hazards notes carry liability weight and never leave the device.
 */
export type WhitewaterBlock = {
  riverName?: string;
  sectionName?: string;
  spotId?: string; // ref; names above are denormalized (spot may be deleted)
  gauge?: GaugeSnapshot; // IMMUTABLE once saved — edit round-trips it untouched
  // Free text. Soft validation hint /^(VI|IV|V|I{1,3})[+-]?$/ — never a gate:
  // 'IV-V' and 'III(IV)' are legitimate notations.
  sectionClass?: string;
  boatGearId?: string; // the boat from the quiver (creek boat vs playboat changes the run)
  waterTempC?: number;
  hazards?: string; // wood/strainer notes — free text, private-first
  swims?: number;
  rolls?: number;
  precip72hMm?: number; // rain over the exact 72h preceding the session instant (rain-driven levels)
};

/**
 * Wind sports (wingfoil | windsurf | kitesurf | parawing | sail — the activity
 * id is the sub-sport discriminator and the future split point). Spot + wind +
 * gear is the canonical log: the freeze + quiver join answers "what did I ride
 * last time in these conditions?" — descriptively, never prescriptively.
 */
export type WindBlock = {
  spotId?: string;
  spotName?: string; // denormalized snapshot of the name
  // Downwind runs start and end at different spots (shuttle logistics, one-way
  // GPS); back-and-forth rides one launch. Absent = unspecified (legacy logs).
  sessionStyle?: 'downwind' | 'back-and-forth';
  endSpotId?: string; // downwinders: the landing spot (named-run entity deferred ⚑)
  endSpotName?: string;
  wind?: WindSnapshot; // IMMUTABLE once saved
  kitId?: string; // provenance if a kit was picked
  gearIds?: string[]; // resolved gear refs (kit expansion or loose picks)
  note?: string; // subjective session note ("lit on the 9m")
};

/** Dance capture context — maps to HealthKit cardio vs social dance at export time. */
export type PracticeContextTag = 'class' | 'social' | 'practice' | 'rehearsal' | 'performance';

/**
 * One body area worked in a mobility/practice session. `zoneId` is from the
 * bundled mobility-zones taxonomy (shared vocabulary with pain entries, so
 * Reflect can overlay the two without any mapping). Tightness is an optional
 * 1–5 self-rating — absent = not rated, never a defaulted middle value.
 */
export type PracticeBodyArea = {
  zoneId: string;
  side?: BodySide;
  tightness?: 1 | 2 | 3 | 4 | 5;
};

export type PracticeBlock = {
  // Yoga / Pilates / mobility / meditation. Session-level only — no per-pose logging.
  // An optional free style tag ('vinyasa', 'hatha', …). Carries no pattern or energy
  // volume: like climb/hike it appears in sessionIds and contributes nothing
  // fabricated to the ledger (constitution: never invent volume a surface can't report).
  style?: string;
  // Taxonomy id (yoga-styles / dance-taxonomy) when picked from the bundled list.
  // The free-text `style` above stays the stored fact; this is the structured key.
  styleId?: string;
  contextTag?: PracticeContextTag;
  bodyAreas?: PracticeBodyArea[];
};

/**
 * One WHM-style round's captured measurement. An aborted round is simply not
 * recorded — never a 0-second row (null ≠ 0).
 */
export type BreathworkRound = {
  // Elapsed exhale-hold (the retention) in whole seconds — THE metric. Stopwatch
  // and manual m:ss entry are equally facts; 1s precision is honest for both.
  retentionSeconds: number;
  // Power breaths before the hold. A fact when the pacer counted or the user
  // entered it; absent when unknown — never defaulted to a typical 30.
  breathsCount?: number;
};

/**
 * Breathwork block on SessionPayload — rides the practice surface (activity
 * 'breathwork'), same envelope as every other logged session. Best/avg retention
 * are derived at render from `rounds`, never stored (deriveSessionDuration
 * philosophy). See RESEARCH breathwork retention-capture model.
 */
export type BreathworkBlock = {
  patternId?: string; // FK into the bundled patterns library; freeform breathwork is valid without one
  rounds?: BreathworkRound[]; // retention-capturing patterns only; omit when empty, never []
  // How the times were captured. PROVENANCE ONLY — display as a small label if
  // at all; never a tier, never a weight, never gates anything (fidelity/capture
  // tiers are food-only).
  capture?: 'stopwatch' | 'manual';
  cycles?: number; // timed (non-retention) patterns: cycles completed, if known
};

/**
 * A pain reading the user recorded against a session. Same zone vocabulary as
 * PracticeBodyArea. `pain` is the 0–10 NRS integer: 0 is a RECORDED pain-free
 * reading, distinct from absent (no entry made) — null ≠ 0 both directions.
 * Informational only; the app never interprets these (FDA wellness framing).
 */
export type PainArea = {
  zoneId: string;
  side?: BodySide;
  pain: number;
};

/**
 * One takeoff/landing (or ground-contact) segment of a sky track — proposed by
 * flightDetector.ts, then user-editable. `startIdx`/`endIdx` index into the
 * SkyBlock's own `track`, matching the Flytec pre-buffer precedent (a segment
 * is a slice of the retained raw track, never a copy of it).
 *
 * Deliberately has NO `runGroupId` — snow run-grouping was explicitly deferred,
 * not even as a placeholder field (sky-research-track-b.md §5, resolved flag 7).
 */
export type SkySegment = {
  kind: 'air' | 'ground';
  startIdx: number;
  endIdx: number;
  // 'auto' = detector proposal, untouched. A confirmation/edit in the UI
  // moves this forward — never backward — so an edited boundary is never
  // silently re-overwritten by a later re-run of the detector.
  provenance: 'auto' | 'userConfirmed' | 'userEdited';
};

/** One piece of gear used in the session. `segmentIds` absent = used for the
 * whole session (the common case); present = this item was only in use for
 * those segments (e.g. a parakite outing swapping wings mid-session). Segment
 * identity here is positional — the segment's index in SkyBlock.segments,
 * stringified — since segments carry no id of their own. */
export type SkyGearUse = {
  gearId: string;
  segmentIds?: string[];
};

/**
 * Sky-dimension session data (paragliding, hike & fly, speedflying,
 * parakiting — sky-research-track-b.md §3a). One shared shape for all four
 * activities. Only Hike & Fly gets automatic ground-contact segmentation
 * (flightDetector.ts's `autoSegmentsForActivity`) — paragliding, speedflying,
 * and parakiting default to one continuous air segment per session instead
 * (Dylan's real XC flight over-split under the old always-on detector;
 * dev-log/dimension-sky-pass-2.md and -3.md). Parakiting CAN still hold many
 * air segments in one Observation (§5 resolved flag 4, e.g. repeated
 * touch-and-gos) via the manual "Check for a landing" re-check — it's just no
 * longer the default shape a fresh capture arrives in. The track is RAW and
 * retained forever — segments only slice it, never trim it.
 *
 * `conditionsSnapshotId` links to the existing conditions-freeze primitive
 * (core/src/conditions.ts, migration 012) rather than duplicating wind fields
 * here — the standard freeze-and-edit pattern (§5 resolved flag 6).
 */
export type SkyBlock = {
  track?: GeoPoint[]; // absent = a routeless, hand-logged sky session
  trackSource?: 'igc' | 'liveGps';
  segments?: SkySegment[]; // absent when there's no track to segment
  gearRefs?: SkyGearUse[];
  spotId?: string;
  // Backlink to a Route this flight followed (routes-spec P1/M4, Session 9) —
  // same pattern as spotId. Optional — most flights are never a follow.
  routeId?: string;
  conditionsSnapshotId?: string;
  // Speedflying only — the real driver of lap volume, never inferred from
  // discipline (research §Q3: refuted "speedriding vs speedflying changes
  // session volume" as a causal axis).
  ascentMode?: 'hike' | 'lift' | 'shuttle' | 'tour';
  // A simple per-session tag disambiguating ski descents from flight — speed
  // + vario provably cannot tell them apart (§2). Never inferred, never
  // defaulted; absent means the question was never asked, not "no".
  onSkis?: boolean;
};

export type SessionPayload = {
  kind: 'session';
  modality: Modality;
  // Identity label (e.g. 'calisthenics', 'wingfoil') — the activity the user
  // picked. Maps to a logging surface and the nearest `modality` via the registry
  // (src/lib/activity.ts). Optional: legacy sessions and the quick-log picker may
  // carry only `modality`. Display + reveal() prefer it over the coarser modality.
  activity?: string;
  // Minutes. Optional because a gym session's duration is *derived* from the set-
  // timestamp spread (deriveSessionDuration); when the session was batch-entered
  // the spread is unknowable, so duration is simply absent — never a fabricated 0
  // (constitution: null ≠ 0). Non-gym surfaces always carry a manual value.
  durationMin?: number;
  // Sport-specific blocks — only the relevant ones populated.
  lifting?: LiftingBlock;
  endurance?: EnduranceBlock;
  climbing?: ClimbingBlock;
  paddling?: PaddlingBlock;
  swimming?: SwimmingBlock;
  practice?: PracticeBlock;
  breathwork?: BreathworkBlock;
  // Pain the user recorded on THIS session — any surface (a knee can hurt on a
  // run or under a bar). A standalone flare-up is a subjective observation with
  // metric 'pain' instead. Absent = nothing recorded, not "no pain".
  painAreas?: PainArea[];
  // Water bespoke blocks — ride ALONGSIDE endurance (the GPS envelope) on the
  // gps surface. The one-block-per-surface invariant intentionally bends here:
  // the envelope is how you moved, the bespoke block is what the water was.
  whitewater?: WhitewaterBlock;
  wind?: WindBlock;
  sky?: SkyBlock;
  perceivedEffort?: number; // 1–10 RPE, optional but encouraged
  templateId?: string; // if launched from a saved template
  benchmarkRefs?: string[]; // benchmarks this session was logged toward
  gearIds?: string[]; // gear used (core/gear.ts quiver) — accrual derives from these tags on read, never a stored odometer
  conditions?: ConditionsSnapshot; // external context frozen at log time, best-effort (⚑ E-2/⚑ E-3); absent when the fetch didn't land before save
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
  // 'pain' = a standalone flare-up reading (session-attached pain lives on
  // SessionPayload.painAreas); 'protocolTick' = one "did it" mark against a
  // planned exercise in the user's own protocol (storage/protocolTicks.ts
  // enforces one per exercise per civil day).
  metric: 'mood' | 'soreness' | 'energy' | 'stress' | 'pain' | 'protocolTick' | 'custom';
  customLabel?: string;
  // 1–10 by convention. 'pain' admits 0 (0–10 NRS): a recorded pain-free
  // reading, distinct from no entry at all. 'protocolTick' stores 1 — the tick
  // IS the datum; untoggling deletes the row rather than writing a 0.
  value: number;
  zoneId?: string; // pain: mobility-zones taxonomy id (shared with PracticeBodyArea)
  side?: BodySide; // pain: only for sided zones
  protocolId?: string; // protocolTick: which of the user's protocols
  exerciseId?: string; // protocolTick: which planned exercise was done
};

/**
 * A self-administered range-of-motion test value (sit-and-reach cm, wall ankle
 * test cm, …) at retest cadence — the weigh-in analog for mobility. `testId`
 * keys the bundled rom-tests taxonomy; `unit` is the test's native unit,
 * stored so the number stays auditable if the taxonomy ever changes.
 */
export type RomReadingPayload = {
  kind: 'romReading';
  testId: string;
  side?: 'left' | 'right';
  value: number;
  unit: string; // e.g. 'cm', 'deg'
};

export type ObservationPayload =
  | WeighInPayload
  | SessionPayload
  | FoodEntryPayload
  | SleepPayload
  | StepsPayload
  | SubjectivePayload
  | RomReadingPayload;

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
export function isPartial(
  meal: Pick<FoodEntryPayload, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>
): boolean {
  return (
    meal.kcal === null ||
    meal.proteinG === null ||
    meal.carbsG === null ||
    meal.fatG === null
  );
}
