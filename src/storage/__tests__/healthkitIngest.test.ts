/**
 * Ingest integration test — fake WearableSource against the real SQLite port.
 *
 * Covers the contract the UI depends on:
 *   - backfill inserts one steps + one sleep Observation per civil day from the
 *     authoritative source;
 *   - re-running the backfill (or a daily poll right after) inserts ZERO
 *     duplicates, because dedup is keyed on kind + civil day + healthkit source;
 *   - setBackfillDone flips after a successful backfill.
 */
import { describe, it, expect } from '@jest/globals';
import { runBackfill, runDailyPoll } from '@/lib/healthkit/ingest';
import { readState } from '@/lib/healthkit/state';
import { runMigrations } from '@/storage/db';
import { listObservations } from '@/storage/observations';
import { makeTestDb } from './sqliteTestDb';
import type {
  DateRange,
  RawDailyStepSample,
  RawSleepSample,
  WearableSource,
} from '@/lib/wearable';
import { todayLocalDate, addDays, deviceTz } from '@/lib/date';

function makeFakeReader(): WearableSource {
  // Three days of data ending today (in the device tz).
  const today = todayLocalDate();
  const days = [addDays(today, -2), addDays(today, -1), today];

  const steps: RawDailyStepSample[] = [];
  for (const d of days) {
    // Two sources for each day — Garmin should win.
    steps.push({
      date: d,
      count: 5000,
      sourceBundleId: 'com.apple.Health',
      sourceName: 'iPhone',
    });
    steps.push({
      date: d,
      count: 8000,
      sourceBundleId: 'com.garmin.connect.mobile',
      sourceName: 'Garmin',
    });
  }

  const tz = deviceTz();
  const sleep: RawSleepSample[] = days.map((d) => {
    // 22:00 prev local → 06:00 d local. Build via local-time Date constructor
    // so endUtc lands inside `d` in the device tz (wake-day attribution).
    const [y, m, dd] = d.split('-').map(Number);
    const wakeLocal = new Date(y, m - 1, dd, 6, 0, 0);
    const sleepLocal = new Date(y, m - 1, dd - 1, 22, 0, 0);
    return {
      startUtc: sleepLocal.toISOString(),
      endUtc: wakeLocal.toISOString(),
      stage: 'asleepUnspecified',
      sourceBundleId: 'com.garmin.connect.mobile',
      sourceName: 'Garmin',
      tz,
    };
  });

  return {
    async requestPermissions() {
      return true;
    },
    async readSteps(_range: DateRange) {
      return steps;
    },
    async readSleep(_range: DateRange) {
      return sleep;
    },
    async readActivities() {
      throw new Error('not implemented in fake');
    },
  };
}

describe('healthkit ingest', () => {
  it('backfill inserts one steps + one sleep observation per civil day', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const reader = makeFakeReader();

    const result = await runBackfill(reader, db);
    expect(result.stepsInserted).toBe(3);
    expect(result.sleepInserted).toBe(3);

    const allSteps = await listObservations({ kinds: ['steps'] }, db);
    const allSleep = await listObservations({ kinds: ['sleep'] }, db);
    expect(allSteps).toHaveLength(3);
    expect(allSleep).toHaveLength(3);

    // Each steps observation took the Garmin number (8000), not iPhone (5000),
    // not their sum (13000).
    for (const o of allSteps) {
      expect(o.kind).toBe('steps');
      if (o.payload.kind === 'steps') {
        expect(o.payload.count).toBe(8000);
      }
      expect(o.source).toEqual({
        type: 'healthkit',
        rawType: 'HKQuantityTypeIdentifierStepCount',
      });
      expect(o.tier).toBe(1);
    }

    for (const o of allSleep) {
      expect(o.kind).toBe('sleep');
      expect(o.source).toEqual({
        type: 'healthkit',
        rawType: 'HKCategoryTypeIdentifierSleepAnalysis',
      });
      expect(o.tier).toBe(1);
      if (o.payload.kind === 'sleep') {
        expect(o.payload.durationMin).toBe(480); // 8h
      }
    }

    const state = await readState(db);
    expect(state.backfillDone).toBe(true);
  });

  it('a second backfill run after the first inserts zero duplicates', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const reader = makeFakeReader();

    await runBackfill(reader, db);
    const second = await runBackfill(reader, db);
    expect(second.stepsInserted).toBe(0);
    expect(second.sleepInserted).toBe(0);

    const allSteps = await listObservations({ kinds: ['steps'] }, db);
    const allSleep = await listObservations({ kinds: ['sleep'] }, db);
    expect(allSteps).toHaveLength(3);
    expect(allSleep).toHaveLength(3);
  });

  it('a daily poll right after backfill also inserts zero duplicates', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const reader = makeFakeReader();

    await runBackfill(reader, db);
    const poll = await runDailyPoll(reader, db);
    expect(poll.stepsInserted).toBe(0);
    expect(poll.sleepInserted).toBe(0);
  });
});
