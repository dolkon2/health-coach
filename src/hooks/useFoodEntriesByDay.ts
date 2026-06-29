/**
 * useFoodEntriesByDay — food observations for a set of local civil days.
 *
 * The Nutrition tab's Pass 2 (history) hook. Given the visible week's dates
 * plus any currently-selected past day, returns:
 *   - `entriesByDay` — Map<LocalDate, FoodObs[]>, only days the caller asked
 *     for; days with no food are absent from the map (caller renders empty).
 *   - `daysWithFood` — Set<LocalDate> for the week-strip's dot signal; the
 *     keys of `entriesByDay`, surfaced separately so callers don't iterate.
 *
 * One query for the whole batch: `listObservations({ kinds:['foodEntry'], from, to })`
 * with a `paddedDayWindow`-derived UTC range. Post-filtering uses each
 * observation's stored `tz` via `localDayOf` so a late-night meal logged in a
 * different zone lands on the day it was actually eaten (data-model principle 4).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LocalDate, ObservationOf } from '@core/observation';
import { localDayOf } from '@core/timeline';
import { listObservations } from '@/storage/observations';
import { paddedDayWindow } from '@/lib/date';

type FoodObs = ObservationOf<'foodEntry'>;

export type FoodEntriesByDay = {
  entriesByDay: ReadonlyMap<LocalDate, FoodObs[]>;
  daysWithFood: ReadonlySet<LocalDate>;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

export function useFoodEntriesByDay(
  localDates: ReadonlyArray<LocalDate>
): FoodEntriesByDay {
  const [entries, setEntries] = useState<FoodObs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Stable key over the date *set*, so a caller passing a fresh array each
  // render with the same contents doesn't re-fetch.
  const dateKey = useMemo(() => [...localDates].sort().join('|'), [localDates]);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    if (localDates.length === 0) {
      setEntries([]);
      setError(null);
      setLoading(false);
      return;
    }
    const { startUtc, endUtc } = paddedDayWindow(localDates);
    listObservations({ from: startUtc, to: endUtc, kinds: ['foodEntry'] })
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows as FoodObs[]);
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
    // dateKey is the canonical fingerprint of localDates; depending on the
    // array reference would re-fetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  useEffect(() => reload(), [reload]);

  const requested = useMemo(
    () => new Set(localDates),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKey]
  );

  const { entriesByDay, daysWithFood } = useMemo(() => {
    const byDay = new Map<LocalDate, FoodObs[]>();
    const has = new Set<LocalDate>();
    for (const o of entries) {
      const day = localDayOf(o.occurredAt, o.tz);
      if (!requested.has(day)) continue;
      const arr = byDay.get(day);
      if (arr) arr.push(o);
      else byDay.set(day, [o]);
      has.add(day);
    }
    return { entriesByDay: byDay, daysWithFood: has };
  }, [entries, requested]);

  return { entriesByDay, daysWithFood, loading, error, reload };
}
