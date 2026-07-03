/**
 * useExpenditure — the measured TDEE (the residual), live from storage.
 *
 * Feeds core/expenditure.ts exactly two things: the last 90 days of logged
 * meals (as strict per-day intake — expenditureInputs.ts) and the weight-trend
 * points the caller already computed. `measured` is the engine's latest window
 * that yielded an honest residual, or null — "not enough data yet" is a valid
 * answer the surface renders as such, never a fabricated number.
 *
 * Firewall (spine rule 1): training sessions are NOT an input and never will
 * be. The measured burn already contains them; training is only ever
 * correlated against this number (correlation engine, unbuilt), never fed
 * forward to predict it.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ObservationOf } from '@core/observation';
import { isKind } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import { estimateExpenditure, type ExpenditureReport, type ExpenditureWindow } from '@core/expenditure';
import { listObservations } from '@/storage/observations';
import { dailyIntakeFromEntries } from '@/lib/expenditureInputs';
import { daysAgoUtc } from '@/lib/date';

const INTAKE_WINDOW_DAYS = 90; // matches useWeightTrend's trend span

type Expenditure = {
  report: ExpenditureReport;
  /** The latest window with a measured TDEE; null = not enough data yet. */
  measured: ExpenditureWindow | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

export function useExpenditure(trendPoints: WeightTrendPoint[]): Expenditure {
  const [entries, setEntries] = useState<ObservationOf<'foodEntry'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listObservations({ from: daysAgoUtc(INTAKE_WINDOW_DAYS), kinds: ['foodEntry'] })
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows.filter((o): o is ObservationOf<'foodEntry'> => isKind(o, 'foodEntry')));
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

  const report = estimateExpenditure(trendPoints, dailyIntakeFromEntries(entries));
  return { report, measured: report.latest, loading, error, reload };
}
