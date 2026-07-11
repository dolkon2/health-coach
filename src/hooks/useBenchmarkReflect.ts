/**
 * useBenchmarkReflect — the benchmark lens over Reflect (Phase 5 Pass 4;
 * nutrition family in the expenditure build, Pass F).
 *
 * Loads ACTIVE benchmarks — not just pinned ones. The pin gates Today
 * ("Pin to Today"); the spec's lifecycle table says active *frames Reflect*
 * regardless (benchmarks-spec.md, "Lifecycle"). The lens defaults to the
 * first benchmark with a measured story (defaultLensId) and the user can
 * switch it; switching recomposes the tab — that recomposition is what earns
 * the name "Reflect".
 *
 * One observations query per data family, floored at the OLDEST rhythm window
 * of the current lens: sessions for a countable session face, food entries
 * (padded for local-day bucketing) for a nutrition face. Trend points and the
 * measured expenditure window are passed in from the screen — Reflect never
 * queries the same data twice.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Benchmark } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import type { ExpenditureWindow } from '@core/expenditure';
import { isKind } from '@core/observation';
import { listBenchmarks } from '@/storage/benchmarks';
import { listObservations } from '@/storage/observations';
import { todayLocalDate } from '@/lib/date';
import { outcomeStatus, type OutcomeStatus } from '@/lib/benchmarkStatus';
import {
  defaultLensId,
  heroFaceOf,
  pastWindowRanges,
  behaviorWindowCounts,
  nutritionWindowCounts,
  consecutiveAtTarget,
  currentWindowDayGrid,
  type WindowCount,
  type DayCell,
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
  /** The revealed run — consecutive verdict-revealed windows at target. */
  run: number;
  /** The current window, one cell per day. Null unless the behavior face is a 'days' measure. */
  dayGrid: DayCell[] | null;
  /** Observed movement of the outcome face. Null when the lens has no outcome face. */
  outcome: OutcomeStatus | null;
};

function rhythmN(window: 'week' | 'month'): number {
  return window === 'week' ? RHYTHM_WEEKS : RHYTHM_MONTHS;
}

export function useBenchmarkReflect(
  trendPoints: WeightTrendPoint[],
  measured: ExpenditureWindow | null = null
): {
  benchmarks: Benchmark[];
  lens: BenchmarkLens | null;
  lensId: string | null;
  setLensId: (id: string) => void;
  reload: () => void;
} {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [sessions, setSessions] = useState<ObservationOf<'session'>[]>([]);
  const [foodEntries, setFoodEntries] = useState<ObservationOf<'foodEntry'>[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);

  const lensId = useMemo(() => {
    if (chosenId && benchmarks.some((b) => b.id === chosenId)) return chosenId;
    return defaultLensId(benchmarks);
  }, [benchmarks, chosenId]);

  const lensBenchmark = benchmarks.find((b) => b.id === lensId) ?? null;
  const face = lensBenchmark?.behavior;
  const needSessions = face != null && face.measure.type === 'count';
  const needFood =
    face != null && (face.measure.type === 'days' || face.measure.type === 'share');
  // Primitive re-fetch key: the observations floor moves only when the lens's
  // window shape does, not on every render's new object identities.
  const rhythmFloor =
    face != null && (needSessions || needFood)
      ? pastWindowRanges(face.window, new Date().toISOString(), rhythmN(face.window))[0].fromIso
      : null;
  const sessionsFloor = needSessions ? rhythmFloor : null;
  // Food pads the floor by two days: meals bucket by their OWN local civil
  // day, which can precede the UTC window boundary.
  const foodFloor =
    needFood && rhythmFloor
      ? new Date(Date.parse(rhythmFloor) - 2 * 86_400_000).toISOString()
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

  useEffect(() => {
    if (!foodFloor) {
      setFoodEntries([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await listObservations({ from: foodFloor, kinds: ['foodEntry'] });
      if (cancelled) return;
      setFoodEntries(rows.filter((o): o is ObservationOf<'foodEntry'> => isKind(o, 'foodEntry')));
    })().catch(() => {
      if (!cancelled) setFoodEntries([]);
    });
    return () => {
      cancelled = true;
    };
  }, [foodFloor]);

  const lens = useMemo((): BenchmarkLens | null => {
    if (!lensBenchmark) return null;
    const nowIso = new Date().toISOString();
    const beh = lensBenchmark.behavior;
    const counts =
      beh != null
        ? beh.measure.type === 'days' || beh.measure.type === 'share'
          ? nutritionWindowCounts(beh, foodEntries, nowIso, rhythmN(beh.window), todayLocalDate())
          : behaviorWindowCounts(beh, sessions, nowIso, rhythmN(beh.window))
        : null;
    return {
      benchmark: lensBenchmark,
      hero: heroFaceOf(lensBenchmark),
      windowCounts: counts,
      run: counts ? consecutiveAtTarget(counts) : 0,
      dayGrid: beh ? currentWindowDayGrid(beh, foodEntries, nowIso, todayLocalDate()) : null,
      outcome: lensBenchmark.outcome
        ? outcomeStatus(lensBenchmark.outcome, trendPoints, measured)
        : null,
    };
  }, [lensBenchmark, sessions, foodEntries, trendPoints, measured]);

  return { benchmarks, lens, lensId, setLensId: setChosenId, reload };
}
