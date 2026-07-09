/**
 * benchmarkStatus.ts — pure status math for Today's benchmark cards (Phase 5
 * Pass 3).
 *
 * A pinned benchmark reads back as up to two LINES, one per face
 * (benchmarks-spec.md v0.4, "Three surfaces, one object"):
 *   - behavior → a factual count for the current window ("2/4 this week").
 *     Count, never streak: no run-length, no celebration, resets without
 *     drama when the window rolls (spec, "Consistency counters").
 *   - outcome → the observed movement ("82.4 kg · ↓ 0.4 kg over 14 days").
 *     The mirror reports the ACTUAL direction even when it opposes the wish —
 *     observed, never moralized; no green/red anywhere.
 *
 * Windows bucket by UTC civil date — same posture as the stimulus ledger
 * (core/stimulus.ts isoWeekStart; quirk 1/10: tz-correct bucketing deferred).
 * No React, no storage — the hook feeds it, tests read it directly.
 */
import type { BehaviorFace, OutcomeFace, ResolvedDimension } from '@core/benchmark';
import type { LocalDate, ObservationOf } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import type { ExpenditureWindow } from '@core/expenditure';
import { energyBalanceKcalPerDay } from '@core/expenditure';
import { isoWeekStart } from '@core/stimulus';
import { weightTrendDelta } from '@core/trend';
import { bucketByLocalDay } from '@core/timeline';
import { computeE1rmSeries, type SessionSets } from '@core/gymAnalytics';
import {
  captureTierShare,
  evaluateDaysWindow,
  type NutritionDay,
} from '@core/nutrition/days';
import type { UserProtocol } from './protocols';
import { formatWeight, formatDelta, type WeightUnit } from './units';

// ─── Windows ─────────────────────────────────────────────────────────────────

export type WindowRange = {
  /** Inclusive ISO instant the window opens at. */
  fromIso: string;
  /** Exclusive ISO instant the window closes at. */
  toIso: string;
};

/** The current week (ISO Monday start) or calendar month containing `nowIso`,
 *  as a UTC instant range. Boundaries carry milliseconds ('.000Z') so string
 *  comparison against real occurredAt values (always toISOString format) is
 *  uniform — a mixed 'T00:00:00Z' bound sorts AFTER 'T00:00:00.500Z' and
 *  would misbucket a session logged in the first second of the window. */
