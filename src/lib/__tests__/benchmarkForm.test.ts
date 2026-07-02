/**
 * Pure form-logic tests for Structured benchmark entry (v0.4 faces).
 *
 * No DB, no React — exercises the form → faces builder, validation, the
 * edit-mode hydrate, and the one-line summary. The load-bearing assertions:
 * the FACES are derived from what's filled (rhythm fields ⇒ behavior face,
 * direction fields ⇒ outcome face), never picked; each face carries its own
 * dimension; and pairing composes them without a type enum appearing anywhere.
 */
import { describe, it, expect } from '@jest/globals';
import type { Benchmark } from '@core/benchmark';
import {
  emptyBenchmarkForm,
  primaryFaceOf,
  buildBenchmarkFields,
  validateBenchmarkForm,
  formFromBenchmark,
  summarizeBenchmark,
  type BenchmarkForm,
} from '../benchmarkForm';

function behaviorForm(over: Partial<BenchmarkForm> = {}): BenchmarkForm {
  return {
    ...emptyBenchmarkForm(),
    dimension: { kind: 'activity', activityId: 'paddle' },
    count: '4',
    window: 'week',
    ...over,
  };
}

function outcomeForm(over: Partial<BenchmarkForm> = {}): BenchmarkForm {
  return {
    ...emptyBenchmarkForm(),
    dimension: { kind: 'bodyweight' },
    direction: 'down',
    ...over,
  };
}

function bench(fields: {
  behavior: Benchmark['behavior'];
  outcome: Benchmark['outcome'];
  title: string;
}): Benchmark {
  return {
    id: 'b1',
    createdAt: '2026-07-01T00:00:00Z',
    status: 'active',
    pinned: true,
    ...fields,
  };
}

