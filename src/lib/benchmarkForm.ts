/**
 * benchmarkForm.ts — pure form logic for Structured benchmark entry (v0.4 faces).
 *
 * The deterministic "weigh it out" path (benchmarks-spec.md, "Three entry
 * layers"): the user picks a tracked dimension and the pick seeds the
 * benchmark's PRIMARY face — an activity seeds a behavior (a rhythm to hold),
 * bodyweight seeds an outcome (a movement to watch). The other face is
 * PAIRABLE right there, optional and never pushed: an activity rhythm can pair
 * a bodyweight outcome; a bodyweight outcome can pair a session rhythm ("train
 * 4×/week" — any session, or narrowed to one activity). There is still no
 * goal-type picker anywhere: filling rhythm fields IS setting a behavior face,
 * filling direction fields IS setting an outcome face (benchmarks-spec.md,
 * "The two faces"). No React, no storage, no LLM — mirrors lib/session.ts so
 * tests read it directly.
 */
import type { Benchmark, BehaviorFace, OutcomeFace, ResolvedDimension } from '@core/benchmark';
import { activityById } from './activity';
import { displayToKg, kgToDisplay, formatWeight, type WeightUnit } from './units';

/** Step 1's choice: a concrete thing the app tracks — seeds the primary face. */
export type BenchmarkDimension =
  | { kind: 'activity'; activityId: string }
  | { kind: 'bodyweight' };

export type BenchmarkWindow = 'week' | 'month';
export type TrendDirection = 'down' | 'up';

/** Raw form state — numeric fields are strings (TextInput values), parsed at build. */
export type BenchmarkForm = {
  dimension: BenchmarkDimension | null;
  title: string; // user's own words; blank → defaultTitle
  /** Whether the optional paired face is in play (outcome on the activity
   *  path, behavior on the bodyweight path). */
  secondFace: boolean;
  // ─ behavior fields (primary on the activity path; paired on bodyweight) ─
  count: string; // events per window
  window: BenchmarkWindow;
  /** Bodyweight path only: which activity the paired rhythm counts.
   *  null ⇒ any logged session. */
  pairedActivityId: string | null;
  // ─ outcome fields (primary on the bodyweight path; paired on activity) ─
  direction: TrendDirection; // which way bodyweight moves
  target: string; // optional threshold, in display weight units
};

export function emptyBenchmarkForm(): BenchmarkForm {
  return {
    dimension: null,
    title: '',
    secondFace: false,
    count: '',
    window: 'week',
    pairedActivityId: null,
    direction: 'down',
    target: '',
  };
}

