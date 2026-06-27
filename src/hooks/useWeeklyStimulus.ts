/**
 * useWeeklyStimulus — the Reflect ledger's data, from the engine.
 *
 * Pulls recent session Observations, runs them through core/stimulus.ts, then
 * windows the result into a fixed display range: the current ISO week + 7 prior
 * (8 bars), padding weeks with no sessions so the timeline is honest about gaps.
 *
 * The split mirrors useWeightTrend: the *engine* (computeWeeklyStimulus) reports
 * only weeks that have data and stays free of "now"; the *hook* owns the
 * relative-to-today windowing and the empty-week padding. Also returns the
 * underlying sessions keyed by id so the ledger's drill-down can render each
 * contributing session's reveal() line without a second fetch.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ObservationId, ObservationOf, LocalDate } from '@core/observation';
import { isKind } from '@core/observation';
import { computeWeeklyStimulus, isoWeekStart, type StimulusLedgerWeek } from '@core/stimulus';
import { listObservations } from '@/storage/observations';
import { daysAgoUtc } from '@/lib/date';

export const LEDGER_WEEKS = 8; // current week + 7 prior
// Enough slack to cover 8 ISO weeks back from any weekday (8*7 = 56, + boundary).
const WINDOW_DAYS = 70;

export type WeeklyStimulus = {
  weeks: StimulusLedgerWeek[]; // exactly LEDGER_WEEKS, oldest first
  sessionsById: Map<ObservationId, ObservationOf<'session'>>;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

/** The 8 ISO-week Mondays ending at this week, oldest first. */
function recentWeekStarts(count: number, now: Date = new Date()): LocalDate[] {
  const thisMonday = isoWeekStart(now.toISOString().slice(0, 10));
  const base = new Date(`${thisMonday}T00:00:00Z`);
  const starts: LocalDate[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - i * 7);
    starts.push(d.toISOString().slice(0, 10));
  }
  return starts;
}

function emptyWeek(weekStart: LocalDate): StimulusLedgerWeek {
  return {
    weekStart,
    byPattern: {} as StimulusLedgerWeek['byPattern'],
    byEnergySystem: {
      aerobic: { minutes: 0 },
      glycolytic: { minutes: 0 },
      mixed: { minutes: 0 },
    },
    sessionIds: [],
  };
}

export function useWeeklyStimulus(): WeeklyStimulus {
  const [weeks, setWeeks] = useState<StimulusLedgerWeek[]>(() =>
    recentWeekStarts(LEDGER_WEEKS).map(emptyWeek)
  );
  const [sessionsById, setSessionsById] = useState<
    Map<ObservationId, ObservationOf<'session'>>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listObservations({ from: daysAgoUtc(WINDOW_DAYS), kinds: ['session'] })
      .then((rows) => {
        if (cancelled) return;
        const sessions = rows.filter((o): o is ObservationOf<'session'> =>
          isKind(o, 'session')
        );

        const computed = computeWeeklyStimulus(sessions);
        const byStart = new Map(computed.map((w) => [w.weekStart, w]));
        setWeeks(
          recentWeekStarts(LEDGER_WEEKS).map(
            (weekStart) => byStart.get(weekStart) ?? emptyWeek(weekStart)
          )
        );
        setSessionsById(new Map(sessions.map((s) => [s.id, s])));
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  return { weeks, sessionsById, loading, error, reload };
}
