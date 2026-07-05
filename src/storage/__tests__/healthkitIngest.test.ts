/**
 * Ingest integration test — fake WearableSource against the real SQLite port.
 *
 * Covers the contract the UI depends on:
 *   - backfill inserts one steps + one sleep Observation per civil day from the
 *     authoritative source;
 *   - re-running the backfill (or a daily poll right after) inserts ZERO
 *     duplicates, because dedup is keyed on kind + civil day + healthkit source;
 *   - workouts land as session observations beside manual sessions, deduped by
 *     HK workout UUID — two same-day workouts both insert, a re-import doesn't;
 *   - setBackfillDone flips after a successful backfill.
 */
import { describe, it, expect } from '@jest/globals';
import { runBackfill, runDailyPoll } from '@/lib/healthkit/ingest';
import { readState } from '@/lib/healthkit/state';
import { runMigrations } from '@/storage/db';
import { createObservation, listObservations } from '@/storage/observations';
import { makeTestDb } from './sqliteTestDb';
import type {
  DateRange,
  RawDailyStepSample,
  RawSleepSample,
  RawWorkout,
  WearableSource,
} from '@/lib/wearable';
import { todayLocalDate, addDays, deviceTz } from '@/lib/date';
import type { Observation } from '@core/observation';

function makeFakeWorkouts(): RawWorkout[] {
  // Two same-day workouts (normal for a river day: morning lap, evening surf)
  // + a pool swim the day before. All inside the 7-day daily-poll window.
  const day = (offset: number, hour: number) =>
    new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10) +
    `T${String(hour).padStart(2, '0')}:00:00.000Z`;
  return [
    {
      uuid: 'hk-kayak-am',
      hkActivityType: 31,
      startUtc: day(1, 9),
      endUtc: day(1, 10),
      durationS: 3600,
      distanceM: 6400,
      sourceBundleId: 'com.apple.health',
      sourceName: 'Apple Watch',
    },
    {
      uuid: 'hk-surf-pm',
      hkActivityType: 45,
      startUtc: day(1, 17),
      endUtc: day(1, 18),
      durationS: 3600,
      sourceBundleId: 'com.apple.health',
      sourceName: 'Apple Watch',
    },
    {
      uuid: 'hk-swim',
      hkActivityType: 46,
      startUtc: day(2, 7),
      endUtc: day(2, 8),
      durationS: 3600,
      distanceM: 914.4,
      sourceBundleId: 'com.apple.health',
      sourceName: 'Apple Watch',
      swim: {
        locationType: 'pool',
        lapLengthM: 22.86,
        lengths: [
          {
            startUtc: day(2, 7),
            endUtc: new Date(Date.parse(day(2, 7)) + 28_000).toISOString(),
            distanceM: 22.86,
            strokes: 18,
            hkStrokeStyle: 2,
          },
        ],
      },
    },
  ];
}

function makeFakeReader(workouts: RawWorkout[] = []): WearableSource {
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
    async readActivities(_range: DateRange) {
      return workouts;
    },
  };
}

/** A hand-logged session, to prove ingested workouts land beside it. */
function manualSession(): Observation {
  return {
    id: '01900000-0000-7000-8000-000000000001',
    kind: 'session',
    occurredAt: new Date(Date.now() - 86_400_000).toISOString(),
    loggedAt: new Date().toISOString(),
    tz: deviceTz(),
    tier: 1,
    fidelity: 0.7,
    source: { type: 'manual' },
    payload: {
      kind: 'session',
      modality: 'paddle',
      activity: 'kayak',
      durationMin: 45,
      endurance: { energySystem: 'aerobic' },
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
    expect(poll.workoutsInserted).toBe(0);
  });
});

describe('healthkit workout ingest', () => {
  it('workouts land as session observations beside manual sessions', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await createObservation(manualSession(), db);

    const reader = makeFakeReader(makeFakeWorkouts());
    const result = await runBackfill(reader, db);
    expect(result.workoutsInserted).toBe(3);

    const sessions = await listObservations({ kinds: ['session'] }, db);
    expect(sessions).toHaveLength(4); // 1 manual + 3 ingested

    const ingested = sessions.filter((o) => o.source.type === 'healthkit');
    expect(ingested).toHaveLength(3);
    for (const o of ingested) {
      expect(o.source).toMatchObject({ type: 'healthkit', rawType: 'HKWorkout' });
      expect(o.tier).toBe(1);
      expect(o.fidelity).toBe(0.95);
      if (o.payload.kind === 'session') {
        expect(o.payload.durationMin).toBe(60);
      }
    }
    // The manual session is untouched.
    expect(sessions.filter((o) => o.source.type === 'manual')).toHaveLength(1);
  });

  it('the pool swim carries its per-length data through to the payload', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const reader = makeFakeReader(makeFakeWorkouts());
    await runBackfill(reader, db);

    const sessions = await listObservations({ kinds: ['session'] }, db);
    const swim = sessions.find(
      (o) => o.source.type === 'healthkit' && o.source.workoutUuid === 'hk-swim'
    );
    expect(swim).toBeDefined();
    if (swim?.payload.kind === 'session') {
      expect(swim.payload.activity).toBe('swim');
      expect(swim.payload.swimming?.poolLengthM).toBeCloseTo(22.86, 5);
      expect(swim.payload.swimming?.laps).toBe(1);
      expect(swim.payload.swimming?.lengths?.[0].stroke).toBe('freestyle');
    }
  });

  it('UUID dedup: two same-day workouts both insert, a re-import inserts zero', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const reader = makeFakeReader(makeFakeWorkouts());

    const first = await runBackfill(reader, db);
    // hk-kayak-am and hk-surf-pm share a civil day — UUID keying admits both.
    expect(first.workoutsInserted).toBe(3);

    const again = await runBackfill(reader, db);
    expect(again.workoutsInserted).toBe(0);

    const poll = await runDailyPoll(reader, db);
    expect(poll.workoutsInserted).toBe(0);

    const sessions = await listObservations({ kinds: ['session'] }, db);
    expect(sessions).toHaveLength(3);
    const uuids = sessions
      .map((o) => (o.source.type === 'healthkit' ? o.source.workoutUuid : undefined))
      .sort();
    expect(uuids).toEqual(['hk-kayak-am', 'hk-surf-pm', 'hk-swim']);
  });
});
