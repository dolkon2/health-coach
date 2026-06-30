/**
 * Pure form-logic tests for Structured benchmark entry (Phase 5 Pass 2).
 *
 * No DB, no React — exercises the form → Benchmark builder, validation, the
 * edit-mode hydrate, and the one-line summary. The load-bearing assertion: the
 * FAMILY is derived from what's filled (an activity + count ⇒ cadence; bodyweight
 * + direction ⇒ trend), never picked.
 */
import { describe, it, expect } from '@jest/globals';
import type { Benchmark } from '@core/benchmark';
import {
  emptyBenchmarkForm,
  familyOf,
  buildBenchmarkFields,
  validateBenchmarkForm,
  formFromBenchmark,
  summarizeBenchmark,
  type BenchmarkForm,
} from '../benchmarkForm';

function cadenceForm(over: Partial<BenchmarkForm> = {}): BenchmarkForm {
  return {
    ...emptyBenchmarkForm(),
    dimension: { kind: 'activity', activityId: 'paddle' },
    count: '4',
    window: 'week',
    ...over,
  };
}

function trendForm(over: Partial<BenchmarkForm> = {}): BenchmarkForm {
  return {
    ...emptyBenchmarkForm(),
    dimension: { kind: 'bodyweight' },
    direction: 'down',
    ...over,
  };
}

function bench(fields: Pick<Benchmark, 'resolution' | 'shape' | 'title'>): Benchmark {
  return {
    id: 'b1',
    createdAt: '2026-06-29T00:00:00Z',
    status: 'active',
    pinned: true,
    ...fields,
  };
}

describe('benchmarkForm', () => {
  it('derives the family from the dimension, never picks it', () => {
    expect(familyOf({ kind: 'activity', activityId: 'run' })).toBe('cadence');
    expect(familyOf({ kind: 'bodyweight' })).toBe('trend');
  });

  it('builds a cadence benchmark from activity + count + window', () => {
    const { resolution, shape, title } = buildBenchmarkFields(cadenceForm(), 'kg');
    expect(resolution).toEqual({ metric: 'sessionCount', activity: 'paddle', modality: 'paddle' });
    expect(shape).toEqual({ family: 'cadence', window: 'week', measure: { type: 'count', target: 4 } });
    expect(title).toBe('Paddle 4×/week');
  });

  it('builds a trend benchmark from bodyweight + direction + target (stored in kg)', () => {
    const { resolution, shape, title } = buildBenchmarkFields(trendForm({ target: '75' }), 'kg');
    expect(resolution).toEqual({ metric: 'bodyweight' });
    expect(shape).toEqual({ family: 'trend', direction: 'down', target: 75 });
    expect(title).toBe('Lose weight → 75.0 kg');
  });

  it('omits the trend target when blank (pure trend)', () => {
    const { shape, title } = buildBenchmarkFields(trendForm(), 'kg');
    expect(shape).toEqual({ family: 'trend', direction: 'down' });
    expect('target' in shape).toBe(false);
    expect(title).toBe('Lose weight');
  });

  it('converts a lb target to kg', () => {
    const { shape } = buildBenchmarkFields(trendForm({ target: '165' }), 'lb');
    if (shape.family !== 'trend') throw new Error('expected trend');
    expect(shape.target).toBeCloseTo(74.8, 1);
  });

  it('honours a user-typed title over the default', () => {
    const { title } = buildBenchmarkFields(cadenceForm({ title: 'Get on the water' }), 'kg');
    expect(title).toBe('Get on the water');
  });

  it('validates dimension, cadence count, and the optional trend target', () => {
    expect(validateBenchmarkForm(emptyBenchmarkForm())).toMatch(/pick something/i);
    expect(validateBenchmarkForm(cadenceForm({ count: '' }))).toMatch(/how many/i);
    expect(validateBenchmarkForm(cadenceForm({ count: '0' }))).toMatch(/how many/i);
    expect(validateBenchmarkForm(cadenceForm())).toBeNull();
    expect(validateBenchmarkForm(trendForm())).toBeNull(); // blank target is fine
    expect(validateBenchmarkForm(trendForm({ target: 'abc' }))).toMatch(/target weight/i);
    expect(validateBenchmarkForm(trendForm({ target: '80' }))).toBeNull();
  });

  it('round-trips a cadence benchmark through formFromBenchmark → buildBenchmarkFields', () => {
    const fields = buildBenchmarkFields(cadenceForm({ count: '3', window: 'month' }), 'kg');
    const form = formFromBenchmark(bench(fields), 'kg');
    expect(form.dimension).toEqual({ kind: 'activity', activityId: 'paddle' });
    expect(form.count).toBe('3');
    expect(form.window).toBe('month');
    expect(buildBenchmarkFields(form, 'kg')).toEqual(fields);
  });

  it('round-trips a trend benchmark with a lb target through the form', () => {
    const fields = buildBenchmarkFields(trendForm({ target: '180', direction: 'up' }), 'lb');
    const form = formFromBenchmark(bench(fields), 'lb');
    expect(form.dimension).toEqual({ kind: 'bodyweight' });
    expect(form.direction).toBe('up');
    expect(parseFloat(form.target)).toBeCloseTo(180, 0);
  });

  it('summarizes cadence and trend benchmarks', () => {
    const cad = bench(buildBenchmarkFields(cadenceForm({ count: '4' }), 'kg'));
    expect(summarizeBenchmark(cad, 'kg')).toBe('Paddle · 4×/week');

    const trendT = bench(buildBenchmarkFields(trendForm({ target: '75' }), 'kg'));
    expect(summarizeBenchmark(trendT, 'kg')).toBe('Bodyweight · down to 75.0 kg');

    const trendPure = bench(buildBenchmarkFields(trendForm(), 'kg'));
    expect(summarizeBenchmark(trendPure, 'kg')).toBe('Bodyweight · trending down');
  });
});