describe('benchmarkForm', () => {
  it('derives the primary face from the dimension, never picks it', () => {
    expect(primaryFaceOf({ kind: 'activity', activityId: 'run' })).toBe('behavior');
    expect(primaryFaceOf({ kind: 'bodyweight' })).toBe('outcome');
  });

  it('builds a behavior-only benchmark from activity + count + window', () => {
    const { behavior, outcome, title } = buildBenchmarkFields(behaviorForm(), 'kg');
    expect(behavior).toEqual({
      dimension: { metric: 'sessionCount', activity: 'paddle', modality: 'paddle' },
      window: 'week',
      measure: { type: 'count', target: 4 },
    });
    expect(outcome).toBeUndefined();
    expect(title).toBe('Paddle 4×/week');
  });

  it('builds an outcome-only benchmark from bodyweight + direction + target (stored in kg)', () => {
    const { behavior, outcome, title } = buildBenchmarkFields(outcomeForm({ target: '75' }), 'kg');
    expect(behavior).toBeUndefined();
    expect(outcome).toEqual({
      dimension: { metric: 'bodyweight' },
      direction: 'down',
      target: 75,
    });
    expect(title).toBe('Lose weight → 75.0 kg');
  });

  it('omits the outcome target when blank (pure direction)', () => {
    const { outcome, title } = buildBenchmarkFields(outcomeForm(), 'kg');
    expect(outcome).toEqual({ dimension: { metric: 'bodyweight' }, direction: 'down' });
    expect('target' in outcome!).toBe(false);
    expect(title).toBe('Lose weight');
  });

  it('pairs an outcome onto an activity rhythm — two faces, two dimensions', () => {
    const form = behaviorForm({ secondFace: true, direction: 'down', target: '75' });
    const { behavior, outcome, title } = buildBenchmarkFields(form, 'kg');
    expect(behavior!.dimension).toEqual({
      metric: 'sessionCount',
      activity: 'paddle',
      modality: 'paddle',
    });
    expect(outcome).toEqual({ dimension: { metric: 'bodyweight' }, direction: 'down', target: 75 });
    expect(title).toBe('Paddle 4×/week, weight down');
  });

  it('pairs a behavior onto a bodyweight outcome — any session by default', () => {
    const form = outcomeForm({ secondFace: true, count: '4', target: '75' });
    const { behavior, outcome, title } = buildBenchmarkFields(form, 'kg');
    // No paired activity chosen ⇒ ANY logged session counts (bare sessionCount).
    expect(behavior).toEqual({
      dimension: { metric: 'sessionCount' },
      window: 'week',
      measure: { type: 'count', target: 4 },
    });
    expect(outcome!.target).toBe(75);
    expect(title).toBe('Lose weight → 75.0 kg, train 4×/week');
  });

  it('pairs a behavior narrowed to one activity', () => {
    const form = outcomeForm({ secondFace: true, count: '3', pairedActivityId: 'gym' });
    const { behavior } = buildBenchmarkFields(form, 'kg');
    expect(behavior!.dimension.metric).toBe('sessionCount');
    expect(behavior!.dimension).toMatchObject({ activity: 'gym' });
  });

  it('converts a lb target to kg', () => {
    const { outcome } = buildBenchmarkFields(outcomeForm({ target: '165' }), 'lb');
    expect(outcome!.target).toBeCloseTo(74.8, 1);
  });

  it('honours a user-typed title over the default', () => {
    const { title } = buildBenchmarkFields(behaviorForm({ title: 'Get on the water' }), 'kg');
    expect(title).toBe('Get on the water');
  });

  it('validates the primary face and any paired face', () => {
    expect(validateBenchmarkForm(emptyBenchmarkForm())).toMatch(/pick something/i);
    expect(validateBenchmarkForm(behaviorForm({ count: '' }))).toMatch(/how many/i);
    expect(validateBenchmarkForm(behaviorForm({ count: '0' }))).toMatch(/how many/i);
    expect(validateBenchmarkForm(behaviorForm())).toBeNull();
    expect(validateBenchmarkForm(outcomeForm())).toBeNull(); // blank target is fine
    expect(validateBenchmarkForm(outcomeForm({ target: 'abc' }))).toMatch(/target weight/i);
    expect(validateBenchmarkForm(outcomeForm({ target: '80' }))).toBeNull();
    // A paired face has to be filled like a primary one.
    expect(validateBenchmarkForm(outcomeForm({ secondFace: true }))).toMatch(/how many/i);
    expect(validateBenchmarkForm(outcomeForm({ secondFace: true, count: '4' }))).toBeNull();
    expect(validateBenchmarkForm(behaviorForm({ secondFace: true, target: 'abc' }))).toMatch(
      /target weight/i
    );
    expect(validateBenchmarkForm(behaviorForm({ secondFace: true }))).toBeNull();
  });

  it('round-trips a behavior-only benchmark through formFromBenchmark → buildBenchmarkFields', () => {
    const fields = buildBenchmarkFields(behaviorForm({ count: '3', window: 'month' }), 'kg');
    const form = formFromBenchmark(bench(fields), 'kg');
    expect(form.dimension).toEqual({ kind: 'activity', activityId: 'paddle' });
    expect(form.count).toBe('3');
    expect(form.window).toBe('month');
    expect(form.secondFace).toBe(false);
    expect(buildBenchmarkFields(form, 'kg')).toEqual(fields);
  });

  it('round-trips an outcome-only benchmark with a lb target through the form', () => {
    const fields = buildBenchmarkFields(outcomeForm({ target: '180', direction: 'up' }), 'lb');
    const form = formFromBenchmark(bench(fields), 'lb');
    expect(form.dimension).toEqual({ kind: 'bodyweight' });
    expect(form.direction).toBe('up');
    expect(parseFloat(form.target)).toBeCloseTo(180, 0);
    expect(form.secondFace).toBe(false);
  });

  it('round-trips a dual-face benchmark from the activity path', () => {
    const fields = buildBenchmarkFields(
      behaviorForm({ secondFace: true, direction: 'down', target: '75' }),
      'kg'
    );
    const form = formFromBenchmark(bench(fields), 'kg');
    // Activity-narrowed behavior wins the primary slot; the outcome is the pairing.
    expect(form.dimension).toEqual({ kind: 'activity', activityId: 'paddle' });
    expect(form.secondFace).toBe(true);
    expect(form.direction).toBe('down');
    expect(parseFloat(form.target)).toBe(75);
    expect(buildBenchmarkFields(form, 'kg')).toEqual(fields);
  });

  it('round-trips a dual-face benchmark with an any-session behavior (bodyweight path)', () => {
    const fields = buildBenchmarkFields(outcomeForm({ secondFace: true, count: '4' }), 'kg');
    const form = formFromBenchmark(bench(fields), 'kg');
    // The behavior counts any session, so bodyweight keeps the primary slot.
    expect(form.dimension).toEqual({ kind: 'bodyweight' });
    expect(form.secondFace).toBe(true);
    expect(form.pairedActivityId).toBeNull();
    expect(form.count).toBe('4');
    expect(buildBenchmarkFields(form, 'kg')).toEqual(fields);
  });

  it('summarizes each face alone and both together', () => {
    const beh = bench(buildBenchmarkFields(behaviorForm({ count: '4' }), 'kg'));
    expect(summarizeBenchmark(beh, 'kg')).toBe('Paddle · 4×/week');

    const outT = bench(buildBenchmarkFields(outcomeForm({ target: '75' }), 'kg'));
    expect(summarizeBenchmark(outT, 'kg')).toBe('Bodyweight · down to 75.0 kg');

    const outPure = bench(buildBenchmarkFields(outcomeForm(), 'kg'));
    expect(summarizeBenchmark(outPure, 'kg')).toBe('Bodyweight · trending down');

    const dual = bench(
      buildBenchmarkFields(behaviorForm({ secondFace: true, target: '75' }), 'kg')
    );
    expect(summarizeBenchmark(dual, 'kg')).toBe('Paddle · 4×/week — weight down to 75.0 kg');

    const dualAny = bench(buildBenchmarkFields(outcomeForm({ secondFace: true, count: '5' }), 'kg'));
    expect(summarizeBenchmark(dualAny, 'kg')).toBe('Sessions · 5×/week — weight trending down');
  });
});
