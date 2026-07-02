/**
 * useBenchmarkReflect — the benchmark lens over Reflect (Phase 5 Pass 4).
 *
 * Loads ACTIVE benchmarks — not just pinned ones. The pin gates Today
 * ("Pin to Today"); the spec's lifecycle table says active *frames Reflect*
 * regardless (benchmarks-spec.md, "Lifecycle"). The lens defaults to the
 * first benchmark with a measured story (defaultLensId) and the user can
 * switch it; switching recomposes the tab — that recomposition is what earns
 * the name "Reflect".
 *
 * One sessions query, floored at the OLDEST rhythm window of the current
 * lens, run only when the lens has a countable behavior face. Trend points
 * are passed in from the screen's existing useWeightTrend, same as Today —
 * Reflect never queries weigh-ins twice.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Benchmark } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import { isKind } from '@core/observation';
import { listBenchmarks } from '@/storage/benchmarks';
import { listObservations } from '@/storage/observations';
import { outcomeStatus, type OutcomeStatus } from '@/lib/benchmarkStatus';
import {
  defaultLensId,
  heroFaceOf,
  pastWindowRanges,
  behaviorWindowCounts,
  consecutiveAtTarget,
  type WindowCount,
} from '@/lib/benchmarkReflect';

// How far back the rhythm view reaches: mirrors the stimulus ledger's
// current + 7 prior for weeks; months get a half year.
export const RHYTHM_WEEKS = 8;
export const RHYTHM_MONTHS = 6;

export type BenchmarkLens = {
  benchmark: Benchmark;
  hero: 'outcome' | 'behavior';
  /** Rhythm counts, oldest → newest. Null when the lens has no countable behavior face. */
  windowCounts: WindowCount[] | null;
  /** The revealed run — consecutive complete windows at target. */
  run: number;
  /** Observed movement of the outcome face. Null when the lens has no outcome face. */
  outcome: OutcomeStatus | null;
};

function rhythmN(window: 'week' | 'month'): number {
  return window === 'week' ? RHYTHM_WEEKS : RHYTHM_MONTHS;
}

export function useBenchmarkReflect(trendPoints: WeightTrendPoint[]): {
  benchmarks: Benchmark[];
  lens: BenchmarkLens | null;
  lensId: string | null;
  setLensId: (id: string) => void;
  reload: () => void;
} {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [sessions, setSessions] = useState<ObservationOf<'session'>[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);

  const lensId = useMemo(() => {
    if (chosenId && benchmarks.some((b) => b.id === chosenId)) return chosenId;
    return defaultLensId(benchmarks);
  }, [benchmarks, chosenId]);

  const lensBenchmark = benchmarks.find((b) => b.id === lensId) ?? null;
  const face = lensBenchmark?.behavior;
  const needSessions = face != null && face.measure.type === 'count';
  // Primitive re-fetch key: the sessions floor moves only when the lens's
  // window shape does, not on every render's new object identities.
  const sessionsFloor = needSessions
    ? pastWindowRanges(face.window, new Date().toISOString(), rhythmN(face.window))[0].fromIso
    : null;

  const reload = useCallback(() => {
    let cancelled = false;
    (async () => {
      const active = await listBenchmarks({ status: 'active' });
      if (cancelled) return;
      setBenchmarks(active);
    })().catch(() => {
      // A failed load renders the no-benchmark default — quiet, not wrong.
      if (!cancelled) setBenchmarks([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  useEffect(() => {
    if (!sessionsFloor) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await listObservations({ from: sessionsFloor, kinds: ['session'] });
      if (cancelled) return;
      setSessions(rows.filter((o): o is ObservationOf<'session'> => isKind(o, 'session')));
    })().catch(() => {
      if (!cancelled) setSessions([]);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionsFloor]);

  const lens = useMemo((): BenchmarkLens | null => {
    if (!lensBenchmark) return null;
    const nowIso = new Date().toISOString();
    const counts =
      lensBenchmark.behavior != null
        ? behaviorWindowCounts(
            lensBenchmark.behavior,
            sessions,
            nowIso,
            rhythmN(lensBenchmark.behavior.window)
          )
        : null;
    return {
      benchmark: lensBenchmark,
      hero: heroFaceOf(lensBenchmark),
      windowCounts: counts,
      run: counts ? consecutiveAtTarget(counts) : 0,
      outcome: lensBenchmark.outcome ? outcomeStatus(lensBenchmark.outcome, trendPoints) : null,
    };
  }, [lensBenchmark, sessions, trendPoints]);

  return { benchmarks, lens, lensId, setLensId: setChosenId, reload };
}
