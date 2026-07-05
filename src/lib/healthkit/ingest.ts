/**
 * ingest.ts — reads from a WearableSource, normalizes, dedupes, inserts.
 *
 * Two entry points:
 *   - `runBackfill` — once on first connect, walks the trailing N days so the
 *      timeline has a baseline.
 *   - `runDailyPoll` — on each Today focus, reads only the recent window and
 *      inserts whatever's new. Repeated polls don't create duplicates because
 *      we dedupe against the existing healthkit rows for the same civil day.
 *
 * The reader is injected so tests can pass a fake without touching the bridge.
 */
import type { Observation } from '@core/observation';
import { createObservation, listObservations } from '@/storage/observations';
import { type SqlDatabase } from '@/storage/db';
import { daysAgoUtc, deviceTz } from '@/lib/date';
import type { WearableSource } from '@/lib/wearable';
import {
  isAlreadyImported,
  normalizeSleep,
  normalizeSteps,
} from './normalize';
import { normalizeWorkouts } from './normalizeWorkout';
import { setBackfillDone } from './state';

const BACKFILL_DAYS = 90;
const DAILY_LOOKBACK_HOURS = 18; // covers an overnight sleep window comfortably
// Workouts poll a much wider trailing window than steps/sleep: UUID dedup makes
// wide windows free, and an 18h lookback would permanently miss a workout that
// synced late off the watch (multi-day paddle trip, phone left at home).
const WORKOUT_LOOKBACK_DAYS = 7;
// Dedup query padding around the candidates' occurredAt span — absorbs workouts
// straddling the read-window edge (a session occurredAt can sit outside the
// exact read range the same way a civil-day row can).
const WORKOUT_DEDUP_PAD_MS = 48 * 3600_000;

type IngestResult = {
  stepsInserted: number;
  sleepInserted: number;
  workoutsInserted: number;
};

/** Insert normalized workout sessions, skipping any whose HK workout UUID is
 *  already present. UUID-keyed, NOT civil-day-keyed: two workouts in one day
 *  is normal, and re-imports must be exact no-ops. */
async function insertWorkouts(
  sessions: readonly Observation[],
  db?: SqlDatabase
): Promise<number> {
  if (sessions.length === 0) return 0;

  const occurred = sessions.map((o) => o.occurredAt).sort();
  const from = new Date(Date.parse(occurred[0]) - WORKOUT_DEDUP_PAD_MS).toISOString();
  const to = new Date(
    Date.parse(occurred[occurred.length - 1]) + WORKOUT_DEDUP_PAD_MS
  ).toISOString();
  const existing = await listObservations({ from, to, kinds: ['session'] }, db);

  const seenUuids = new Set<string>();
  for (const o of existing) {
    if (o.source.type === 'healthkit' && o.source.workoutUuid) {
      seenUuids.add(o.source.workoutUuid);
    }
  }

  let inserted = 0;
  for (const obs of sessions) {
    const uuid = obs.source.type === 'healthkit' ? obs.source.workoutUuid : undefined;
    if (uuid && seenUuids.has(uuid)) continue;
    await createObservation(obs, db);
    if (uuid) seenUuids.add(uuid); // a duplicated read within one batch is still one insert
    inserted++;
  }
  return inserted;
}

async function ingestRange(
  reader: WearableSource,
  fromUtc: string,
  toUtc: string,
  workoutFromUtc: string,
  db?: SqlDatabase
): Promise<IngestResult> {
  const range = { fromUtc, toUtc };
  const [rawSteps, rawSleep, rawWorkouts] = await Promise.all([
    reader.readSteps(range),
    reader.readSleep(range),
    reader.readActivities({ fromUtc: workoutFromUtc, toUtc }),
  ]);

  const ctx = { tz: deviceTz(), nowUtc: new Date().toISOString() };
  const steps = normalizeSteps(rawSteps, ctx);
  const sleep = normalizeSleep(rawSleep, ctx);
  const workouts = normalizeWorkouts(rawWorkouts, ctx);

  // Dedup query: cover the actual occurredAt range of the candidate
  // observations, not the read window. A civil day's observation lands at
  // end-of-day in local time → in UTC that can be in "tomorrow", outside
  // `[fromUtc, toUtc]`. Padding the upper bound +48h guarantees we see today's
  // already-inserted row when polling re-runs.
  const candidates = [...steps, ...sleep];
  const dedupRange = candidates.length
    ? {
        from: candidates.reduce((min, o) => (o.occurredAt < min ? o.occurredAt : min), candidates[0].occurredAt),
        to: new Date(
          candidates.reduce((max, o) => (o.occurredAt > max ? o.occurredAt : max), candidates[0].occurredAt)
        ).toISOString(),
      }
    : { from: fromUtc, to: toUtc };
  const existing = await listObservations(
    { from: dedupRange.from, to: dedupRange.to, kinds: ['steps', 'sleep'] },
    db
  );

  let stepsInserted = 0;
  for (const obs of steps) {
    if (isAlreadyImported(existing, obs)) continue;
    await createObservation(obs as Observation, db);
    stepsInserted++;
  }
  let sleepInserted = 0;
  for (const obs of sleep) {
    if (isAlreadyImported(existing, obs)) continue;
    await createObservation(obs as Observation, db);
    sleepInserted++;
  }
  const workoutsInserted = await insertWorkouts(workouts, db);
  return { stepsInserted, sleepInserted, workoutsInserted };
}

export async function runBackfill(
  reader: WearableSource,
  db?: SqlDatabase
): Promise<IngestResult> {
  const fromUtc = daysAgoUtc(BACKFILL_DAYS);
  const toUtc = new Date().toISOString();
  // Backfill reads workouts over the same 90-day span as steps/sleep.
  const result = await ingestRange(reader, fromUtc, toUtc, fromUtc, db);
  await setBackfillDone(true, db);
  return result;
}

export async function runDailyPoll(
  reader: WearableSource,
  db?: SqlDatabase
): Promise<IngestResult> {
  const fromUtc = new Date(Date.now() - DAILY_LOOKBACK_HOURS * 3600_000).toISOString();
  const toUtc = new Date().toISOString();
  const workoutFromUtc = daysAgoUtc(WORKOUT_LOOKBACK_DAYS);
  return ingestRange(reader, fromUtc, toUtc, workoutFromUtc, db);
}
