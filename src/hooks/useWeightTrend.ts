/**
 * useWeightTrend — the smoothed weight trend + recent delta, from the engine.
 *
 * Pulls the last 90 days of weigh-ins, runs them through core/trend.ts, and
 * returns the per-day trend points (the smoothed line), the raw weigh-ins (the
 * chart's dots — they carry the actual reading + fidelity the trend points
 * don't), and the 14-day delta (for Today's card). `delta` is null when there
 * isn't enough data — the UI renders no delta rather than inventing a number.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ObservationOf } from '@core/observation';
import { isKind } from '@core/observation';
import {
  computeWeightTrend,
  weightTrendDelta,
  type WeightTrendPoint,
  type WeightTrendDelta,
} from '@core/trend';
import { listObservations } from '@/storage/observations';
import { daysAgoUtc } from '@/lib/date';

const TREND_WINDOW_DAYS = 90;

type WeightTrend = {
  points: WeightTrendPoint[];
  raw: ObservationOf<'weighIn'>[]; // the actual weigh-ins, oldest first — the dots
  delta: WeightTrendDelta | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

export function useWeightTrend(): WeightTrend {
  const [points, setPoints] = useState<WeightTrendPoint[]>([]);
  const [raw, setRaw] = useState<ObservationOf<'weighIn'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listObservations({ from: daysAgoUtc(TREND_WINDOW_DAYS), kinds: ['weighIn'] })
      .then((rows) => {
        if (cancelled) return;
        const weighIns = rows.filter((o): o is ObservationOf<'weighIn'> =>
          isKind(o, 'weighIn')
        );
        setPoints(computeWeightTrend(weighIns));
        setRaw(weighIns);
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

  return { points, raw, delta: weightTrendDelta(points), loading, error, reload };
}
