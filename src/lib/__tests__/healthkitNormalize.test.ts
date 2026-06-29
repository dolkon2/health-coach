/**
 * normalizer tests — pure TS, no native imports.
 *
 * Covers the four claims the spec rests on:
 *   1. source precedence picks wearable over phone, alphabetical fallback;
 *   2. sleep attributes to the WAKE day (the civil day endUtc lands in);
 *   3. inBed + awake samples don't inflate the tier-1 duration;
 *   4. normalizing the same input twice produces the same set of Observations
 *      (after stripping ids/loggedAt) — idempotency is structural.
 */
import { describe, it, expect } from '@jest/globals';
import {
  normalizeSteps,
  normalizeSleep,
  isAlreadyImported,
} from '@/lib/healthkit/normalize';
import { pickAuthoritativeSource, rankSource } from '@/lib/healthkit/sourcePrecedence';
import type {
  RawDailyStepSample,
  RawSleepSample,
  RawSleepStage,
} from '@/lib/wearable';
import type { Observation } from '@core/observation';

const ctx = { tz: 'America/Los_Angeles', nowUtc: '2026-06-28T18:00:00.000Z' } as const;

// ─── Source precedence ──────────────────────────────────────────────────────

describe('sourcePrecedence', () => {
  it('ranks Garmin and Apple Watch above iPhone pedometer', () => {
    expect(rankSource('com.garmin.connect.mobile')).toBeLessThan(
      rankSource('com.apple.Health')
    );
    expect(rankSource('com.apple.health')).toBeLessThan(rankSource('com.apple.Health'));
  });

  it('falls back to alphabetical within a tier for determinism', () => {
    const picked = pickAuthoritativeSource([
      { sourceBundleId: 'com.zzz.app', sourceName: 'Zzz' },
      { sourceBundleId: 'com.aaa.app', sourceName: 'Aaa' },
    ]);
    expect(picked?.sourceBundleId).toBe('com.aaa.app');
  });

  it('picks Garmin over iPhone when both wrote the same day', () => {
    const picked = pickAuthoritativeSource([
      { sourceBundleId: 'com.apple.Health', sourceName: "Dylan's iPhone" },
      { sourceBundleId: 'com.garmin.connect.mobile', sourceName: 'Garmin Connect' },
    ]);
    expect(picked?.sourceBundleId).toBe('com.garmin.connect.mobile');
  });
});

// ─── Steps normalization ────────────────────────────────────────────────────

describe('normalizeSteps', () => {
  it('emits one observation per day from the authoritative source — never sums', () => {
    const raw: RawDailyStepSample[] = [
      {
        date: '2026-06-27',
        count: 8000,
        sourceBundleId: 'com.apple.Health',
        sourceName: "Dylan's iPhone",
      },
      {
        date: '2026-06-27',
        count: 8432,
        sourceBundleId: 'com.garmin.connect.mobile',
        sourceName: 'Garmin Connect',
      },
    ];

    const obs = normalizeSteps(raw, ctx);

    expect(obs).toHaveLength(1);
    expect(obs[0].payload.count).toBe(8432); // Garmin, not sum (16,432) or iPhone (8000)
    expect(obs[0].tier).toBe(1);
    expect(obs[0].fidelity).toBeCloseTo(0.9);
    expect(obs[0].source).toEqual({
      type: 'healthkit',
      rawType: 'HKQuantityTypeIdentifierStepCount',
    });
  });

  it('drops zero-count rows', () => {
    const raw: RawDailyStepSample[] = [
      {
        date: '2026-06-27',
        count: 0,
        sourceBundleId: 'com.garmin.connect.mobile',
        sourceName: 'Garmin Connect',
      },
    ];
    expect(normalizeSteps(raw, ctx)).toHaveLength(0);
  });

  it('emits one observation per distinct day', () => {
    const raw: RawDailyStepSample[] = [
      {
        date: '2026-06-27',
        count: 8000,
        sourceBundleId: 'com.garmin.connect.mobile',
        sourceName: 'Garmin',
      },
      {
        date: '2026-06-26',
        count: 6000,
        sourceBundleId: 'com.garmin.connect.mobile',
        sourceName: 'Garmin',
      },
    ];
    const obs = normalizeSteps(raw, ctx);
    expect(obs).toHaveLength(2);
    // sorted ascending by occurredAt
    expect(obs[0].occurredAt < obs[1].occurredAt).toBe(true);
  });
});

// ─── Sleep normalization ────────────────────────────────────────────────────

function sleepSample(
  startUtc: string,
  endUtc: string,
  stage: RawSleepStage,
  bundle = 'com.garmin.connect.mobile',
  name = 'Garmin Connect'
): RawSleepSample {
  return {
    startUtc,
    endUtc,
    stage,
    sourceBundleId: bundle,
    sourceName: name,
    tz: 'America/Los_Angeles',
  };
}

