/**
 * hevyImport.test.ts — Hevy CSV import, against the real fixture
 * (__fixtures__/strong-csv/hevy-sample.csv).
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseHevyCsv } from '../hevyImport';

const FX = join(__dirname, '..', '__fixtures__', 'strong-csv');
const HEVY_SAMPLE = readFileSync(join(FX, 'hevy-sample.csv'), 'utf8');

describe('parseHevyCsv', () => {
  it('groups all rows into a single session (one title/start_time)', () => {
    const r = parseHevyCsv(HEVY_SAMPLE);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].workoutName).toBe('Push Day');
  });

  it('derives duration from start_time/end_time (70 minutes)', () => {
    const r = parseHevyCsv(HEVY_SAMPLE);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.sessions[0].durationMin).toBe(70);
  });

  it('detects weight_kg column — no confirm needed', () => {
    const r = parseHevyCsv(HEVY_SAMPLE);
    if (r.status !== 'ok') throw new Error('expected ok');
    const bench = r.sessions[0].sets.find((s) => s.exercise === 'Bench Press (Barbell)' && !s.isWarmup && s.reps === 5);
    expect(bench?.weightKg).toBe(100);
  });

  it('set_type "warmup" becomes isWarmup; "failure" becomes a marked working set', () => {
    const r = parseHevyCsv(HEVY_SAMPLE);
    if (r.status !== 'ok') throw new Error('expected ok');
    const benchSets = r.sessions[0].sets.filter((s) => s.exercise === 'Bench Press (Barbell)');
    expect(benchSets.find((s) => s.isWarmup)).toBeDefined();
    expect(benchSets.find((s) => s.marker === 'Failure set')).toBeDefined();
  });

  it('a duration_seconds-only row (Plank) becomes a hold set', () => {
    const r = parseHevyCsv(HEVY_SAMPLE);
    if (r.status !== 'ok') throw new Error('expected ok');
    const plank = r.sessions[0].sets.find((s) => s.exercise === 'Plank')!;
    expect(plank.holdSec).toBe(60);
    expect(plank.reps).toBe(0);
  });

  it('RPE converts to rir = 10 - RPE', () => {
    const r = parseHevyCsv(HEVY_SAMPLE);
    if (r.status !== 'ok') throw new Error('expected ok');
    const withRpe = r.sessions[0].sets.find((s) => s.rir === 0.5); // rpe 9.5
    expect(withRpe).toBeDefined();
  });

  it('imports every non-cardio row, superset_id dropped (not read at all, v1)', () => {
    const r = parseHevyCsv(HEVY_SAMPLE);
    if (r.status !== 'ok') throw new Error('expected ok');
    // 6 data rows in the fixture, none cardio/all-zero.
    expect(r.report.setsImported).toBe(6);
  });

  it('a header missing title/start_time/exercise_title is a clear error', () => {
    const r = parseHevyCsv('foo,bar\n1,2\n');
    expect(r.status).toBe('header-error');
  });

  it('three identical "normal" working sets on the same lift get three distinct row keys', () => {
    const csv =
      '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"\n' +
      '"Push Day","29 Jun 2026, 07:12","29 Jun 2026, 08:22","","Squat (Barbell)",,"",0,"normal",100,5,,0,\n' +
      '"Push Day","29 Jun 2026, 07:12","29 Jun 2026, 08:22","","Squat (Barbell)",,"",1,"normal",100,5,,0,\n' +
      '"Push Day","29 Jun 2026, 07:12","29 Jun 2026, 08:22","","Squat (Barbell)",,"",2,"normal",100,5,,0,\n';
    const r = parseHevyCsv(csv);
    if (r.status !== 'ok') throw new Error('expected ok');
    const keys = r.sessions[0].sets.map((s) => s.rowKey);
    expect(new Set(keys).size).toBe(3);
  });

  it('an out-of-range RPE is dropped rather than producing a nonsensical rir', () => {
    const csv =
      '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"\n' +
      '"Push Day","29 Jun 2026, 07:12","29 Jun 2026, 08:22","","Squat (Barbell)",,"",0,"normal",100,5,,0,15\n';
    const r = parseHevyCsv(csv);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.sessions[0].sets[0].rir).toBeUndefined();
    expect(r.report.rirDerivedFromRpeCount).toBe(0);
  });
});
