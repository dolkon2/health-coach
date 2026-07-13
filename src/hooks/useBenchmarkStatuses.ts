/**
 * useBenchmarkStatuses — Today's pinned benchmarks with their face statuses
 * (Phase 5 Pass 3; nutrition family in the expenditure build, Pass F; Body
 * dimensions in the Body build, P6).
 *
 * Loads active+pinned benchmarks, plus one sessions query wide enough for the
 * widest window any behavior face uses (min of ISO-week start and month
 * start); the pure lib applies each face's exact range. A food query (same
 * floor, padded for local-day bucketing) runs only when a pinned benchmark
 * carries a nutrition face. Trend points are passed IN from the screen's
 * existing useWeightTrend, and the measured expenditure window from its
 * useExpenditure — the outcome faces read the same numbers those surfaces
 * render; Today never queries the same data twice.
 *
 * Body P6 adds three more conditional queries, each gated on whether a
 * pinned benchmark actually needs it (the existing needSessions/needFood
 * pattern, extended, not replaced):
 *   - a LONG-window session query for exerciseLoad/breathRetention outcomes
 *     (a week-start floor is nowhere near enough e1RM/retention history);
 *   - a romReading query for romMeasurement outcomes;
 *   - a protocols + rolling-7d protocolTick query for protocolAdherence.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Benchmark, BehaviorFace } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import type { ExpenditureWindow } from '@core/expenditure';
import { isKind } from '@core/observation';
import { isoWeekStart } from '@core/stimulus';
import { listBenchmarks } from '@/storage/benchmarks';
import { pausedBenchmarkIds } from '@/storage/benchmarkGroups';
import { listObservations } from '@/storage/observations';
import { listProtocolTicks } from '@/storage/protocolTicks';
import { getUserProtocols } from '@/storage/settings';
import type { UserProtocol } from '@/lib/protocols';
import { daysAgoUtc, todayLocalDate } from '@/lib/date';
import {
  behaviorStatus,
  nutritionBehaviorStatus,
  outcomeStatus,
  protocolAdherenceStatus,
  type BehaviorStatus,
  type OutcomeStatus,
} from '@/lib/benchmarkStatus';

export type BenchmarkStatusEntry = {
  benchmark: Benchmark;
  behavior: BehaviorStatus | null;
  outcome: OutcomeStatus | null;
};

const LONG_WINDOW_DAYS = 365; // exerciseLoad/breathRetention/romMeasurement history
const ADHERENCE_WINDOW_DAYS = 7; // protocolAdherence's fixed rolling window

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

type BehaviorFaceRoute = 'session' | 'nutrition' | 'protocolAdherence';

/** Which status function a behavior face routes to. Body P6 extends this by
 *  dimension.metric (protocolAdherence has no measure.type of its own — its
 *  window is a fixed rolling-7d, not the user-chosen week/month the other
 *  routes key on), the nutrition split stays keyed on measure.type as before. */
function behaviorFaceRoute(face: BehaviorFace): BehaviorFaceRoute {
  if (face.dimension.metric === 'protocolAdherence') return 'protocolAdherence';
  if (face.measure.type === 'days' || face.measure.type === 'share') return 'nutrition';
  return 'session';
}