export function currentWindowRange(
  window: BehaviorFace['window'],
  nowIso: string
): WindowRange {
  const day = nowIso.slice(0, 10);
  if (window === 'week') {
    const start = new Date(`${isoWeekStart(day)}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { fromIso: start.toISOString(), toIso: end.toISOString() };
  }
  const start = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

// ─── Which sessions count ────────────────────────────────────────────────────

/**
 * Whether a logged session counts toward a sessionCount dimension.
 *
 * Precision degrades honestly, never silently over- or under-claims:
 *  - dimension names an activity → a session carrying an activity must match it
 *    exactly (we KNOW a 'sup' session isn't the 'kayak' benchmark); a legacy
 *    session with NO activity falls back to the movement family (modality)
 *    match — the app can't distinguish finer than what was logged.
 *  - dimension names only a modality → modality match.
 *  - bare dimension → every session counts ("any session" pairing).
 */
export function sessionMatchesDimension(
  session: ObservationOf<'session'>,
  dim: ResolvedDimension
): boolean {
  if (dim.metric !== 'sessionCount') return false;
  const p = session.payload;
  if (dim.activity) {
    if (p.activity) return p.activity === dim.activity;
    return dim.modality != null && p.modality === dim.modality;
  }
  if (dim.modality) return p.modality === dim.modality;
  return true;
}

// ─── Behavior face status ────────────────────────────────────────────────────

export type WindowLabel = 'this week' | 'this month';

export type BehaviorStatus =
  // qualifying sessions logged so far in the window
  | { kind: 'count'; count: number; target: number; windowLabel: WindowLabel }
  // days meeting the predicate — three-valued: unknowable is neither hit nor miss
  | {
      kind: 'days';
      hits: number;
      misses: number;
      unknowable: number;
      target: number;
      windowLabel: WindowLabel;
    }
  // share of entries at/above a capture tier; pct null until an entry exists
  | {
      kind: 'share';
      pct: number | null;
      targetPct: number;
      minTier: 'T2' | 'T3';
      windowLabel: WindowLabel;
    }
  // protocolAdherence: rolling-7d, unweighted mean of per-exercise ratios
  // (each capped at 1 — ticking an exercise 5x against a 2x target doesn't
  // let it carry the mean past 100%). null when the protocol has no
  // exercises left active (archived mid-window, say) — never a fabricated 0.
  | { kind: 'adherence'; pct: number | null; exerciseCount: number };

function windowLabelOf(window: BehaviorFace['window']): WindowLabel {
  return window === 'week' ? 'this week' : 'this month';
}

/**
 * The factual count for the current window. Returns null for a magnitude
 * measure — not creatable in the v1 form, and a session count would be the
 * wrong number to show against a km target (never fake a number) — and for
 * the nutrition measures, which read food entries (nutritionBehaviorStatus).
 */
export function behaviorStatus(
  face: BehaviorFace,
  sessions: ObservationOf<'session'>[],
  nowIso: string
): BehaviorStatus | null {
  if (face.measure.type !== 'count') return null;
  const range = currentWindowRange(face.window, nowIso);
  const count = sessions.filter(
    (s) =>
      s.occurredAt >= range.fromIso &&
      s.occurredAt < range.toIso &&
      sessionMatchesDimension(s, face.dimension)
  ).length;
  return {
    kind: 'count',
    count,
    target: face.measure.target,
    windowLabel: windowLabelOf(face.window),
  };
}

// ─── Nutrition behavior status (days predicates + capture-tier share) ────────

/** The window's civil dates, from the range's opening day (inclusive) to its
 *  closing day (exclusive). Same UTC-civil posture as the ranges themselves. */
export function windowDates(range: WindowRange): LocalDate[] {
  const out: LocalDate[] = [];
  const end = range.toIso.slice(0, 10);
  for (let d = new Date(range.fromIso); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    if (day >= end) break;
    out.push(day);
  }
  return out;
}

/**
 * Assemble the window's elapsed days for the three-valued day engine: one
 * NutritionDay per civil date up to today (empty meals for unlogged days —
 * the engine decides what absence means per condition), today in progress.
 * Meals bucket by their OWN local civil day (a late meal lands on the day it
 * belongs to), while window boundaries stay UTC-civil — the same documented
 * quirk-1/10 posture the session windows use.
 */
export function nutritionDaysInRange(
  entries: ObservationOf<'foodEntry'>[],
  range: WindowRange,
  todayDate: LocalDate
): { days: NutritionDay[]; totalDays: number } {
  const byDay = bucketByLocalDay([...entries]);
  const dates = windowDates(range);
  const days = dates
    .filter((d) => d <= todayDate)
    .map((d) => ({
      date: d,
      meals: ((byDay.get(d) ?? []) as ObservationOf<'foodEntry'>[]).map((o) => o.payload),
      inProgress: d === todayDate,
    }));
  return { days, totalDays: dates.length };
}

/** The current window's status for a nutrition behavior face (days / share).
 *  Null for measures this function doesn't own. */
export function nutritionBehaviorStatus(
  face: BehaviorFace,
  entries: ObservationOf<'foodEntry'>[],
  nowIso: string,
  todayDate: LocalDate
): BehaviorStatus | null {
  const range = currentWindowRange(face.window, nowIso);
  const { days, totalDays } = nutritionDaysInRange(entries, range, todayDate);

  if (face.measure.type === 'days') {
    const r = evaluateDaysWindow(days, face.measure.condition, face.measure.target, { totalDays });
    return {
      kind: 'days',
      hits: r.hits,
      misses: r.misses,
      unknowable: r.unknowable,
      target: r.target,
      windowLabel: windowLabelOf(face.window),
    };
  }
  if (face.measure.type === 'share') {
    const share = captureTierShare(days, face.measure.minTier);
    return {
      kind: 'share',
      pct: share?.pct ?? null,
      targetPct: face.measure.targetPct,
      minTier: face.measure.minTier,
      windowLabel: windowLabelOf(face.window),
    };
  }
  return null;
}

// ─── Protocol adherence (Body P6) ───────────────────────────────────────────

/**
 * Rolling-7d adherence to a protocol: for each of the protocol's ACTIVE
 * exercises, ratio = min(1, ticksInLast7Days / targetPerWeek); the status is
 * the unweighted mean across those ratios — one lagging exercise pulls the
 * average down exactly as much as one ahead-of-target exercise lifts it,
 * nothing more (capped so a single over-ticked exercise can't paper over the
 * others). `ticksByExerciseId` is a plain count map the caller derives from
 * protocolTicks.ts's real rows (rolling 7-day window, already filtered to
 * this protocol) — this function does no storage reads.
 */
export function protocolAdherenceStatus(
  protocol: Pick<UserProtocol, 'exercises'>,
  ticksByExerciseId: Record<string, number>
): BehaviorStatus {
  const active = protocol.exercises;
  if (active.length === 0) return { kind: 'adherence', pct: null, exerciseCount: 0 };
  const ratios = active.map((ex) => {
    const ticks = ticksByExerciseId[ex.id] ?? 0;
    return Math.min(1, ticks / ex.targetPerWeek);
  });
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return { kind: 'adherence', pct: Math.round(mean * 100), exerciseCount: active.length };
}

// ─── Outcome face status ─────────────────────────────────────────────────────

export type OutcomeStatus =
  | { kind: 'noData'; what?: 'weight' | 'balance' | 'exerciseLoad' | 'breathRetention' | 'romMeasurement' } // nothing measured yet — the card says so, honestly
  | {
      kind: 'moving';
      trendKg: number; // latest smoothed weight
      deltaKg: number | null; // recent movement; null when too sparse for honesty
      deltaDays: number | null;
      targetKg?: number; // the face's threshold, when set
      toTargetKg?: number; // signed distance: trend − target (+ ⇒ above)
    }
  // the measured energy balance (intake − burn); exists only once the
  // expenditure residual does — degrades to noData, never a guess
  | { kind: 'balance'; kcalPerDay: number; targetKcal?: number }
  // Body P6 — a lift's most recent e1RM (core/gymAnalytics.ts), toward an
  // optional threshold. NOT a trend line (no smoothing exists for e1RM);
  // "latest" is the fact, same honesty posture as a raw weigh-in.
  | { kind: 'exerciseLoad'; latestE1rmKg: number; targetKg?: number; toTargetKg?: number }
  // Body P6 — best single hold or the average across every logged round in
  // the fetched window, per the face's own `statistic` choice.
  | { kind: 'breathRetention'; seconds: number; statistic: 'best' | 'average'; targetSeconds?: number }
  // Body P6 — the most recent romReading for this test/side.
  | { kind: 'romMeasurement'; value: number; unit: string; targetValue?: number };

/** Mirrors core/gymAnalytics.ts's own (private) exerciseKey derivation
 *  exactly, so a dimension's key can be compared directly against an
 *  E1rmPoint's `exerciseKey` — no need to reverse-engineer whether a given
 *  key string is an id or a normalized name. */
function dimensionExerciseKey(dim: { exerciseId?: string; exercise: string }): string {
  return dim.exerciseId ?? dim.exercise.trim().toLowerCase();
}

/**
 * The observed movement of the outcome dimension. Bodyweight reads the same
 * smoothed points the trend chart renders; energyBalance reads the measured
 * expenditure window; exerciseLoad/breathRetention read gym-surface session
 * history (an explicit LONG window — see useBenchmarkStatuses); romMeasurement
 * reads romReading observations. Reports what IS, not what was wished for.
 */
export function outcomeStatus(
  face: OutcomeFace,
  points: WeightTrendPoint[],
  measured: ExpenditureWindow | null = null,
  sessions: ObservationOf<'session'>[] = [],
  romReadings: ObservationOf<'romReading'>[] = []
): OutcomeStatus {
  if (face.dimension.metric === 'energyBalance') {
    const balance = measured ? energyBalanceKcalPerDay(measured) : null;
    if (balance == null) return { kind: 'noData', what: 'balance' };
    return {
      kind: 'balance',
      kcalPerDay: balance,
      ...(face.target != null ? { targetKcal: face.target } : {}),
    };
  }

  if (face.dimension.metric === 'exerciseLoad') {
    const dim = face.dimension;
    const sessionSets: SessionSets[] = sessions
      .filter((s) => s.payload.lifting != null)
      .map((s) => ({ date: s.occurredAt.slice(0, 10), sets: s.payload.lifting!.sets }));
    const wantKey = dimensionExerciseKey(dim);
    const e1rmPoints = computeE1rmSeries(sessionSets).filter((p) => p.exerciseKey === wantKey);
    if (e1rmPoints.length === 0) return { kind: 'noData', what: 'exerciseLoad' };
    const latest = e1rmPoints[e1rmPoints.length - 1];
    return {
      kind: 'exerciseLoad',
      latestE1rmKg: latest.e1rmKg,
      ...(face.target != null ? { targetKg: face.target, toTargetKg: latest.e1rmKg - face.target } : {}),
    };
  }

  if (face.dimension.metric === 'breathRetention') {
    const rounds = sessions.flatMap((s) => s.payload.breathwork?.rounds ?? []);
    if (rounds.length === 0) return { kind: 'noData', what: 'breathRetention' };
    const seconds =
      face.dimension.statistic === 'best'
        ? Math.max(...rounds.map((r) => r.retentionSeconds))
        : rounds.reduce((sum, r) => sum + r.retentionSeconds, 0) / rounds.length;
    return {
      kind: 'breathRetention',
      seconds,
      statistic: face.dimension.statistic,
      ...(face.target != null ? { targetSeconds: face.target } : {}),
    };
  }

  if (face.dimension.metric === 'romMeasurement') {
    const dim = face.dimension;
    const matching = romReadings
      .filter((o) => o.payload.testId === dim.testId && o.payload.side === dim.side)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
    if (matching.length === 0) return { kind: 'noData', what: 'romMeasurement' };
    const latest = matching[matching.length - 1];
    return {
      kind: 'romMeasurement',
      value: latest.payload.value,
      unit: latest.payload.unit,
      ...(face.target != null ? { targetValue: face.target } : {}),
    };
  }

  if (face.dimension.metric !== 'bodyweight' || points.length === 0) {
    return { kind: 'noData', what: 'weight' };
  }
  const latest = points[points.length - 1];
  const delta = weightTrendDelta(points, 14);
  return {
    kind: 'moving',
    trendKg: latest.trendKg,
    deltaKg: delta ? delta.deltaKg : null,
    deltaDays: delta ? delta.days : null,
    ...(face.target != null
      ? { targetKg: face.target, toTargetKg: latest.trendKg - face.target }
      : {}),
  };
}

// ─── Card lines ──────────────────────────────────────────────────────────────

/** "2/4 this week" / "3/5 days this week · 2 unknown" / "82% at T2+ this
 *  week · target 80%" — the sovereign number, plain. Unknowable days are
 *  named, never folded into the misses. */
export function behaviorLine(s: BehaviorStatus): string {
  if (s.kind === 'days') {
    const base = `${s.hits}/${s.target} days ${s.windowLabel}`;
    return s.unknowable > 0 ? `${base} · ${s.unknowable} unknown` : base;
  }
  if (s.kind === 'share') {
    if (s.pct == null) return `no entries yet ${s.windowLabel}`;
    return `${s.pct}% at ${s.minTier}+ ${s.windowLabel} · target ${s.targetPct}%`;
  }
  if (s.kind === 'adherence') {
    if (s.pct == null) return 'no active exercises in this plan';
    return `${s.pct}% adherence over the last 7 days`;
  }
  return `${s.count}/${s.target} ${s.windowLabel}`;
}

/**
 * "82.4 kg · ↓ 0.4 kg over 14 days · 7.4 kg above target" — observed movement,
 * then factual distance. Same delta grammar as the weigh-in card. Sparse data
 * drops the delta segment rather than inventing one; "above/below" states the
 * relation without grading it.
 */
export function outcomeLine(s: OutcomeStatus, unit: WeightUnit): string {
  if (s.kind === 'noData') {
    switch (s.what) {
      case 'balance':
        return 'not enough data to measure yet';
      case 'exerciseLoad':
        return 'no working sets logged for this exercise yet';
      case 'breathRetention':
        return 'no breathwork rounds logged yet';
      case 'romMeasurement':
        return 'no ROM check-in logged yet';
      default:
        return 'no weight data yet';
    }
  }
  if (s.kind === 'balance') {
    const word = s.kcalPerDay <= 0 ? 'deficit' : 'surplus';
    const base = `≈ ${Math.abs(s.kcalPerDay)} cal/day ${word} · measured`;
    return s.targetKcal != null ? `${base} · target ~${s.targetKcal}` : base;
  }
  if (s.kind === 'exerciseLoad') {
    const base = `${formatWeight(s.latestE1rmKg, unit)} e1RM`;
    if (s.toTargetKg == null) return base;
    const side = s.toTargetKg >= 0 ? 'above' : 'below';
    return `${base} · ${formatWeight(Math.abs(s.toTargetKg), unit)} ${side} target`;
  }
  if (s.kind === 'breathRetention') {
    const label = s.statistic === 'best' ? 'best hold' : 'average hold';
    const base = `${Math.round(s.seconds)}s ${label}`;
    return s.targetSeconds != null ? `${base} · target ${s.targetSeconds}s` : base;
  }
  if (s.kind === 'romMeasurement') {
    const base = `${s.value} ${s.unit}`;
    return s.targetValue != null ? `${base} · target ${s.targetValue} ${s.unit}` : base;
  }
  const parts = [formatWeight(s.trendKg, unit)];
  if (s.deltaKg != null && s.deltaDays != null) {
    parts.push(`${formatDelta(s.deltaKg, unit)} over ${s.deltaDays} days`);
  }
  if (s.toTargetKg != null) {
    const side = s.toTargetKg >= 0 ? 'above' : 'below';
    parts.push(`${formatWeight(Math.abs(s.toTargetKg), unit)} ${side} target`);
  }
  return parts.join(' · ');
}
