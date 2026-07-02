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
import type { ObservationOf } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import { isoWeekStart } from '@core/stimulus';
import { weightTrendDelta } from '@core/trend';
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

export type BehaviorStatus = {
  count: number; // qualifying sessions logged so far in the window
  target: number;
  windowLabel: 'this week' | 'this month';
};

/**
 * The factual count for the current window. Returns null for a magnitude
 * measure — not creatable in the v1 form, and a session count would be the
 * wrong number to show against a km target (never fake a number).
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
    count,
    target: face.measure.target,
    windowLabel: face.window === 'week' ? 'this week' : 'this month',
  };
}

// ─── Outcome face status ─────────────────────────────────────────────────────

export type OutcomeStatus =
  | { kind: 'noData' } // no trend yet — the card says so, honestly
  | {
      kind: 'moving';
      trendKg: number; // latest smoothed weight
      deltaKg: number | null; // recent movement; null when too sparse for honesty
      deltaDays: number | null;
      targetKg?: number; // the face's threshold, when set
      toTargetKg?: number; // signed distance: trend − target (+ ⇒ above)
    };

/** The observed movement of the outcome dimension (bodyweight — the only
 *  outcome dimension wired). Reads the same smoothed points the trend chart
 *  renders; reports what IS, not what was wished for. */
export function outcomeStatus(face: OutcomeFace, points: WeightTrendPoint[]): OutcomeStatus {
  if (face.dimension.metric !== 'bodyweight' || points.length === 0) {
    return { kind: 'noData' };
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

/** "2/4 this week" — the sovereign number, plain. */
export function behaviorLine(s: BehaviorStatus): string {
  return `${s.count}/${s.target} ${s.windowLabel}`;
}

/**
 * "82.4 kg · ↓ 0.4 kg over 14 days · 7.4 kg above target" — observed movement,
 * then factual distance. Same delta grammar as the weigh-in card. Sparse data
 * drops the delta segment rather than inventing one; "above/below" states the
 * relation without grading it.
 */
export function outcomeLine(s: OutcomeStatus, unit: WeightUnit): string {
  if (s.kind === 'noData') return 'no weight data yet';
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