/** The face a step-1 pick seeds — DERIVED, never chosen by the user. */
export function primaryFaceOf(dim: BenchmarkDimension): 'behavior' | 'outcome' {
  return dim.kind === 'activity' ? 'behavior' : 'outcome';
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

/** Which faces the current form state is setting. */
function facesInPlay(form: BenchmarkForm): { behavior: boolean; outcome: boolean } {
  const dim = form.dimension;
  if (!dim) return { behavior: false, outcome: false };
  if (dim.kind === 'activity') return { behavior: true, outcome: form.secondFace };
  return { behavior: form.secondFace, outcome: true };
}

/** The behavior face's dimension: an activity narrows what counts; null counts
 *  ANY logged session (bare sessionCount). */
function behaviorDimensionFor(activityId: string | null): ResolvedDimension {
  if (activityId == null) return { metric: 'sessionCount' };
  const a = activityById(activityId);
  return {
    metric: 'sessionCount',
    activity: activityId,
    ...(a ? { modality: a.modality } : {}),
  };
}

function behaviorFor(form: BenchmarkForm): BehaviorFace {
  const dim = form.dimension!;
  const activityId = dim.kind === 'activity' ? dim.activityId : form.pairedActivityId;
  return {
    dimension: behaviorDimensionFor(activityId),
    window: form.window,
    measure: { type: 'count', target: parseInt(form.count, 10) },
  };
}

function outcomeFor(form: BenchmarkForm, weightUnit: WeightUnit): OutcomeFace {
  const target = parseTargetKg(form.target, weightUnit);
  return {
    dimension: { metric: 'bodyweight' },
    direction: form.direction,
    ...(target != null ? { target } : {}),
  };
}

/** Auto-title from the faces in play. The user can override it. */
export function defaultTitle(form: BenchmarkForm, weightUnit: WeightUnit): string {
  const dim = form.dimension;
  if (!dim) return '';
  const faces = facesInPlay(form);

  const behaviorPart = (() => {
    const n = form.count.trim();
    const activityId = dim.kind === 'activity' ? dim.activityId : form.pairedActivityId;
    const label = activityId != null ? activityLabel(activityId) : 'Train';
    return n ? `${label} ${n}×/${WINDOW_LABEL[form.window]}` : label;
  })();

  const outcomePart = (() => {
    const dir = form.direction === 'down' ? 'Lose weight' : 'Gain weight';
    const kg = parseTargetKg(form.target, weightUnit);
    return kg != null ? `${dir} → ${formatWeight(kg, weightUnit)}` : dir;
  })();

  if (faces.behavior && faces.outcome) {
    // Lead with the primary face — the one the step-1 pick seeded.
    return dim.kind === 'activity'
      ? `${behaviorPart}, weight ${form.direction}`
      : `${outcomePart}, ${behaviorPart.toLowerCase()}`;
  }
  return faces.behavior ? behaviorPart : outcomePart;
}

/**
 * The benchmark's identity fields, built from the form. Create + edit share
 * these. Both face keys are ALWAYS present (explicitly undefined when absent)
 * so an edit that sheds a face flows through updateBenchmark's spread merge.
 */
export function buildBenchmarkFields(
  form: BenchmarkForm,
  weightUnit: WeightUnit
): { behavior: BehaviorFace | undefined; outcome: OutcomeFace | undefined; title: string } {
  if (!form.dimension) throw new Error('buildBenchmarkFields: no dimension chosen');
  const faces = facesInPlay(form);
  return {
    behavior: faces.behavior ? behaviorFor(form) : undefined,
    outcome: faces.outcome ? outcomeFor(form, weightUnit) : undefined,
    title: form.title.trim() || defaultTitle(form, weightUnit),
  };
}

/** Null when valid; otherwise a short, user-facing reason. */
export function validateBenchmarkForm(form: BenchmarkForm): string | null {
  const faces = facesInPlay(form);
  if (!form.dimension) return 'Pick something to track.';
  if (faces.behavior) {
    const n = parseInt(form.count, 10);
    if (!Number.isFinite(n) || n <= 0) return 'Set how many times per week or month.';
  }
  if (faces.outcome && form.target.trim()) {
    const n = parseFloat(form.target);
    if (!Number.isFinite(n) || n <= 0) return 'Enter a target weight, or leave it blank.';
  }
  return null;
}

/**
 * Hydrate the form from an existing benchmark (edit mode). Inverse of
 * buildBenchmarkFields. The primary face is recovered from which faces exist:
 * an activity-narrowed behavior hydrates the activity path; otherwise the
 * outcome hydrates the bodyweight path (with any behavior as the paired face).
 * A behavior-only benchmark counting ANY session isn't creatable in the v1
 * form, so it hydrates with no dimension and the form asks again.
 */
export function formFromBenchmark(b: Benchmark, weightUnit: WeightUnit): BenchmarkForm {
  const form = emptyBenchmarkForm();
  form.title = b.title;

  if (b.behavior) {
    form.window = b.behavior.window;
    if (b.behavior.measure.type === 'count') {
      form.count = String(b.behavior.measure.target);
    }
  }
  if (b.outcome) {
    form.direction = b.outcome.direction;
    if (b.outcome.target != null) {
      form.target = String(Math.round(kgToDisplay(b.outcome.target, weightUnit) * 10) / 10);
    }
  }

  const behDim = b.behavior?.dimension;
  const behaviorActivity =
    behDim && behDim.metric === 'sessionCount' ? behDim.activity : undefined;

  if (b.behavior && behaviorActivity) {
    form.dimension = { kind: 'activity', activityId: behaviorActivity };
    form.secondFace = !!b.outcome;
  } else if (b.outcome) {
    form.dimension = { kind: 'bodyweight' };
    form.secondFace = !!b.behavior;
    form.pairedActivityId = behaviorActivity ?? null;
  }
  return form;
}

/** Compact second-position outcome fragment ("weight down to 75.0 kg"). */
function outcomeFragment(o: OutcomeFace, weightUnit: WeightUnit): string {
  return o.target != null
    ? `weight ${o.direction} to ${formatWeight(o.target, weightUnit)}`
    : `weight trending ${o.direction}`;
}

/** One-line, descriptive (never prescriptive) summary — list now, Today in Pass 3. */
export function summarizeBenchmark(b: Benchmark, weightUnit: WeightUnit): string {
  const beh = b.behavior;
  const behaviorPart = beh
    ? (() => {
        const d = beh.dimension;
        const label =
          d.metric === 'sessionCount' && d.activity ? activityLabel(d.activity) : 'Sessions';
        const m = beh.measure;
        const amount = m.type === 'count' ? `${m.target}×` : `${m.target} ${m.unit}`;
        return `${label} · ${amount}/${WINDOW_LABEL[beh.window]}`;
      })()
    : null;

  if (behaviorPart && b.outcome) {
    return `${behaviorPart} — ${outcomeFragment(b.outcome, weightUnit)}`;
  }
  if (behaviorPart) return behaviorPart;

  const o = b.outcome!;
  return o.target != null
    ? `Bodyweight · ${o.direction} to ${formatWeight(o.target, weightUnit)}`
    : `Bodyweight · trending ${o.direction}`;
}
