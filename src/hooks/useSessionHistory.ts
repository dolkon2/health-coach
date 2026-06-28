/**
 * useSessionHistory — recent logged sessions for the Training tab, newest first.
 *
 * Mirrors useTodayObservations but widens the window (last year by default) and
 * filters to sessions, then reverses to newest-first for a history feed. Exposes
 * reload() so the tab can re-fetch on focus — after the logger saves or a
 * swipe-delete (same pattern Today uses).
 */
import { useCallback, useEffect, useState } from 'react';
import type { ObservationOf } from '@core/observation';
import { isKind } from '@core/observation';
import { listObservations } from '@/storage/observations';
import { daysAgoUtc } from '@/lib/date';

const WINDOW_DAYS = 365;

type SessionHistory = {
  sessions: ObservationOf<'session'>[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

export function useSessionHistory(windowDays: number = WINDOW_DAYS): SessionHistory {
  const [sessions, setSessions] = useState<ObservationOf<'session'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listObservations({ from: daysAgoUtc(windowDays), kinds: ['session'] })
      .then((rows) => {
        if (cancelled) return;
        // listObservations orders ascending; a history feed reads newest first.
        const ordered = rows
          .filter((o): o is ObservationOf<'session'> => isKind(o, 'session'))
          .reverse();
        setSessions(ordered);
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
  }, [windowDays]);

  useEffect(() => reload(), [reload]);

  return { sessions, loading, error, reload };
}
