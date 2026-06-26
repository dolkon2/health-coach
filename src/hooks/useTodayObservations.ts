/**
 * useTodayObservations — today's local-day observations from storage.
 *
 * Queries the storage layer for the user's current civil day (data-model
 * principle 4) and exposes a `reload()` so a screen can re-fetch after a modal
 * writes a new Observation. Returns the full list plus the two derived slices
 * Today renders — the latest weigh-in and today's sessions — so neither needs a
 * separate query (Pass 4 reuses this rather than re-fetching).
 */
import { useCallback, useEffect, useState } from 'react';
import type { Observation, ObservationOf } from '@core/observation';
import { isKind } from '@core/observation';
import { listObservations } from '@/storage/observations';
import { localDayWindow } from '@/lib/date';

type TodayObservations = {
  observations: Observation[];
  weighInToday: ObservationOf<'weighIn'> | null;
  sessionsToday: ObservationOf<'session'>[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

export function useTodayObservations(): TodayObservations {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const { startUtc, endUtc } = localDayWindow();
    listObservations({ from: startUtc, to: endUtc })
      .then((rows) => {
        if (cancelled) return;
        setObservations(rows);
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

  // Latest weigh-in today (list is ordered ascending, so the last one wins).
  const weighIns = observations.filter((o): o is ObservationOf<'weighIn'> =>
    isKind(o, 'weighIn')
  );
  const weighInToday = weighIns.length > 0 ? weighIns[weighIns.length - 1] : null;

  // Today's sessions, oldest first (the query already orders by occurredAt asc).
  const sessionsToday = observations.filter((o): o is ObservationOf<'session'> =>
    isKind(o, 'session')
  );

  return { observations, weighInToday, sessionsToday, loading, error, reload };
}
