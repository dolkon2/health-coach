/**
 * useBenchmarkStatuses — Today's pinned benchmarks with their face statuses
 * (Phase 5 Pass 3; nutrition family in the expenditure build, Pass F).
 *
 * Loads active+pinned benchmarks, plus one sessions query wide enough for the
 * widest window any behavior face uses (min of ISO-week start and month
 * start); the pure lib applies each face's exact range. A food query (same
 * floor, padded for local-day bucketing) runs only when a pinned benchmark
 * carries a nutrition face. Trend points are passed IN from the screen's
 * existing useWeightTrend, and the measured expenditure window from its
 * useExpenditure — the outcome faces read the same numbers those surfaces
 * render; Today never queries the same data twice.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Benchmark, BehaviorFace } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import type { ExpenditureWindow } from '@core/expenditure';
import { isKind } from '@core/observation';
import { isoWeekStart } from '@core/stimulus';
import { listBenchmarks } from '@/storage/benchmarks';
import { listObservations } from '@/storage/observations';
import { todayLocalDate } from '@/lib/date';
import {
  behaviorStatus,
  nutritionBehaviorStatus,
  outcomeStatus,
  type BehaviorStatus,
  type OutcomeStatus,
} from '@/lib/benchmarkStatus';

export type BenchmarkStatusEntry = {
  benchmark: Benchmark;
  behavior: BehaviorStatus | null;
  outcome: OutcomeStatus | null;
};

/** Query floor: whichever of this ISO week / this calendar month starts
 *  earlier. Millisecond format to compare uniformly with stored occurredAt. */
function sessionQueryFrom(nowIso: string): string {
  const day = nowIso.slice(0, 10);
  const weekStart = isoWeekStart(day);
  const monthStart = `${day.slice(0, 7)}-01`;
  return `${weekStart < monthStart ? weekStart : monthStart}T00:00:00.000Z`;
}

/** The food floor pads the session floor by two days: meals bucket by their
 *  OWN local civil day, so a window-opening local day can hold entries whose
 *  UTC occurredAt precedes the UTC window boundary. */
function foodQueryFrom(nowIso: string): string {
  return new Date(Date.parse(sessionQueryFrom(nowIso)) - 2 * 86_400_000).toISOString();
}

function isNutritionFace(face: BehaviorFace): boolean {
  return face.measure.type === 'days' || face.measure.type === 'share';
}

export function useBenchmarkStatuses(
  trendPoints: WeightTrendPoint[],
  measured: ExpenditureWindow | null = null
): {
  entries: BenchmarkStatusEntry[];
  reload: () => void;
} {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [sessions, setSessions] = useState<ObservationOf<'session'>[]>([]);
  const [foodEntries, setFoodEntries] = useState<ObservationOf<'foodEntry'>[]>([]);

  const reload = useCallback(() => {
    let cancelled = false;
    (async () => {
      const active = await listBenchmarks({ status: 'active' });
      const pinned = active.filter((b) => b.pinned);
      const nowIso = new Date().toISOString();
      const needSessions = pinned.some((b) => b.behavior && !isNutritionFace(b.behavior));
      const needFood = pinned.some((b) => b.behavior && isNutritionFace(b.behavior));
      const [sessionRows, foodRows] = await Promise.all([
        needSessions
          ? listObservations({ from: sessionQueryFrom(nowIso), kinds: ['session'] })
          : Promise.resolve([]),
        needFood
          ? listObservations({ from: foodQueryFrom(nowIso), kinds: ['foodEntry'] })
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setBenchmarks(pinned);
      setSessions(sessionRows.filter((o): o is ObservationOf<'session'> => isKind(o, 'session')));
      setFoodEntries(
        foodRows.filter((o): o is ObservationOf<'foodEntry'> => isKind(o, 'foodEntry'))
      );
    })().catch(() => {
      // A failed load renders no cards — Today stays quiet rather than wrong.
      if (!cancelled) setBenchmarks([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  const nowIso = new Date().toISOString();
  const todayDate = todayLocalDate();
  const entries = benchmarks.map((b) => ({
    benchmark: b,
    behavior: b.behavior
      ? isNutritionFace(b.behavior)
        ? nutritionBehaviorStatus(b.behavior, foodEntries, nowIso, todayDate)
        : behaviorStatus(b.behavior, sessions, nowIso)
      : null,
    outcome: b.outcome ? outcomeStatus(b.outcome, trendPoints, measured) : null,
  }));

  return { entries, reload };
}