function needsLongSessionHistory(b: Benchmark): boolean {
  return (
    b.outcome?.dimension.metric === 'exerciseLoad' || b.outcome?.dimension.metric === 'breathRetention'
  );
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
  const [longSessions, setLongSessions] = useState<ObservationOf<'session'>[]>([]);
  const [romReadings, setRomReadings] = useState<ObservationOf<'romReading'>[]>([]);
  const [protocols, setProtocols] = useState<UserProtocol[]>([]);
  const [adherenceTicksByProtocol, setAdherenceTicksByProtocol] = useState<
    Record<string, Record<string, number>>
  >({});

  const reload = useCallback(() => {
    let cancelled = false;
    (async () => {
      const [active, paused] = await Promise.all([
        listBenchmarks({ status: 'active' }),
        pausedBenchmarkIds(),
      ]);
      // The group-pause framing effect: a paused group drops its members from
      // Today's glance without touching their own pinned/status row.
      const pinned = active.filter((b) => b.pinned && !paused.has(b.id));
      const nowIso = new Date().toISOString();
      const needSessions = pinned.some(
        (b) => b.behavior && behaviorFaceRoute(b.behavior) === 'session'
      );
      const needFood = pinned.some(
        (b) => b.behavior && behaviorFaceRoute(b.behavior) === 'nutrition'
      );
      const needLongSessions = pinned.some(needsLongSessionHistory);
      const needRom = pinned.some((b) => b.outcome?.dimension.metric === 'romMeasurement');
      const needProtocols = pinned.some(
        (b) => b.behavior && behaviorFaceRoute(b.behavior) === 'protocolAdherence'
      );

      const [sessionRows, foodRows, longSessionRows, romRows, protocolList, tickRows] =
        await Promise.all([
          needSessions
            ? listObservations({ from: sessionQueryFrom(nowIso), kinds: ['session'] })
            : Promise.resolve([]),
          needFood
            ? listObservations({ from: foodQueryFrom(nowIso), kinds: ['foodEntry'] })
            : Promise.resolve([]),
          needLongSessions
            ? listObservations({ from: daysAgoUtc(LONG_WINDOW_DAYS), kinds: ['session'] })
            : Promise.resolve([]),
          needRom
            ? listObservations({ from: daysAgoUtc(LONG_WINDOW_DAYS), kinds: ['romReading'] })
            : Promise.resolve([]),
          needProtocols ? getUserProtocols() : Promise.resolve([]),
          needProtocols
            ? listProtocolTicks({ from: daysAgoUtc(ADHERENCE_WINDOW_DAYS) })
            : Promise.resolve([]),
        ]);
      if (cancelled) return;

      const ticksByProtocol: Record<string, Record<string, number>> = {};
      for (const tick of tickRows) {
        const { protocolId, exerciseId } = tick.payload;
        if (!protocolId || !exerciseId) continue;
        const byExercise = ticksByProtocol[protocolId] ?? {};
        byExercise[exerciseId] = (byExercise[exerciseId] ?? 0) + 1;
        ticksByProtocol[protocolId] = byExercise;
      }

      setBenchmarks(pinned);
      setSessions(sessionRows.filter((o): o is ObservationOf<'session'> => isKind(o, 'session')));
      setFoodEntries(
        foodRows.filter((o): o is ObservationOf<'foodEntry'> => isKind(o, 'foodEntry'))
      );
      setLongSessions(
        longSessionRows.filter((o): o is ObservationOf<'session'> => isKind(o, 'session'))
      );
      setRomReadings(
        romRows.filter((o): o is ObservationOf<'romReading'> => isKind(o, 'romReading'))
      );
      setProtocols(protocolList);
      setAdherenceTicksByProtocol(ticksByProtocol);
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
  const entries = benchmarks.map((b) => {
    let behavior: BehaviorStatus | null = null;
    if (b.behavior) {
      const route = behaviorFaceRoute(b.behavior);
      if (route === 'protocolAdherence' && b.behavior.dimension.metric === 'protocolAdherence') {
        const wantProtocolId = b.behavior.dimension.protocolId;
        const protocol = protocols.find((p) => p.id === wantProtocolId);
        behavior = protocol
          ? protocolAdherenceStatus(protocol, adherenceTicksByProtocol[protocol.id] ?? {})
          : null; // the referenced protocol is gone (archived/deleted) — no card, not a fabricated 0
      } else if (route === 'nutrition') {
        behavior = nutritionBehaviorStatus(b.behavior, foodEntries, nowIso, todayDate);
      } else {
        behavior = behaviorStatus(b.behavior, sessions, nowIso);
      }
    }
    const outcome = b.outcome
      ? outcomeStatus(
          b.outcome,
          trendPoints,
          measured,
          needsLongSessionHistory(b) ? longSessions : [],
          romReadings
        )
      : null;
    return { benchmark: b, behavior, outcome };
  });

  return { entries, reload };
}
