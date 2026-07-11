/**
 * useBenchmarkDetail — a single benchmark's lens, by id, at ANY status
 * (benchmarks-templates.md B2). useBenchmarkReflect only ever loads ACTIVE
 * benchmarks (Reflect's framing rule); the detail sheet must also open on a
 * paused/achieved/abandoned one from the management list, so this hook reads
 * getBenchmarkById directly and reuses the same pure window/rhythm math
 * (lib/benchmarkReflect.ts) rather than duplicating it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Benchmark } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import type { ExpenditureWindow } from '@core/expenditure';
import { isKind } from '@core/observation';
import { getBenchmarkById } from '@/storage/benchmarks';
import { listObservations } from '@/storage/observations';
import { daysAgoUtc, todayLocalDate } from '@/lib/date';
import {
  behaviorStatus,
  nutritionBehaviorStatus,
  outcomeStatus,
  type BehaviorStatus,
  type OutcomeStatus,
} from '@/lib/benchmarkStatus';
import {
  heroFaceOf,
  pastWindowRanges,
  behaviorWindowCounts,
  nutritionWindowCounts,
  consecutiveAtTarget,
  currentWindowDayGrid,
  type WindowCount,
  type DayCell,
} from '@/lib/benchmarkReflect';
import { RHYTHM_MONTHS, RHYTHM_WEEKS } from './useBenchmarkReflect';

const LONG_WINDOW_DAYS = 365; // exerciseLoad/breathRetention/romMeasurement history

export type BenchmarkLens = {
  benchmark: Benchmark;
  hero: 'outcome' | 'behavior';
  windowCounts: WindowCount[] | null;
  run: number;
  dayGrid: DayCell[] | null;
  /** The current window's status — same line the Home card renders. */
  behavior: BehaviorStatus | null;
  outcome: OutcomeStatus | null;
};

function rhythmN(window: 'week' | 'month'): number {
  return window === 'week' ? RHYTHM_WEEKS : RHYTHM_MONTHS;
}

export function useBenchmarkDetail(
  benchmarkId: string | null,
  trendPoints: WeightTrendPoint[],
  measured: ExpenditureWindow | null = null
): {
  benchmark: Benchmark | null;
  lens: BenchmarkLens | null;
  loading: boolean;
  reload: () => void;
} {
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<ObservationOf<'session'>[]>([]);
  const [foodEntries, setFoodEntries] = useState<ObservationOf<'foodEntry'>[]>([]);
  const [longSessions, setLongSessions] = useState<ObservationOf<'session'>[]>([]);
  const [romReadings, setRomReadings] = useState<ObservationOf<'romReading'>[]>([]);

  const reload = useCallback(() => {
    if (!benchmarkId) {
      setBenchmark(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const b = await getBenchmarkById(benchmarkId);
      if (cancelled) return;
      setBenchmark(b);

      const face = b?.behavior;
      const needLongSessions =
        b?.outcome?.dimension.metric === 'exerciseLoad' ||
        b?.outcome?.dimension.metric === 'breathRetention';
      const needRom = b?.outcome?.dimension.metric === 'romMeasurement';

      const [longSessionRows, romRows] = await Promise.all([
        needLongSessions
          ? listObservations({ from: daysAgoUtc(LONG_WINDOW_DAYS), kinds: ['session'] })
          : Promise.resolve([]),
        needRom
          ? listObservations({ from: daysAgoUtc(LONG_WINDOW_DAYS), kinds: ['romReading'] })
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setLongSessions(
        longSessionRows.filter((o): o is ObservationOf<'session'> => isKind(o, 'session'))
      );
      setRomReadings(
        romRows.filter((o): o is ObservationOf<'romReading'> => isKind(o, 'romReading'))
      );

      if (!face) {
        setSessions([]);
        setFoodEntries([]);
        return;
      }
      const floor = pastWindowRanges(face.window, new Date().toISOString(), rhythmN(face.window))[0]
        .fromIso;
      if (face.measure.type === 'days' || face.measure.type === 'share') {
        const foodFloor = new Date(Date.parse(floor) - 2 * 86_400_000).toISOString();
        const rows = await listObservations({ from: foodFloor, kinds: ['foodEntry'] });
        if (cancelled) return;
        setFoodEntries(rows.filter((o): o is ObservationOf<'foodEntry'> => isKind(o, 'foodEntry')));
        setSessions([]);
      } else if (face.measure.type === 'count') {
        const rows = await listObservations({ from: floor, kinds: ['session'] });
        if (cancelled) return;
        setSessions(rows.filter((o): o is ObservationOf<'session'> => isKind(o, 'session')));
        setFoodEntries([]);
      } else {
        setSessions([]);
        setFoodEntries([]);
      }
    })()
      .catch(() => {
        if (!cancelled) setBenchmark(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [benchmarkId]);

  useEffect(() => reload(), [reload]);

  const lens = useMemo((): BenchmarkLens | null => {
    if (!benchmark) return null;
    const nowIso = new Date().toISOString();
    const beh = benchmark.behavior;
    const counts =
      beh != null
        ? beh.measure.type === 'days' || beh.measure.type === 'share'
          ? nutritionWindowCounts(beh, foodEntries, nowIso, rhythmN(beh.window), todayLocalDate())
          : beh.measure.type === 'count'
            ? behaviorWindowCounts(beh, sessions, nowIso, rhythmN(beh.window))
            : null
        : null;
    const behavior =
      beh == null
        ? null
        : beh.measure.type === 'days' || beh.measure.type === 'share'
          ? nutritionBehaviorStatus(beh, foodEntries, nowIso, todayLocalDate())
          : behaviorStatus(beh, sessions, nowIso);
    return {
      benchmark,
      hero: heroFaceOf(benchmark),
      windowCounts: counts,
      run: counts ? consecutiveAtTarget(counts) : 0,
      dayGrid: beh ? currentWindowDayGrid(beh, foodEntries, nowIso, todayLocalDate()) : null,
      behavior,
      outcome: benchmark.outcome
        ? outcomeStatus(benchmark.outcome, trendPoints, measured, longSessions, romReadings)
        : null,
    };
  }, [benchmark, sessions, foodEntries, longSessions, romReadings, trendPoints, measured]);

  return { benchmark, lens, loading, reload };
}
