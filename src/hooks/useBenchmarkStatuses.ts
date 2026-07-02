/**
 * useBenchmarkStatuses — Today's pinned benchmarks with their face statuses
 * (Phase 5 Pass 3).
 *
 * Loads active+pinned benchmarks, plus one sessions query wide enough for the
 * widest window any behavior face uses (min of ISO-week start and month
 * start); the pure lib applies each face's exact range. Trend points are
 * passed IN from the screen's existing useWeightTrend — the outcome face
 * reads the same smoothed series the chart renders, and Today never queries
 * weigh-ins twice.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Benchmark } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import { isKind } from '@core/observation';
import { isoWeekStart } from '@core/stimulus';
import { listBenchmarks } from '@/storage/benchmarks';
import { listObservations } from '@/storage/observations';
import {
  behaviorStatus,
  outcomeStatus,
  type BehaviorStatus,
  type OutcomeStatus,
} from '@/lib/benchmarkStatus';

export type BenchmarkStatusEntry = {
  benchmark: Benchmark;
  behavior: BehaviorStatus | null;
  outcome: OutcomeStatus | null;
};

/** Query floor: whichever of this ISO week / this calendar month starts earlier. */
function sessionQueryFrom(nowIso: string): string {
  const day = nowIso.slice(0, 10);
  const weekStart = isoWeekStart(day);
  const monthStart = `${day.slice(0, 7)}-01`;
  return `${weekStart < monthStart ? weekStart : monthStart}T00:00:00Z`;
}

export function useBenchmarkStatuses(trendPoints: WeightTrendPoint[]): {
  entries: BenchmarkStatusEntry[];
  reload: () => void;
} {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [sessions, setSessions] = useState<ObservationOf<'session'>[]>([]);

  const reload = useCallback(() => {
    let cancelled = false;
    (async () => {
      const active = await listBenchmarks({ status: 'active' });
      const pinned = active.filter((b) => b.pinned);
      const needSessions = pinned.some((b) => b.behavior);
      const rows = needSessions
        ? await listObservations({ from: sessionQueryFrom(new Date().toISOString()), kinds: ['session'] })
        : [];
      if (cancelled) return;
      setBenchmarks(pinned);
      setSessions(rows.filter((o): o is ObservationOf<'session'> => isKind(o, 'session')));
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
  const entries = benchmarks.map((b) => ({
    benchmark: b,
    behavior: b.behavior ? behaviorStatus(b.behavior, sessions, nowIso) : null,
    outcome: b.outcome ? outcomeStatus(b.outcome, trendPoints) : null,
  }));

  return { entries, reload };
}
