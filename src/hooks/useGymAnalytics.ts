/**
 * useGymAnalytics — e1RM trend, PR flags, and this week's muscle-group
 * tonnage, from the engine (core/gymAnalytics.ts). Body P4.
 *
 * One pass over ~365 days of sessions feeds all three: e1RM is grouped per
 * exercise across the whole window; PRs compare the single most recent
 * session against everything before it (the "did today set a new best"
 * question, the one a lift-detail screen actually needs); tonnage sums only
 * the current ISO week. Muscle involvement is resolved here (app data,
 * exerciseLibrary) and passed into the engine per set — a set with no
 * exerciseId link contributes no tonnage, never a guess.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ObservationOf } from '@core/observation';
import { isKind } from '@core/observation';
import { dayKey } from '@core/timeline';
import { isoWeekStart } from '@core/stimulus';
import {
  computeE1rmSeries,
  computeMuscleTonnage,
  detectPRs,
  type E1rmPoint,
  type MuscleGroup,
  type PrFlag,
  type SessionSets,
} from '@core/gymAnalytics';
import { listObservations } from '@/storage/observations';
import { exerciseById } from '@/data/exerciseLibrary';
import { daysAgoUtc } from '@/lib/date';

const WINDOW_DAYS = 365;

export type LiftSummary = {
  exerciseKey: string;
  exercise: string;
  points: E1rmPoint[]; // date-ascending
  // Which PR kind(s) the most recent session earned for this exercise, if
  // any — NOT a single boolean. A reps-at-weight or set-volume PR doesn't
  // mean the displayed e1RM number improved; conflating them into one badge
  // would mislabel the wrong figure as a new best (a code-review catch).
  newPrKinds: PrFlag['kind'][];
};

export type GymAnalytics = {
  lifts: LiftSummary[]; // one per exercise with at least one e1RM point, most-recent-session-first isn't tracked — dataset order
  latestPRs: PrFlag[];
  weeklyTonnage: Partial<Record<MuscleGroup, number>>;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

export function useGymAnalytics(): GymAnalytics {
  const [lifts, setLifts] = useState<LiftSummary[]>([]);
  const [latestPRs, setLatestPRs] = useState<PrFlag[]>([]);
  const [weeklyTonnage, setWeeklyTonnage] = useState<Partial<Record<MuscleGroup, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listObservations({ from: daysAgoUtc(WINDOW_DAYS), kinds: ['session'] })
      .then((rows) => {
        if (cancelled) return;
        const sessions = rows.filter((o): o is ObservationOf<'session'> => isKind(o, 'session'));
        const sessionSets: SessionSets[] = sessions
          .filter((s) => s.payload.lifting != null)
          .map((s) => ({ date: dayKey(s.occurredAt), sets: s.payload.lifting!.sets }));

        // e1RM, grouped per exercise across the whole window.
        const byKey = new Map<string, LiftSummary>();
        for (const p of computeE1rmSeries(sessionSets)) {
          const cur = byKey.get(p.exerciseKey);
          if (cur) cur.points.push(p);
          else byKey.set(p.exerciseKey, { exerciseKey: p.exerciseKey, exercise: p.exercise, points: [p], newPrKinds: [] });
        }

        // PRs: the most recent session vs. everything before it.
        let prs: PrFlag[] = [];
        if (sessionSets.length > 0) {
          const sorted = [...sessionSets].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
          const latest = sorted[sorted.length - 1];
          prs = detectPRs(sorted.slice(0, -1), latest);
          for (const flag of prs) {
            const lift = byKey.get(flag.exerciseKey);
            if (lift) lift.newPrKinds.push(flag.kind);
          }
        }

        // This week's tonnage — resolves each set's muscle involvement from
        // the vendored library; an unlinked (free-typed) exercise is honestly
        // excluded rather than guessed.
        const weekStart = isoWeekStart(dayKey(new Date().toISOString()));
        const weekEntries = sessionSets
          .filter((s) => s.date >= weekStart)
          .flatMap((s) =>
            s.sets.map((set) => {
              const lib = set.exerciseId ? exerciseById(set.exerciseId) : undefined;
              return {
                set,
                muscles: lib ? { primary: lib.primaryMuscles, secondary: lib.secondaryMuscles } : undefined,
              };
            })
          );

        setLifts([...byKey.values()]);
        setLatestPRs(prs);
        setWeeklyTonnage(computeMuscleTonnage(weekEntries));
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

  return { lifts, latestPRs, weeklyTonnage, loading, error, reload };
}
