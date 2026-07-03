/**
 * benchmarkForm.ts — pure form logic for Structured benchmark entry (v0.4 faces).
 *
 * The deterministic "weigh it out" path (benchmarks-spec.md, "Three entry
 * layers"): the user picks a tracked dimension and the pick seeds the
 * benchmark's PRIMARY face — an activity seeds a behavior (a rhythm to hold),
 * bodyweight seeds an outcome (a movement to watch), and the nutrition family
 * (expenditure build, Pass F) seeds behaviors: calories or a macro as a
 * days-per-window predicate, logging consistency as a days predicate, capture
 * quality as an entry-share ("80% at T2+" — capture-method distribution ONLY,
 * never the engine's earned-fidelity score). The other face is PAIRABLE right
 * there, optional and never pushed: an activity rhythm can pair a bodyweight
 * outcome; a nutrition behavior can pair a bodyweight OR energy-balance
 * outcome. There is still no goal-type picker anywhere: filling rhythm fields
 * IS setting a behavior face, filling direction fields IS setting an outcome
 * face (benchmarks-spec.md, "The two faces"). No React, no storage, no LLM —
 * mirrors lib/session.ts so tests read it directly.
 */
import type {
  Benchmark,
  BehaviorFace,
  DayCondition,
  MacroKind,
  OutcomeFace,
  ResolvedDimension,
} from '@core/benchmark';
import { activityById } from './activity';
import { displayToKg, kgToDisplay, formatWeight, type WeightUnit } from './units';

/** Step 1's choice: a concrete thing the app tracks — seeds the primary face. */
export type BenchmarkDimension =
  | { kind: 'activity'; activityId: string }
  | { kind: 'bodyweight' }
  | { kind: 'calories' } // days predicate over daily calories
  | { kind: 'macro' } // days predicate over a daily macro (which one is a detail field)
  | { kind: 'logging' } // days predicate: "day has a complete-enough log"
  | { kind: 'fidelity' }; // entry share at a capture tier

export type BenchmarkWindow = 'week' | 'month';
export type TrendDirection = 'down' | 'up';
export type IntakeOp = 'atLeast' | 'atMost';
export type FidelityMinTier = 'T2' | 'T3';
/** Which dimension the paired outcome watches on a nutrition path. */
export type OutcomePairDim = 'bodyweight' | 'energyBalance';

/** Raw form state — numeric fields are strings (TextInput values), parsed at build. */
export type BenchmarkForm = {
  dimension: BenchmarkDimension | null;
  title: string; // user's own words; blank → defaultTitle
  /** Whether the optional paired face is in play (outcome on the behavior
   *  paths, behavior on the bodyweight path). */
  secondFace: boolean;
  // ─ behavior fields (primary on the activity path; paired on bodyweight) ─
  count: string; // events per window
  window: BenchmarkWindow;
  /** Bodyweight path only: which activity the paired rhythm counts.
   *  null ⇒ any logged session. */
  pairedActivityId: string | null;
  // ─ nutrition behavior fields (primary on the nutrition paths) ─
  daysTarget: string; // days per window meeting the condition
  calorieOp: IntakeOp;
  calorieKcal: string;
  macro: MacroKind;
  macroOp: IntakeOp;
  macroGrams: string;
  fidelityPct: string; // % of entries at/above the tier
  fidelityMinTier: FidelityMinTier;
  // ─ outcome fields (primary on the bodyweight path; paired elsewhere) ─
  outcomePairDim: OutcomePairDim; // nutrition paths only; activity path pairs bodyweight
  direction: TrendDirection; // which way bodyweight moves
  target: string; // optional threshold, in display weight units
  balanceDirection: TrendDirection; // down = deficit, up = surplus
  balanceKcal: string; // optional magnitude, kcal/day
};

export function emptyBenchmarkForm(): BenchmarkForm {
  return {
    dimension: null,
    title: '',
    secondFace: false,
    count: '',
    window: 'week',
    pairedActivityId: null,
    daysTarget: '',
    calorieOp: 'atMost',
    calorieKcal: '',
    macro: 'protein',
    macroOp: 'atLeast',
    macroGrams: '',
    fidelityPct: '80',
    fidelityMinTier: 'T2',
    outcomePairDim: 'bodyweight',
    direction: 'down',
    target: '',
    balanceDirection: 'down',
    balanceKcal: '',
  };
}

const NUTRITION_KINDS = ['calories', 'macro', 'logging', 'fidelity'] as const;
export function isNutritionDimension(dim: BenchmarkDimension): boolean {
  return (NUTRITION_KINDS as readonly string[]).includes(dim.kind);
}

