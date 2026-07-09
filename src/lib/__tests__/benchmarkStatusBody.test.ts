/**
 * benchmarkStatusBody.test.ts — Body P6's four benchmark dimensions:
 * exerciseLoad, breathRetention, romMeasurement (outcome faces) and
 * protocolAdherence (behavior face).
 */
import { describe, it, expect } from '@jest/globals';
import type { OutcomeFace } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import { outcomeStatus, outcomeLine, protocolAdherenceStatus, behaviorLine } from '@/lib/benchmarkStatus';

let n = 0;
function liftingSession(
  occurredAt: string,
  sets: Array<{ exercise: string; exerciseId?: string; weightKg: number; reps: number }>
): ObservationOf<'session'> {
  n += 1;
  return {
    id: `s${n}`,
    kind: 'session',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'UTC',
    tier: 1,
    fidelity: 0.95,
    source: { type: 'manual' },
    payload: {
      kind: 'session',
      modality: 'gym',
      lifting: {
        sets: sets.map((s) => ({
          exercise: s.exercise,
          ...(s.exerciseId ? { exerciseId: s.exerciseId } : {}),
          movementPattern: 'upper-push',
          weightKg: s.weightKg,
          reps: s.reps,
        })),
      },
    },
  };
}

function breathworkSession(
  occurredAt: string,
  rounds: Array<{ retentionSeconds: number }>
): ObservationOf<'session'> {
  n += 1;
  return {
    id: `b${n}`,
    kind: 'session',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'UTC',
    tier: 1,
    fidelity: 0.95,
    source: { type: 'manual' },
    payload: { kind: 'session', modality: 'mobility', activity: 'breathwork', breathwork: { rounds } },
  };
}

function romObs(occurredAt: string, testId: string, value: number, side?: 'left' | 'right'): ObservationOf<'romReading'> {
  n += 1;
  return {
    id: `r${n}`,
    kind: 'romReading',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'UTC',
    tier: 1,
    fidelity: 0.95,
    source: { type: 'manual' },
    payload: { kind: 'romReading', testId, value, unit: 'cm', ...(side ? { side } : {}) },
  };
}

describe('outcomeStatus — exerciseLoad', () => {
  const face: OutcomeFace = {
    dimension: { metric: 'exerciseLoad', exerciseId: 'Barbell_Bench_Press', exercise: 'Bench Press' },
    direction: 'up',
    target: 100,
  };

  it('reads the latest e1RM for the matching exercise (by exerciseId)', () => {
    const sessions = [
      liftingSession('2026-01-01T10:00:00.000Z', [
        { exercise: 'Bench Press', exerciseId: 'Barbell_Bench_Press', weightKg: 90, reps: 5 },
      ]),
      liftingSession('2026-01-08T10:00:00.000Z', [
        { exercise: 'Bench Press', exerciseId: 'Barbell_Bench_Press', weightKg: 95, reps: 5 },
      ]),
    ];
    const status = outcomeStatus(face, [], null, sessions);
    expect(status.kind).toBe('exerciseLoad');
    if (status.kind !== 'exerciseLoad') throw new Error('expected exerciseLoad');
    expect(status.latestE1rmKg).toBeCloseTo(95 * (1 + 5 / 30), 6);
    expect(status.toTargetKg).toBeCloseTo(status.latestE1rmKg - 100, 6);
  });

  it('ignores sets from a different exercise entirely', () => {
    const sessions = [
      liftingSession('2026-01-01T10:00:00.000Z', [
        { exercise: 'Squat', exerciseId: 'Barbell_Squat', weightKg: 140, reps: 5 },
      ]),
    ];
    const status = outcomeStatus(face, [], null, sessions);
    expect(status.kind).toBe('noData');
  });

  it('degrades to noData with no fabricated number when never logged', () => {
    const status = outcomeStatus(face, [], null, []);
    expect(status).toEqual({ kind: 'noData', what: 'exerciseLoad' });
    expect(outcomeLine(status, 'kg')).toMatch(/no working sets/);
  });

  it('matches by normalized name when no exerciseId is set on the dimension', () => {
    const nameFace: OutcomeFace = {
      dimension: { metric: 'exerciseLoad', exercise: 'Overhead Press' },
      direction: 'up',
    };
    const sessions = [
      liftingSession('2026-01-01T10:00:00.000Z', [
        { exercise: 'overhead press', weightKg: 50, reps: 5 }, // different casing, no id
      ]),
    ];
    const status = outcomeStatus(nameFace, [], null, sessions);
    expect(status.kind).toBe('exerciseLoad');
  });
});

