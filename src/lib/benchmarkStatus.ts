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
import {
  captureTierShare,
  evaluateDaysWindow,
  type NutritionDay,
} from '@core/nutrition/days';
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
    };

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

// ─── Outcome face status ─────────────────────────────────────────────────────

export type OutcomeStatus =
  | { kind: 'noData'; what?: 'weight' | 'balance' } // nothing measured yet — the card says so, honestly
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
  | { kind: 'balance'; kcalPerDay: number; targetKcal?: number };

/** The observed movement of the outcome dimension. Bodyweight reads the same
 *  smoothed points the trend chart renders; energyBalance reads the measured
 *  expenditure window. Reports what IS, not what was wished for. */
export function outcomeStatus(
  face: OutcomeFace,
  points: WeightTrendPoint[],
  measured: ExpenditureWindow | null = null
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
    return s.what === 'balance' ? 'not enough data to measure yet' : 'no weight data yet';
  }
  if (s.kind === 'balance') {
    const word = s.kcalPerDay <= 0 ? 'deficit' : 'surplus';
    const base = `≈ ${Math.abs(s.kcalPerDay)} cal/day ${word} · measured`;
    return s.targetKcal != null ? `${base} · target ~${s.targetKcal}` : base;
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