/** The face a step-1 pick seeds — DERIVED, never chosen by the user. */
export function primaryFaceOf(dim: BenchmarkDimension): 'behavior' | 'outcome' {
  return dim.kind === 'bodyweight' ? 'outcome' : 'behavior';
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

function parsePositive(text: string): number | null {
  const n = parseFloat(text);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Which faces the current form state is setting. */
function facesInPlay(form: BenchmarkForm): { behavior: boolean; outcome: boolean } {
  const dim = form.dimension;
  if (!dim) return { behavior: false, outcome: false };
  if (dim.kind === 'bodyweight') return { behavior: form.secondFace, outcome: true };
  return { behavior: true, outcome: form.secondFace };
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

function dayConditionFor(form: BenchmarkForm): DayCondition {
  const dim = form.dimension!;
  if (dim.kind === 'calories') {
    return { kind: 'calories', op: form.calorieOp, kcal: parsePositive(form.calorieKcal) ?? 0 };
  }
  if (dim.kind === 'macro') {
    return {
      kind: 'macro',
      macro: form.macro,
      op: form.macroOp,
      grams: parsePositive(form.macroGrams) ?? 0,
    };
  }
  return { kind: 'logged' };
}

function behaviorFor(form: BenchmarkForm): BehaviorFace {
  const dim = form.dimension!;
  switch (dim.kind) {
    case 'calories':
      return {
        dimension: { metric: 'calories' },
        window: form.window,
        measure: { type: 'days', target: parseInt(form.daysTarget, 10), condition: dayConditionFor(form) },
      };
    case 'macro':
      return {
        dimension: { metric: 'macro', macro: form.macro },
        window: form.window,
        measure: { type: 'days', target: parseInt(form.daysTarget, 10), condition: dayConditionFor(form) },
      };
    case 'logging':
      return {
        dimension: { metric: 'loggingConsistency' },
        window: form.window,
        measure: { type: 'days', target: parseInt(form.daysTarget, 10), condition: { kind: 'logged' } },
      };
    case 'fidelity':
      return {
        dimension: { metric: 'loggingFidelity' },
        window: form.window,
        measure: {
          type: 'share',
          targetPct: parsePositive(form.fidelityPct) ?? 0,
          minTier: form.fidelityMinTier,
        },
      };
    default: {
      // activity path, or the bodyweight path's paired session rhythm
      const activityId = dim.kind === 'activity' ? dim.activityId : form.pairedActivityId;
      return {
        dimension: behaviorDimensionFor(activityId),
        window: form.window,
        measure: { type: 'count', target: parseInt(form.count, 10) },
      };
    }
  }
}

function outcomeFor(form: BenchmarkForm, weightUnit: WeightUnit): OutcomeFace {
  const dim = form.dimension!;
  // Nutrition paths may pair an energy-balance outcome (measured intake −
  // measured burn); everything else watches bodyweight.
  if (isNutritionDimension(dim) && form.outcomePairDim === 'energyBalance') {
    const target = parsePositive(form.balanceKcal);
    return {
      dimension: { metric: 'energyBalance' },
      direction: form.balanceDirection,
      ...(target != null ? { target } : {}),
    };
  }
  const target = parseTargetKg(form.target, weightUnit);
  return {
    dimension: { metric: 'bodyweight' },
    direction: form.direction,
    ...(target != null ? { target } : {}),
  };
}

const MACRO_LABEL: Record<MacroKind, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  fiber: 'Fiber',
};

/** Auto-title from the faces in play. The user can override it. */
export function defaultTitle(form: BenchmarkForm, weightUnit: WeightUnit): string {
  const dim = form.dimension;
  if (!dim) return '';
  const faces = facesInPlay(form);
  const per = WINDOW_LABEL[form.window];

  const behaviorPart = (() => {
    switch (dim.kind) {
      case 'calories': {
        const kcal = form.calorieKcal.trim();
        const days = form.daysTarget.trim();
        const head = form.calorieOp === 'atMost' ? `Under ${kcal || '…'} cal` : `${kcal || '…'}+ cal`;
        return days ? `${head}, ${days} days/${per}` : head;
      }
      case 'macro': {
        const g = form.macroGrams.trim();
        const days = form.daysTarget.trim();
        const head =
          form.macroOp === 'atLeast'
            ? `${MACRO_LABEL[form.macro]} ${g || '…'}g+`
            : `${MACRO_LABEL[form.macro]} under ${g || '…'}g`;
        return days ? `${head}, ${days} days/${per}` : head;
      }
      case 'logging': {
        const days = form.daysTarget.trim();
        return `Log food ${days || '…'} days/${per}`;
      }
      case 'fidelity':
        return `${form.fidelityPct.trim() || '…'}% of logs at ${form.fidelityMinTier}+`;
      default: {
        const n = form.count.trim();
        const activityId = dim.kind === 'activity' ? dim.activityId : form.pairedActivityId;
        const label = activityId != null ? activityLabel(activityId) : 'Train';
        return n ? `${label} ${n}×/${per}` : label;
      }
    }
  })();

  const outcomePart = (() => {
    if (isNutritionDimension(dim) && form.outcomePairDim === 'energyBalance') {
      const word = form.balanceDirection === 'down' ? 'deficit' : 'surplus';
      const kcal = parsePositive(form.balanceKcal);
      return kcal != null ? `${word} ~${kcal} cal/day` : `running a ${word}`;
    }
    const dir = form.direction === 'down' ? 'Lose weight' : 'Gain weight';
    const kg = parseTargetKg(form.target, weightUnit);
    return kg != null ? `${dir} → ${formatWeight(kg, weightUnit)}` : dir;
  })();

  if (faces.behavior && faces.outcome) {
    // Lead with the primary face — the one the step-1 pick seeded.
    if (dim.kind === 'bodyweight') return `${outcomePart}, ${behaviorPart.toLowerCase()}`;
    if (dim.kind === 'activity') return `${behaviorPart}, weight ${form.direction}`;
    return `${behaviorPart} — ${outcomePart}`;
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

/** Days-per-window ceiling — a week has 7, a month at most 31. */
function maxDays(window: BenchmarkWindow): number {
  return window === 'week' ? 7 : 31;
}

/** Null when valid; otherwise a short, user-facing reason. */
export function validateBenchmarkForm(form: BenchmarkForm): string | null {
  const dim = form.dimension;
  const faces = facesInPlay(form);
  if (!dim) return 'Pick something to track.';

  if (faces.behavior) {
    switch (dim.kind) {
      case 'calories': {
        if (parsePositive(form.calorieKcal) == null) return 'Set a calorie amount.';
        const days = parseInt(form.daysTarget, 10);
        if (!Number.isFinite(days) || days <= 0) return 'Set how many days per week or month.';
        if (days > maxDays(form.window)) return `A ${form.window} has at most ${maxDays(form.window)} days.`;
        break;
      }
      case 'macro': {
        if (parsePositive(form.macroGrams) == null)
          return `Set a ${MACRO_LABEL[form.macro].toLowerCase()} amount in grams.`;
        const days = parseInt(form.daysTarget, 10);
        if (!Number.isFinite(days) || days <= 0) return 'Set how many days per week or month.';
        if (days > maxDays(form.window)) return `A ${form.window} has at most ${maxDays(form.window)} days.`;
        break;
      }
      case 'logging': {
        const days = parseInt(form.daysTarget, 10);
        if (!Number.isFinite(days) || days <= 0) return 'Set how many days per week or month.';
        if (days > maxDays(form.window)) return `A ${form.window} has at most ${maxDays(form.window)} days.`;
        break;
      }
      case 'fidelity': {
        const pct = parsePositive(form.fidelityPct);
        if (pct == null || pct > 100) return 'Set a percentage between 1 and 100.';
        break;
      }
      default: {
        const n = parseInt(form.count, 10);
        if (!Number.isFinite(n) || n <= 0) return 'Set how many times per week or month.';
      }
    }
  }

  if (faces.outcome) {
    const balancePair = isNutritionDimension(dim) && form.outcomePairDim === 'energyBalance';
    if (balancePair) {
      if (form.balanceKcal.trim() && parsePositive(form.balanceKcal) == null) {
        return 'Enter a daily kcal amount, or leave it blank.';
      }
    } else if (form.target.trim()) {
      const n = parseFloat(form.target);
      if (!Number.isFinite(n) || n <= 0) return 'Enter a target weight, or leave it blank.';
    }
  }
  return null;
}

/**
 * Hydrate the form from an existing benchmark (edit mode). Inverse of
 * buildBenchmarkFields. The primary face is recovered from the stored
 * dimensions: an activity-narrowed behavior hydrates the activity path, a
 * nutrition behavior hydrates its nutrition path, otherwise the outcome
 * hydrates the bodyweight path (with any behavior as the paired face).
 * A behavior-only benchmark counting ANY session isn't creatable in the v1
 * form, so it hydrates with no dimension and the form asks again.
 */
export function formFromBenchmark(b: Benchmark, weightUnit: WeightUnit): BenchmarkForm {
  const form = emptyBenchmarkForm();
  form.title = b.title;

  const beh = b.behavior;
  if (beh) {
    form.window = beh.window;
    const m = beh.measure;
    if (m.type === 'count') form.count = String(m.target);
    if (m.type === 'days') {
      form.daysTarget = String(m.target);
      if (m.condition.kind === 'calories') {
        form.calorieOp = m.condition.op;
        form.calorieKcal = String(m.condition.kcal);
      } else if (m.condition.kind === 'macro') {
        form.macro = m.condition.macro;
        form.macroOp = m.condition.op;
        form.macroGrams = String(m.condition.grams);
      }
    }
    if (m.type === 'share') {
      form.fidelityPct = String(m.targetPct);
      form.fidelityMinTier = m.minTier;
    }
  }

  const out = b.outcome;
  if (out) {
    if (out.dimension.metric === 'energyBalance') {
      form.outcomePairDim = 'energyBalance';
      form.balanceDirection = out.direction;
      if (out.target != null) form.balanceKcal = String(out.target);
    } else {
      form.direction = out.direction;
      if (out.target != null) {
        form.target = String(Math.round(kgToDisplay(out.target, weightUnit) * 10) / 10);
      }
    }
  }

  const behDim = beh?.dimension;
  const behaviorActivity =
    behDim && behDim.metric === 'sessionCount' ? behDim.activity : undefined;

  if (behDim && behDim.metric !== 'sessionCount' && behDim.metric !== 'bodyweight') {
    // A nutrition behavior seeds its own path; any outcome is the paired face.
    form.dimension =
      behDim.metric === 'calories'
        ? { kind: 'calories' }
        : behDim.metric === 'macro'
          ? { kind: 'macro' }
          : behDim.metric === 'loggingConsistency'
            ? { kind: 'logging' }
            : { kind: 'fidelity' };
    form.secondFace = !!out;
  } else if (beh && behaviorActivity) {
    form.dimension = { kind: 'activity', activityId: behaviorActivity };
    form.secondFace = !!out;
  } else if (out) {
    form.dimension = { kind: 'bodyweight' };
    form.secondFace = !!beh;
    form.pairedActivityId = behaviorActivity ?? null;
  }
  return form;
}

/** Compact second-position outcome fragment ("weight down to 75.0 kg"). */
function outcomeFragment(o: OutcomeFace, weightUnit: WeightUnit): string {
  if (o.dimension.metric === 'energyBalance') {
    const word = o.direction === 'down' ? 'deficit' : 'surplus';
    return o.target != null ? `${word} ~${o.target} cal/day` : `running a ${word}`;
  }
  return o.target != null
    ? `weight ${o.direction} to ${formatWeight(o.target, weightUnit)}`
    : `weight trending ${o.direction}`;
}

/** A short readable name for a non-session behavior dimension (nutrition family). */
function behaviorDimensionLabel(d: ResolvedDimension): string {
  switch (d.metric) {
    case 'calories':
      return 'Calories';
    case 'macro':
      return MACRO_LABEL[d.macro];
    case 'loggingConsistency':
      return 'Logging';
    case 'loggingFidelity':
      return 'Capture quality';
    default:
      return 'Sessions';
  }
}

/** One-line, descriptive (never prescriptive) summary — list now, Today in Pass 3. */
export function summarizeBenchmark(b: Benchmark, weightUnit: WeightUnit): string {
  const beh = b.behavior;
  const behaviorPart = beh
    ? (() => {
        const d = beh.dimension;
        const label =
          d.metric === 'sessionCount'
            ? d.activity
              ? activityLabel(d.activity)
              : 'Sessions'
            : behaviorDimensionLabel(d);
        const m = beh.measure;
        const amount =
          m.type === 'count'
            ? `${m.target}×`
            : m.type === 'magnitude'
              ? `${m.target} ${m.unit}`
              : m.type === 'days'
                ? `${m.target} days`
                : `${m.targetPct}% at ${m.minTier}+`;
        return `${label} · ${amount}/${WINDOW_LABEL[beh.window]}`;
      })()
    : null;

  if (behaviorPart && b.outcome) {
    return `${behaviorPart} — ${outcomeFragment(b.outcome, weightUnit)}`;
  }
  if (behaviorPart) return behaviorPart;

  const o = b.outcome!;
  if (o.dimension.metric === 'energyBalance') {
    return `Energy balance · ${outcomeFragment(o, weightUnit)}`;
  }
  return o.target != null
    ? `Bodyweight · ${o.direction} to ${formatWeight(o.target, weightUnit)}`
    : `Bodyweight · trending ${o.direction}`;
}