describe('normalizeSleep', () => {
  it('attributes a sleep window starting before midnight to the WAKE day', () => {
    // Sleep from 23:00 PT 2026-06-26 to 07:00 PT 2026-06-27 (UTC offset -7 in June)
    // → wake day is 2026-06-27.
    const raw: RawSleepSample[] = [
      sleepSample('2026-06-27T06:00:00.000Z', '2026-06-27T14:00:00.000Z', 'asleepUnspecified'),
    ];
    const obs = normalizeSleep(raw, ctx);
    expect(obs).toHaveLength(1);
    // 23:59 local on 2026-06-27 in PT → 2026-06-28T06:59:59.999Z
    expect(obs[0].occurredAt.startsWith('2026-06-28T06:59:59')).toBe(true);
    expect(obs[0].payload.durationMin).toBe(480); // 8h
  });

  it('ignores inBed and awake samples for tier-1 duration', () => {
    // 8h in bed, of which 7h is mixed asleep stages and 1h awake.
    const raw: RawSleepSample[] = [
      sleepSample('2026-06-27T06:00:00.000Z', '2026-06-27T14:00:00.000Z', 'inBed'),
      sleepSample('2026-06-27T06:30:00.000Z', '2026-06-27T10:00:00.000Z', 'asleepCore'),
      sleepSample('2026-06-27T10:00:00.000Z', '2026-06-27T11:00:00.000Z', 'awake'),
      sleepSample('2026-06-27T11:00:00.000Z', '2026-06-27T12:30:00.000Z', 'asleepDeep'),
      sleepSample('2026-06-27T12:30:00.000Z', '2026-06-27T14:00:00.000Z', 'asleepREM'),
    ];
    const obs = normalizeSleep(raw, ctx);
    expect(obs).toHaveLength(1);
    // 3.5h core + 1.5h deep + 1.5h REM = 6.5h; the 1h awake and the 8h inBed
    // are excluded, and the initial 06:00 → 06:30 fall-asleep gap isn't covered
    // by any asleep* sample.
    expect(obs[0].payload.durationMin).toBe(390);
    expect(obs[0].payload.stages).toEqual({
      deepMin: 90,
      remMin: 90,
      lightMin: 210, // 3.5h core
      awakeMin: 60,
    });
  });

  it('picks one source per night when multiple wrote the same window', () => {
    const raw: RawSleepSample[] = [
      // Garmin says 7h
      sleepSample(
        '2026-06-27T06:00:00.000Z',
        '2026-06-27T13:00:00.000Z',
        'asleepUnspecified',
        'com.garmin.connect.mobile',
        'Garmin'
      ),
      // iPhone says 6h
      sleepSample(
        '2026-06-27T06:00:00.000Z',
        '2026-06-27T12:00:00.000Z',
        'asleepUnspecified',
        'com.apple.Health',
        'iPhone'
      ),
    ];
    const obs = normalizeSleep(raw, ctx);
    expect(obs).toHaveLength(1);
    expect(obs[0].payload.durationMin).toBe(420); // Garmin's 7h wins
    expect(obs[0].payload.stages).toBeUndefined(); // unstaged "asleep" only
  });

  it('drops nights with no asleep* samples (only inBed/awake)', () => {
    const raw: RawSleepSample[] = [
      sleepSample('2026-06-27T06:00:00.000Z', '2026-06-27T14:00:00.000Z', 'inBed'),
      sleepSample('2026-06-27T07:00:00.000Z', '2026-06-27T07:30:00.000Z', 'awake'),
    ];
    expect(normalizeSleep(raw, ctx)).toHaveLength(0);
  });
});

// ─── Idempotency / dedup ────────────────────────────────────────────────────

describe('isAlreadyImported', () => {
  it('matches by kind + civil day + healthkit source', () => {
    const raw: RawDailyStepSample[] = [
      {
        date: '2026-06-27',
        count: 8000,
        sourceBundleId: 'com.garmin.connect.mobile',
        sourceName: 'Garmin',
      },
    ];
    const obs = normalizeSteps(raw, ctx);
    const existing: Observation[] = [obs[0]]; // pretend we already inserted it

    expect(isAlreadyImported(existing, obs[0])).toBe(true);

    // A fresh normalize of the same raw data must register as already-imported.
    const reNormalized = normalizeSteps(raw, ctx);
    expect(isAlreadyImported(existing, reNormalized[0])).toBe(true);
  });

  it('does not match across different kinds or non-healthkit sources', () => {
    const stepsObs = normalizeSteps(
      [
        {
          date: '2026-06-27',
          count: 8000,
          sourceBundleId: 'com.garmin.connect.mobile',
          sourceName: 'Garmin',
        },
      ],
      ctx
    )[0];

    const manualSession: Observation = {
      id: 'm1',
      kind: 'session',
      occurredAt: stepsObs.occurredAt,
      loggedAt: stepsObs.loggedAt,
      tz: stepsObs.tz,
      tier: 1,
      fidelity: 1,
      source: { type: 'manual' },
      payload: { kind: 'session', modality: 'run', durationMin: 30 },
    };

    expect(isAlreadyImported([manualSession], stepsObs)).toBe(false);
  });
});
