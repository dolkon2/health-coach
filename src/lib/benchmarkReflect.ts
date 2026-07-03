/**
 * benchmarkReflect.ts — pure layout-key math for the benchmark-keyed Reflect
 * view (Phase 5 Pass 4).
 *
 * The benchmark is a LAYOUT KEY, not a label (benchmarks-spec.md v0.4): it
 * decides what Reflect foregrounds. The rules encoded here:
 *   - hero selection: when both faces exist, the OUTCOME face keys the hero
 *     (the measured story is what Reflect exists to mirror) and the behavior
 *     face renders beneath it as consistency context; a behavior-only
 *     benchmark promotes its rhythm — the doing IS the story.
 *   - the rhythm view: the last N windows as factual counts. Windows before
 *     the benchmark existed still count — the mirror reveals what happened,
 *     it doesn't start history at the moment of intent (the dad-ran-10mi-a-
 *     week-for-five-years case).
 *   - the revealed run: consecutive COMPLETE windows at target, counted back
 *     from the most recent complete one. The in-progress window neither
 *     extends nor breaks it. A run of 0 simply isn't shown — no drama either
 *     way (spec, "Consistency counters").
 *
 * Windows bucket UTC like everything else (isoWeekStart; quirks 1/10).
 * No React, no storage.
 */
import type { Benchmark, BehaviorFace } from '@core/benchmark';
import type { LocalDate, ObservationOf } from '@core/observation';
import { captureTierShare, evaluateDaysWindow } from '@core/nutrition/days';
import {
  currentWindowRange,
  nutritionDaysInRange,
  sessionMatchesDimension,
  type WindowRange,
} from './benchmarkStatus';

/** Which face keys the Reflect hero. Outcome wins when both exist. */
export function heroFaceOf(b: Benchmark): 'outcome' | 'behavior' {
  return b.outcome ? 'outcome' : 'behavior';
}

/**
 * The default lens when several benchmarks are pinned: the first with an
 * outcome face (a measured story to tell), else simply the first. Null when
 * there is nothing to key the view — Reflect then renders its no-benchmark
 * default.
 */
export function defaultLensId(benchmarks: Benchmark[]): string | null {
  if (benchmarks.length === 0) return null;
  return (benchmarks.find((b) => b.outcome) ?? benchmarks[0]).id;
}

/**
 * The last `n` windows of the given size, oldest → newest, INCLUDING the
 * current (in-progress) one. Weeks step by 7 days from the ISO Monday;
 * months step by calendar month from the first.
 */
export function pastWindowRanges(
  window: BehaviorFace['window'],
  nowIso: string,
  n: number
): WindowRange[] {
  const current = currentWindowRange(window, nowIso);
  const ranges: WindowRange[] = [current];
  for (let i = 1; i < n; i++) {
    const prevEnd = ranges[0].fromIso;
    const start = new Date(prevEnd);
    if (window === 'week') {
      start.setUTCDate(start.getUTCDate() - 7);
    } else {
      start.setUTCMonth(start.getUTCMonth() - 1);
    }
    ranges.unshift({ fromIso: start.toISOString(), toIso: prevEnd });
  }
  return ranges;
}

export type WindowCount = {
  fromIso: string;
  toIso: string;
  count: number;
  target: number;
  /** False when the window has no revealed verdict yet — the still-open
   *  current window, or (for day-predicates) a window whose unknowable days
   *  left it undecidable. Rendered hazed either way; never counted a miss. */
  complete: boolean;
  /** True only for the still-open current window (drives the "now" label).
   *  Optional for older callers; absent ⇒ derived from `complete`. */
  current?: boolean;
};

/**
 * Factual per-window counts for the rhythm view. Null for a magnitude measure
 * (a session count against a km target would be the wrong number) and for the
 * nutrition measures (nutritionWindowCounts reads food entries instead).
 */
export function behaviorWindowCounts(
  face: BehaviorFace,
  sessions: ObservationOf<'session'>[],
  nowIso: string,
  n: number
): WindowCount[] | null {
  if (face.measure.type !== 'count') return null;
  const target = face.measure.target;
  const matching = sessions.filter((s) => sessionMatchesDimension(s, face.dimension));
  return pastWindowRanges(face.window, nowIso, n).map((r) => ({
    ...r,
    count: matching.filter((s) => s.occurredAt >= r.fromIso && s.occurredAt < r.toIso).length,
    target,
    complete: r.toIso <= nowIso,
    current: r.toIso > nowIso,
  }));
}

/**
 * Per-window rhythm for the nutrition measures, three-valued at the window
 * grain (expenditure build, Pass F):
 *   - days predicate → count = days HIT; `complete` is true only when the
 *     window's verdict is revealed (hit or missed) — an elapsed window whose
 *     unknowable days left it undecidable renders hazed, exactly like the
 *     in-progress one, and `consecutiveAtTarget` then skips it, so the
 *     revealed run is never broken (or extended) by unknowable data.
 *   - share → count = the window's % of entries at/above the tier against a
 *     target of targetPct; windows with no entries stay hazed at zero.
 * Null for measures this function doesn't own.
 */
export function nutritionWindowCounts(
  face: BehaviorFace,
  entries: ObservationOf<'foodEntry'>[],
  nowIso: string,
  n: number,
  todayDate: LocalDate
): WindowCount[] | null {
  if (face.measure.type !== 'days' && face.measure.type !== 'share') return null;
  const measure = face.measure;
  return pastWindowRanges(face.window, nowIso, n).map((r) => {
    const current = r.toIso > nowIso;
    const { days, totalDays } = nutritionDaysInRange(entries, r, todayDate);
    if (measure.type === 'days') {
      const res = evaluateDaysWindow(days, measure.condition, measure.target, { totalDays });
      return {
        ...r,
        count: res.hits,
        target: measure.target,
        complete: res.verdict !== 'unknowable',
        current,
      };
    }
    const share = captureTierShare(days, measure.minTier);
    return {
      ...r,
      count: share?.pct ?? 0,
      target: measure.targetPct,
      complete: !current && share != null,
      current,
    };
  });
}

/**
 * The revealed run: consecutive complete windows at/above target, counted
 * back from the most recent complete one. The open window is skipped — it
 * can't have missed yet.
 */
export function consecutiveAtTarget(counts: WindowCount[]): number {
  let run = 0;
  for (let i = counts.length - 1; i >= 0; i--) {
    const w = counts[i];
    if (!w.complete) continue;
    if (w.count >= w.target) run++;
    else break;
  }
  return run;
}
