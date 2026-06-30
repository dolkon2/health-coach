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
import { setBackfillDone } from './state';

const BACKFILL_DAYS = 90;
const DAILY_LOOKBACK_HOURS = 18; // covers an overnight sleep window comfortably

type IngestResult = {
  stepsInserted: number;
  sleepInserted: number;
};

async function ingestRange(
  reader: WearableSource,
  fromUtc: string,
  toUtc: string,
  db?: SqlDatabase
): Promise<IngestResult> {
  const range = { fromUtc, toUtc };
  const [rawSteps, rawSleep] = await Promise.all([
    reader.readSteps(range),
    reader.readSleep(range),
  ]);

  const ctx = { tz: deviceTz(), nowUtc: new Date().toISOString() };
  const steps = normalizeSteps(rawSteps, ctx);
  const sleep = normalizeSleep(rawSleep, ctx);

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
  return { stepsInserted, sleepInserted };
}

export async function runBackfill(
  reader: WearableSource,
  db?: SqlDatabase
): Promise<IngestResult> {
  const fromUtc = daysAgoUtc(BACKFILL_DAYS);
  const toUtc = new Date().toISOString();
  const result = await ingestRange(reader, fromUtc, toUtc, db);
  await setBackfillDone(true, db);
  return result;
}

export async function runDailyPoll(
  reader: WearableSource,
  db?: SqlDatabase
): Promise<IngestResult> {
  const fromUtc = new Date(Date.now() - DAILY_LOOKBACK_HOURS * 3600_000).toISOString();
  const toUtc = new Date().toISOString();
  return ingestRange(reader, fromUtc, toUtc, db);
}
