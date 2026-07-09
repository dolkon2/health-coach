/**
 * strongImport.test.ts — Strong CSV import, against the real fixtures
 * (__fixtures__/strong-csv/, both variants). Behavior spec-checked line by
 * line against format-spec.md.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseStrongCsv, heuristicWeightUnit } from '../strongImport';

const FX = join(__dirname, '..', '__fixtures__', 'strong-csv');
const SAMPLES_A = readFileSync(join(FX, 'samples.csv'), 'utf8');
const SAMPLES_B = readFileSync(join(FX, 'samples-variant-b-android.csv'), 'utf8');

describe('parseStrongCsv — Variant A (classic, no unit columns)', () => {
  it('requests a unit confirm before parsing weights (never silent)', () => {
    const r = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg' });
    expect(r.status).toBe('needs-unit-confirm');
  });

  it('the heuristic prefill is a real unit, not a guess presented as fact', () => {
    const r = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg' });
    if (r.status !== 'needs-unit-confirm') throw new Error('expected needs-unit-confirm');
    expect(['kg', 'lb']).toContain(r.weightUnitHeuristic);
  });

  it('groups rows into two sessions (Push Day, Pull Day) once confirmed', () => {
    const first = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg' });
    if (first.status !== 'needs-unit-confirm') throw new Error('expected needs-unit-confirm');
    const r = first.parse('kg');
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions.map((s) => s.workoutName).sort()).toEqual(['Pull Day', 'Push Day']);
  });

  it('parses durations ("1h 10m", "45m")', () => {
    const first = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (first.status !== 'ok') throw new Error('expected ok');
    const push = first.sessions.find((s) => s.workoutName === 'Push Day')!;
    const pull = first.sessions.find((s) => s.workoutName === 'Pull Day')!;
    expect(push.durationMin).toBe(70);
    expect(pull.durationMin).toBe(45);
  });

  it('Set Order "W" becomes isWarmup; "F"/"D" become working sets with a marker', () => {
    const r = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const push = r.sessions.find((s) => s.workoutName === 'Push Day')!;
    const bench = push.sets.filter((s) => s.exercise === 'Bench Press (Barbell)');
    expect(bench[0].isWarmup).toBe(true);
    const failureSet = bench.find((s) => s.marker === 'Failure set');
    expect(failureSet).toBeDefined();
    expect(failureSet!.isWarmup).toBeUndefined();
    const pull = r.sessions.find((s) => s.workoutName === 'Pull Day')!;
    const dropSet = pull.sets.find((s) => s.marker === 'Drop set');
    expect(dropSet).toBeDefined();
  });

  it('RPE converts to rir = 10 - RPE', () => {
    const r = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const push = r.sessions.find((s) => s.workoutName === 'Push Day')!;
    const rpe85 = push.sets.find((s) => s.rir != null && s.weightKg === 100 && s.reps === 5 && s.marker == null);
    // the RPE 8.5 set specifically (row 3): rir = 10 - 8.5 = 1.5
    const withRpe85 = push.sets.find((s) => s.rir === 1.5);
    expect(withRpe85).toBeDefined();
    void rpe85;
  });

  it('a plank (Seconds only, Reps 0) becomes a hold set', () => {
    const r = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const push = r.sessions.find((s) => s.workoutName === 'Push Day')!;
    const plank = push.sets.find((s) => s.exercise === 'Plank')!;
    expect(plank.holdSec).toBe(60);
    expect(plank.reps).toBe(0);
  });

  it('a cardio-in-workout row (Distance > 0) is skipped and reported', () => {
    const r = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.report.cardioSkipped).toBe(1);
    const pull = r.sessions.find((s) => s.workoutName === 'Pull Day')!;
    expect(pull.sets.some((s) => s.exercise === 'Running')).toBe(false);
  });

  it('bodyweight sets (Weight 0.0, Reps > 0) keep weightKg: 0, never dropped', () => {
    const r = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const push = r.sessions.find((s) => s.workoutName === 'Push Day')!;
    const pushup = push.sets.find((s) => s.exercise === 'Push Up')!;
    expect(pushup.weightKg).toBe(0);
    expect(pushup.reps).toBe(20);
  });

  it('applies the confirmed weight unit conversion (lb -> kg)', () => {
    const r = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg', weightUnit: 'lb' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const push = r.sessions.find((s) => s.workoutName === 'Push Day')!;
    const benchWorking = push.sets.find(
      (s) => s.exercise === 'Bench Press (Barbell)' && !s.isWarmup && s.reps === 5
    );
    // 100 lb -> ~45.36 kg (vs 100 kg if parsed as kg)
    expect(benchWorking?.weightKg).toBeCloseTo(45.359, 2);
  });

  it('total sets imported excludes the skipped cardio row', () => {
    const r = parseStrongCsv(SAMPLES_A, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    // 10 data rows in the fixture, 1 cardio row skipped -> 9 sets imported.
    expect(r.report.setsImported).toBe(9);
  });
});

describe('parseStrongCsv — Variant B (unit-columns, semicolon)', () => {
  it('detects the semicolon delimiter and unit columns — no confirm needed', () => {
    const r = parseStrongCsv(SAMPLES_B, { appDefaultWeightUnit: 'kg' });
    expect(r.status).toBe('ok');
  });

  it('trusts per-row Weight Unit, converting lbs rows to kg', () => {
    const r = parseStrongCsv(SAMPLES_B, { appDefaultWeightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const push = r.sessions.find((s) => s.workoutName === 'Push Day')!;
    const incline = push.sets.find((s) => s.exercise === 'Incline Bench Press (Dumbbell)')!;
    // 80 lb -> ~36.29 kg
    expect(incline.weightKg).toBeCloseTo(36.287, 2);
    const bench = push.sets.find((s) => s.exercise === 'Bench Press (Barbell)')!;
    expect(bench.weightKg).toBe(100); // already kg
  });

  it('a cardio row (Running) is skipped even in variant B', () => {
    const r = parseStrongCsv(SAMPLES_B, { appDefaultWeightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.report.cardioSkipped).toBe(1);
  });
});

describe('parseStrongCsv — localized headers', () => {
  it('a file with no English date/exercise headers returns a clear error, never a positional guess', () => {
    const german = 'Datum;Workout-Name;Name der Übung;Gewicht;Wiederh.\n2026-01-01 08:00:00;Push;Bankdrücken;100;5\n';
    const r = parseStrongCsv(german, { appDefaultWeightUnit: 'kg' });
    expect(r.status).toBe('localized-header-error');
  });
});

describe('heuristicWeightUnit', () => {
  it('flags any weight >= 250 as lb', () => {
    expect(heuristicWeightUnit([100, 260], 'kg')).toBe('lb');
  });

  it('falls back to the app default when weights are ambiguous', () => {
    expect(heuristicWeightUnit([], 'lb')).toBe('lb');
  });
});

describe('dedupe keys — repeated identical sets never collide', () => {
  it('three identical "100kg x5" working sets get three distinct row keys', () => {
    const csv =
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n' +
      '2026-06-29 07:12:41,"Push Day",45m,"Squat (Barbell)",1,100.0,5,0,0,,,\n' +
      '2026-06-29 07:12:41,"Push Day",45m,"Squat (Barbell)",2,100.0,5,0,0,,,\n' +
      '2026-06-29 07:12:41,"Push Day",45m,"Squat (Barbell)",3,100.0,5,0,0,,,\n';
    const r = parseStrongCsv(csv, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const keys = r.sessions[0].sets.map((s) => s.rowKey);
    expect(new Set(keys).size).toBe(3);
  });

  it('two identical warm-up ("W") rows on the same exercise get distinct row keys', () => {
    const csv =
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n' +
      '2026-06-29 07:12:41,"Push Day",45m,"Squat (Barbell)",W,40.0,10,0,0,,,\n' +
      '2026-06-29 07:12:41,"Push Day",45m,"Squat (Barbell)",W,40.0,10,0,0,,,\n';
    const r = parseStrongCsv(csv, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const keys = r.sessions[0].sets.map((s) => s.rowKey);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('RPE clamping', () => {
  it('an out-of-range RPE is dropped rather than producing a nonsensical rir', () => {
    const csv =
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n' +
      '2026-06-29 07:12:41,"Push Day",45m,"Squat (Barbell)",1,100.0,5,0,0,,,15\n';
    const r = parseStrongCsv(csv, { appDefaultWeightUnit: 'kg', weightUnit: 'kg' });
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.sessions[0].sets[0].rir).toBeUndefined();
    expect(r.report.rirDerivedFromRpeCount).toBe(0);
  });
});

describe('Variant B unit fallback', () => {
  it('a blank Weight Unit cell falls back to the app default, never a silent kg guess', () => {
    const csv =
      'Date;Workout Name;Exercise Name;Set Order;Weight;Weight Unit;Reps;RPE;Distance;Distance Unit;Seconds;Notes;Workout Notes;Workout Duration\n' +
      '2026-06-29 07:12:41;Push Day;Squat (Barbell);1;100.0;;5;;0;km;0;;;45m\n';
    const r = parseStrongCsv(csv, { appDefaultWeightUnit: 'lb' });
    if (r.status !== 'ok') throw new Error('expected ok');
    // 100 in the app's lb default -> ~45.36 kg, NOT 100 (which a silent kg guess would produce).
    expect(r.sessions[0].sets[0].weightKg).toBeCloseTo(45.359, 2);
  });
});
