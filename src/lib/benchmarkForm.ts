/**
 * benchmarkForm.ts — pure form logic for Structured benchmark entry (Phase 5 Pass 2).
 *
 * The deterministic "weigh it out" path (benchmarks-spec.md, "Three entry layers"):
 * the user picks a tracked dimension — one of their activities (→ a session
 * cadence) or bodyweight (→ a trend) — fills the natural target, and the
 * benchmark's resolution + shape + FAMILY fall out of what they filled. There is
 * no goal-type picker: a per-window count makes it a cadence, a direction makes
 * it a trend (benchmarks-spec.md, "The two goal families"). No React, no storage,
 * no LLM — mirrors lib/session.ts so tests read it directly.
 */
import type { Benchmark, BenchmarkShape, ResolvedDimension } from '@core/benchmark';
import { activityById } from './activity';
import { displayToKg, kgToDisplay, formatWeight, type WeightUnit } from './units';

/** Step 1's choice: a concrete thing the app tracks. Activity → cadence; bodyweight → trend. */
export type BenchmarkDimension =
  | { kind: 'activity'; activityId: string }
  | { kind: 'bodyweight' };

export type BenchmarkWindow = 'week' | 'month';
export type TrendDirection = 'down' | 'up';

/** Raw form state — numeric fields are strings (TextInput values), parsed at build. */
export type BenchmarkForm = {
  dimension: BenchmarkDimension | null;
  title: string; // user's own words; blank → defaultTitle
  count: string; // cadence: events per window
  window: BenchmarkWindow;
  direction: TrendDirection; // trend: which way bodyweight moves
  target: string; // trend: optional threshold, in display weight units
};

export function emptyBenchmarkForm(): BenchmarkForm {
  return {
    dimension: null,
    title: '',
    count: '',
    window: 'week',
    direction: 'down',
    target: '',
  };
}

/** The family a dimension produces — DERIVED, never chosen by the user. */
export function familyOf(dim: BenchmarkDimension): 'cadence' | 'trend' {
  return dim.kind === 'activity' ? 'cadence' : 'trend';
}

const WINDOW_LABEL: Record<BenchmarkWindow, string> = { week: 'week', month: 'month' };

function activityLabel(id: string): string {
  return activityById(id)?.label ?? id;
}

function parseTargetKg(text: string, unit: WeightUnit): number | null {
  const n = parseFloat(text);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(displayToKg(n, unit) * 10) / 10;
}

/** Auto-title from the dimension + fields. The user can override it. */
export function defaultTitle(form: BenchmarkForm, weightUnit: WeightUnit): string {
  const dim = form.dimension;
  if (!dim) return '';
  if (dim.kind === 'activity') {
    const n = form.count.trim();
    const label = activityLabel(dim.activityId);
    return n ? `${label} ${n}×/${WINDOW_LABEL[form.window]}` : label;
  }
  const dir = form.direction === 'down' ? 'Lose weight' : 'Gain weight';
  const kg = parseTargetKg(form.target, weightUnit);
  return kg != null ? `${dir} → ${formatWeight(kg, weightUnit)}` : dir;
}

function resolutionFor(dim: BenchmarkDimension): ResolvedDimension {
  if (dim.kind === 'bodyweight') return { metric: 'bodyweight' };
  const a = activityById(dim.activityId);
  return {
    metric: 'sessionCount',
    activity: dim.activityId,
    ...(a ? { modality: a.modality } : {}),
  };
}

function shapeFor(form: BenchmarkForm, weightUnit: WeightUnit): BenchmarkShape {
  const dim = form.dimension!;
  if (dim.kind === 'activity') {
    return {
      family: 'cadence',
      window: form.window,
      measure: { type: 'count', target: parseInt(form.count, 10) },
    };
  }
  const target = parseTargetKg(form.target, weightUnit);
  return {
    family: 'trend',
    direction: form.direction,
    ...(target != null ? { target } : {}),
  };
}

/** The benchmark's identity fields, built from the form. Create + edit share these. */
export function buildBenchmarkFields(
  form: BenchmarkForm,
  weightUnit: WeightUnit
): { resolution: ResolvedDimension; shape: BenchmarkShape; title: string } {
  if (!form.dimension) throw new Error('buildBenchmarkFields: no dimension chosen');
  return {
    resolution: resolutionFor(form.dimension),
    shape: shapeFor(form, weightUnit),
    title: form.title.trim() || defaultTitle(form, weightUnit),
  };
}

/** Null when valid; otherwise a short, user-facing reason. */
export function validateBenchmarkForm(form: BenchmarkForm): string | null {
  const dim = form.dimension;
  if (!dim) return 'Pick something to track.';
  if (dim.kind === 'activity') {
    const n = parseInt(form.count, 10);
    if (!Number.isFinite(n) || n <= 0) return 'Set how many times per week or month.';
  } else if (form.target.trim()) {
    const n = parseFloat(form.target);
    if (!Number.isFinite(n) || n <= 0) return 'Enter a target weight, or leave it blank.';
  }
  return null;
}

/** Hydrate the form from an existing benchmark (edit mode). Inverse of buildBenchmarkFields. */
export function formFromBenchmark(b: Benchmark, weightUnit: WeightUnit): BenchmarkForm {
  const form = emptyBenchmarkForm();
  form.title = b.title;
  if (b.shape.family === 'cadence') {
    const r = b.resolution;
    form.dimension =
      r.metric === 'sessionCount' && r.activity
        ? { kind: 'activity', activityId: r.activity }
        : null;
    form.window = b.shape.window;
    if (b.shape.measure.type === 'count') {
      form.count = String(b.shape.measure.target);
    }
  } else {
    form.dimension = { kind: 'bodyweight' };
    form.direction = b.shape.direction;
    if (b.shape.target != null) {
      form.target = String(Math.round(kgToDisplay(b.shape.target, weightUnit) * 10) / 10);
    }
  }
  return form;
}

/** One-line, descriptive (never prescriptive) summary — list now, Today in Pass 3. */
export function summarizeBenchmark(b: Benchmark, weightUnit: WeightUnit): string {
  if (b.shape.family === 'cadence') {
    const r = b.resolution;
    const label =
      r.metric === 'sessionCount' && r.activity ? activityLabel(r.activity) : 'Sessions';
    const m = b.shape.measure;
    const amount = m.type === 'count' ? `${m.target}×` : `${m.target} ${m.unit}`;
    return `${label} · ${amount}/${WINDOW_LABEL[b.shape.window]}`;
  }
  const dir = b.shape.direction === 'down' ? 'down' : 'up';
  return b.shape.target != null
    ? `Bodyweight · ${dir} to ${formatWeight(b.shape.target, weightUnit)}`
    : `Bodyweight · trending ${dir}`;
}
