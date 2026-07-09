/**
 * useLadderProgress — calisthenics skill-ladder progress, from the engine.
 *
 * Resolves logged lifting sets whose exerciseId is a ladder-step id (the
 * vendored dataset, src/data/ladders.ts) into per-day occurrences, grabs the
 * smoothed weight trend for the loadable-step load ratio (core/trend.ts), and
 * runs both through core/ladderTrend.ts — one pass over sessions covers every
 * chain at once rather than a query per chain. Only chains the user has
 * actually logged appear; a never-touched chain is simply absent, never a
 * fabricated zero (constitution).
 */
import { useCallback, useEffect, useState } from 'react';
import type { ObservationOf } from '@core/observation';
import { isKind } from '@core/observation';
import { dayKey } from '@core/timeline';
import {
  computeLadderChainTrend,
  currentLadderStep,
  type LadderChainTrendPoint,
  type LadderStepOccurrence,
} from '@core/ladderTrend';
import { computeWeightTrend } from '@core/trend';
import { listObservations } from '@/storage/observations';
import { ladderChains, ladderStepById } from '@/data/ladders';
import { daysAgoUtc } from '@/lib/date';

const WINDOW_DAYS = 365;

export type ChainProgress = {
  chainId: string;
  chainName: string;
  stepName: string;
  points: LadderChainTrendPoint[];
  current: LadderChainTrendPoint;
};

export type LadderProgress = {
  /** Only chains with at least one logged occurrence, in dataset order. */
  chains: ChainProgress[];
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

/** Nearest trend point at-or-before a date — trend points are sparse (one per
 *  weigh-in day), so an exact-day miss falls back to the closest earlier one.
 *  `points` is already date-ascending (computeWeightTrend's contract). */
function trendLookup(points: Array<{ date: string; trendKg: number }>) {
  const byDate = new Map(points.map((p) => [p.date, p.trendKg]));
  const dates = points.map((p) => p.date);
  return (date: string): number | null => {
    if (byDate.has(date)) return byDate.get(date)!;
    let best: string | null = null;
    for (const d of dates) {
      if (d <= date) best = d;
      else break;
    }
    return best ? byDate.get(best)! : null;
  };
}

export function useLadderProgress(): LadderProgress {
  const [chains, setChains] = useState<ChainProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listObservations({ from: daysAgoUtc(WINDOW_DAYS), kinds: ['session'] }),
      listObservations({ from: daysAgoUtc(WINDOW_DAYS), kinds: ['weighIn'] }),
    ])
      .then(([sessionRows, weighInRows]) => {
        if (cancelled) return;
        const sessions = sessionRows.filter((o): o is ObservationOf<'session'> =>
          isKind(o, 'session')
        );
        const weighIns = weighInRows.filter((o): o is ObservationOf<'weighIn'> =>
          isKind(o, 'weighIn')
        );
        const trendBodyweightKgAt = trendLookup(computeWeightTrend(weighIns));

        // Group every ladder-step set by (chainId, day, stepId) in one pass.
        const byChain = new Map<string, Map<string, LadderStepOccurrence>>();
        for (const s of sessions) {
          const date = dayKey(s.occurredAt);
          for (const set of s.payload.lifting?.sets ?? []) {
            if (!set.exerciseId) continue;
            const resolved = ladderStepById(set.exerciseId);
            if (!resolved) continue;
            const occByKey = byChain.get(resolved.chain.id) ?? new Map();
            byChain.set(resolved.chain.id, occByKey);
            const key = `${date}::${set.exerciseId}`;
            const entry = occByKey.get(key) ?? { date, stepId: set.exerciseId, sets: [] };
            entry.sets.push({ reps: set.reps, holdSec: set.holdSec, weightKg: set.weightKg });
            occByKey.set(key, entry);
          }
        }

        const result: ChainProgress[] = [];
        for (const chain of ladderChains()) {
          const occurrences = byChain.get(chain.id);
          if (!occurrences || occurrences.size === 0) continue;
          const points = computeLadderChainTrend(chain, [...occurrences.values()], trendBodyweightKgAt);
          const current = currentLadderStep(points);
          if (!current) continue;
          const step = chain.steps[current.stepIndex];
          result.push({
            chainId: chain.id,
            chainName: chain.name,
            stepName: step?.name ?? current.stepId,
            points,
            current,
          });
        }
        setChains(result);
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

  return { chains, loading, error, reload };
}
