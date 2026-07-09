/**
 * normalizeWorkout.ts — pure conversion from RawWorkout to a session Observation.
 *
 * No native imports, no SQLite, no fetch — same testability contract as
 * normalize.ts. The reader has already done all unit conversion (metres, kcal,
 * seconds), so this module is pure shape work: HK activity type → registry
 * activity id, absolute length instants → offsets from session start, HK
 * stroke-style enum → the SwimLength stroke union.
 *
 * Provenance: `source.workoutUuid` is the dedup key (two workouts in one civil
 * day is normal — day-keyed dedup is for steps/sleep only). Fidelity 0.95 is
 * the EXISTING device-recorded rung documented in lib/session.ts — a watch
 * recording is the most-measured capture the app has. ⚑ flagged for Dylan:
 * session fidelity predates the "fidelity is food-only" ruling.
 */
import type {
  EnduranceBlock,
  IANATimezone,
  ISOInstant,
  Modality,
  ObservationOf,
  SwimLength,
  SwimmingBlock,
} from '@core/observation';
import type { RawSwimLength, RawWorkout } from '@/lib/wearable';
import { activityById, type Activity } from '@/lib/activity';
import { uuidv7 } from '@/lib/id';

const WORKOUT_FIDELITY = 0.95;

/** HK WorkoutActivityType → activity registry id. WATER types only in v1;
 *  Earth appends run=37 / ride=13 / hike=24 on its branch (contract §7). ⚑
 *  paddleSports → 'kayak' is a default — HK can't tell whitewater from
 *  flatwater; the user edits the activity after import. ⚑ */
const HK_TYPE_TO_ACTIVITY: Record<number, string> = {
  46: 'swim', // swimming (pool — open-water is skipped by the reader)
  31: 'kayak', // paddleSports
  38: 'sail', // sailing
  45: 'surf', // surfingSports
};

/** HK SwimmingStrokeStyle enum → the SwimLength stroke union. Values from
 *  healthkit.generated.d.ts; unrecognized future arms collapse to 'unknown'
 *  (which is what they are to us — never a guess). */
const HK_STROKE_TO_UNION: Record<number, SwimLength['stroke']> = {
  0: 'unknown',
  1: 'mixed',
  2: 'freestyle',
  3: 'backstroke',
  4: 'breaststroke',
  5: 'butterfly',
  6: 'kickboard',
};

function mapStroke(hkStrokeStyle: number | undefined): SwimLength['stroke'] | undefined {
  if (hkStrokeStyle === undefined) return undefined;
  return HK_STROKE_TO_UNION[hkStrokeStyle] ?? 'unknown';
}

function toSwimLength(raw: RawSwimLength, sessionStartMs: number): SwimLength {
  const startMs = new Date(raw.startUtc).getTime();
  const endMs = new Date(raw.endUtc).getTime();
  const stroke = mapStroke(raw.hkStrokeStyle);
  return {
    startSec: Math.round((startMs - sessionStartMs) / 1000),
    durationS: Math.max(0, Math.round((endMs - startMs) / 1000)),
    ...(raw.distanceM !== undefined ? { distanceM: raw.distanceM } : {}),
    ...(raw.strokes !== undefined ? { strokes: raw.strokes } : {}),
    ...(stroke !== undefined ? { stroke } : {}),
  };
}

export type NormalizeWorkoutCtx = {
  tz: IANATimezone;
  nowUtc: ISOInstant;
  /** Injectable for tests; defaults to the real registry lookup. */
  activityLookup?: (id: string) => Activity | undefined;
};

/**
 * One RawWorkout → one session Observation, or null when the HK type has no
 * registry mapping (defensive — the reader already filters to water types).
 */
export function normalizeWorkout(
  raw: RawWorkout,
  ctx: NormalizeWorkoutCtx
): ObservationOf<'session'> | null {
  const activityId = HK_TYPE_TO_ACTIVITY[raw.hkActivityType];
  if (!activityId) return null;

  const lookup = ctx.activityLookup ?? activityById;
  const activity = lookup(activityId);
  const modality: Modality = activity?.modality ?? 'other';
  // EnduranceBlock/SwimmingBlock require energySystem — without it the session
  // is un-editable. Registry default, falling back to 'aerobic'.
  const energySystem = activity?.defaultEnergySystem ?? 'aerobic';

  const sessionStartMs = new Date(raw.startUtc).getTime();

  let swimming: SwimmingBlock | undefined;
  let endurance: EnduranceBlock | undefined;
  if (activityId === 'swim') {
    const lengths = (raw.swim?.lengths ?? []).map((l) => toSwimLength(l, sessionStartMs));
    swimming = {
      energySystem,
      // MEASURED total from the device — never recomputed laps × poolLengthM.
      ...(raw.distanceM !== undefined ? { distanceM: raw.distanceM } : {}),
      ...(raw.swim?.lapLengthM !== undefined ? { poolLengthM: raw.swim.lapLengthM } : {}),
      ...(lengths.length > 0 ? { laps: lengths.length, lengths } : {}),
    };
  } else {
    endurance = {
      energySystem,
      ...(raw.distanceM !== undefined ? { distanceM: raw.distanceM } : {}),
      ...(raw.route !== undefined ? { gpsPath: raw.route } : {}),
    };
  }

  return {
    id: uuidv7(),
    kind: 'session',
    occurredAt: raw.startUtc,
    loggedAt: ctx.nowUtc,
    tz: ctx.tz,
    tier: 1, // HAPPENED — the watch recorded it
    fidelity: WORKOUT_FIDELITY,
    source: { type: 'healthkit', rawType: 'HKWorkout', workoutUuid: raw.uuid },
    payload: {
      kind: 'session',
      modality,
      activity: activityId,
      durationMin: Math.round(raw.durationS / 60), // ALWAYS present — measured fact
      ...(swimming ? { swimming } : {}),
      ...(endurance ? { endurance } : {}),
    },
  };
}

/** Batch form, dropping unmappable workouts, sorted by occurrence. */
export function normalizeWorkouts(
  raw: readonly RawWorkout[],
  ctx: NormalizeWorkoutCtx
): ObservationOf<'session'>[] {
  const out: ObservationOf<'session'>[] = [];
  for (const w of raw) {
    const obs = normalizeWorkout(w, ctx);
    if (obs) out.push(obs);
  }
  out.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return out;
}