describe('outcomeStatus — breathRetention', () => {
  it('"best" reports the max single hold across the window', () => {
    const face: OutcomeFace = { dimension: { metric: 'breathRetention', statistic: 'best' }, direction: 'up' };
    const sessions = [
      breathworkSession('2026-01-01T10:00:00.000Z', [{ retentionSeconds: 90 }, { retentionSeconds: 120 }]),
      breathworkSession('2026-01-08T10:00:00.000Z', [{ retentionSeconds: 100 }]),
    ];
    const status = outcomeStatus(face, [], null, sessions);
    expect(status).toMatchObject({ kind: 'breathRetention', seconds: 120, statistic: 'best' });
  });

  it('"average" reports the mean across every logged round', () => {
    const face: OutcomeFace = { dimension: { metric: 'breathRetention', statistic: 'average' }, direction: 'up' };
    const sessions = [breathworkSession('2026-01-01T10:00:00.000Z', [{ retentionSeconds: 60 }, { retentionSeconds: 120 }])];
    const status = outcomeStatus(face, [], null, sessions);
    expect(status).toMatchObject({ kind: 'breathRetention', seconds: 90 });
  });

  it('degrades to noData when no rounds are logged', () => {
    const face: OutcomeFace = { dimension: { metric: 'breathRetention', statistic: 'best' }, direction: 'up' };
    expect(outcomeStatus(face, [], null, [])).toEqual({ kind: 'noData', what: 'breathRetention' });
  });
});

describe('outcomeStatus — romMeasurement', () => {
  const face: OutcomeFace = {
    dimension: { metric: 'romMeasurement', testId: 'sit-and-reach' },
    direction: 'up',
    target: 20,
  };

  it('reads the most recent matching romReading', () => {
    const readings = [romObs('2026-01-01T10:00:00.000Z', 'sit-and-reach', 15), romObs('2026-01-08T10:00:00.000Z', 'sit-and-reach', 18)];
    const status = outcomeStatus(face, [], null, [], readings);
    expect(status).toMatchObject({ kind: 'romMeasurement', value: 18, unit: 'cm', targetValue: 20 });
  });

  it('a reading for a different test never counts', () => {
    const readings = [romObs('2026-01-01T10:00:00.000Z', 'wall-ankle-test', 5)];
    expect(outcomeStatus(face, [], null, [], readings)).toEqual({ kind: 'noData', what: 'romMeasurement' });
  });

  it('side matters: left and right are different measurements', () => {
    const sideFace: OutcomeFace = { dimension: { metric: 'romMeasurement', testId: 'shoulder-flex', side: 'left' }, direction: 'up' };
    const readings = [romObs('2026-01-01T10:00:00.000Z', 'shoulder-flex', 30, 'right')];
    expect(outcomeStatus(sideFace, [], null, [], readings)).toEqual({ kind: 'noData', what: 'romMeasurement' });
  });
});

describe('protocolAdherenceStatus', () => {
  it('averages capped per-exercise ratios, unweighted', () => {
    const protocol = {
      exercises: [
        { id: 'e1', name: 'Clamshells', targetPerWeek: 3 },
        { id: 'e2', name: 'Band walks', targetPerWeek: 2 },
      ],
    };
    // e1: 3/3 ticks -> ratio 1.0; e2: 1/2 -> ratio 0.5. Mean = 0.75.
    const status = protocolAdherenceStatus(protocol, { e1: 3, e2: 1 });
    expect(status).toEqual({ kind: 'adherence', pct: 75, exerciseCount: 2 });
  });

  it('caps an over-ticked exercise at 1.0 — it cannot lift the mean past 100%', () => {
    const protocol = { exercises: [{ id: 'e1', name: 'X', targetPerWeek: 2 }] };
    const status = protocolAdherenceStatus(protocol, { e1: 10 });
    expect(status).toEqual({ kind: 'adherence', pct: 100, exerciseCount: 1 });
  });

  it('an exercise with zero ticks contributes zero, not absence', () => {
    const protocol = { exercises: [{ id: 'e1', name: 'X', targetPerWeek: 2 }] };
    const status = protocolAdherenceStatus(protocol, {});
    expect(status).toEqual({ kind: 'adherence', pct: 0, exerciseCount: 1 });
  });

  it('a protocol with no exercises is null pct, never a fabricated number', () => {
    const status = protocolAdherenceStatus({ exercises: [] }, {});
    expect(status).toEqual({ kind: 'adherence', pct: null, exerciseCount: 0 });
    expect(behaviorLine(status)).toMatch(/no active exercises/);
  });
});
