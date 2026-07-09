/**
 * useExercisePatternMemory — local-only "remember what I did on this exercise
 * last time": the movement pattern (Pass 3 original scope) plus a ghost of the
 * last session's actual sets (Body P3, Strong-style prev-set recall).
 *
 * Movement pattern is required (the engine needs it), but it should feel like a
 * fact about the exercise, not a tax. So the first time you tag "barbell back
 * squat" as quad-dom, every later session defaults it to quad-dom. The same walk
 * also remembers the exact sets from the last time you logged that exercise, so
 * the set table can show them as placeholders — not prefilled values (never
 * fabricate what you did today from what you did last time).
 *
 * The source of truth is the sessions already in storage — no parallel table.
 * We read past lifting sets and keep the most recently logged group per exercise,
 * grouped at SESSION granularity so a repeated exercise across one session
 * collects into one ghost, in logged order. Lookup prefers exerciseId (library/
 * ladder picks — disjoint from free-typed names) and falls back to the
 * normalized exercise name. A never-seen exercise returns null: no suggestion,
 * no fabrication (constitution). Best-effort — a read failure never blocks
 * logging.
 */
import { useCallback, useEffect, useState } from 'react';
import type { LiftingBlock, MovementPattern, ObservationOf } from '@core/observation';
import { isKind } from '@core/observation';
import { listObservations } from '@/storage/observations';

type PatternEntry = {
  pattern: MovementPattern;
  /** The last session's sets for this exercise, in logged order. */
  lastSets: LiftingBlock['sets'];
};

type PatternMemory = {
  /** The remembered pattern for an exercise, or null if unseen. */
  suggest: (name: string, exerciseId?: string) => MovementPattern | null;
  /** The last session's sets for an exercise (ghost placeholders), or null if unseen. */
  lastSets: (name: string, exerciseId?: string) => LiftingBlock['sets'] | null;
  reload: () => void;
};

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function useExercisePatternMemory(): PatternMemory {
  const [byName, setByName] = useState<Record<string, PatternEntry>>({});
  const [byExerciseId, setByExerciseId] = useState<Record<string, PatternEntry>>({});

  const reload = useCallback(() => {
    let cancelled = false;
    listObservations({ kinds: ['session'] })
      .then((rows) => {
        if (cancelled) return;
        const sessions = rows.filter((o): o is ObservationOf<'session'> =>
          isKind(o, 'session')
        );
        // Ascending by occurredAt, so later sessions overwrite earlier ones at
        // SESSION granularity — "last session's sets" falls out free.
        const nameMap: Record<string, PatternEntry> = {};
        const idMap: Record<string, PatternEntry> = {};
        for (const s of sessions) {
          const nameGroups = new Map<string, LiftingBlock['sets']>();
          const idGroups = new Map<string, LiftingBlock['sets']>();
          for (const set of s.payload.lifting?.sets ?? []) {
            const key = normalize(set.exercise);
            if (key) {
              const arr = nameGroups.get(key) ?? [];
              arr.push(set);
              nameGroups.set(key, arr);
            }
            if (set.exerciseId) {
              const arr = idGroups.get(set.exerciseId) ?? [];
              arr.push(set);
              idGroups.set(set.exerciseId, arr);
            }
          }
          for (const [key, sets] of nameGroups) {
            nameMap[key] = { pattern: sets[sets.length - 1].movementPattern, lastSets: sets };
          }
          for (const [id, sets] of idGroups) {
            idMap[id] = { pattern: sets[sets.length - 1].movementPattern, lastSets: sets };
          }
        }
        setByName(nameMap);
        setByExerciseId(idMap);
      })
      .catch(() => {
        // Memory is a convenience; never let it break the log flow.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  const lookup = useCallback(
    (name: string, exerciseId?: string): PatternEntry | null => {
      if (exerciseId && byExerciseId[exerciseId]) return byExerciseId[exerciseId];
      const key = normalize(name);
      return key ? byName[key] ?? null : null;
    },
    [byName, byExerciseId]
  );

  const suggest = useCallback(
    (name: string, exerciseId?: string): MovementPattern | null =>
      lookup(name, exerciseId)?.pattern ?? null,
    [lookup]
  );

  const lastSets = useCallback(
    (name: string, exerciseId?: string): LiftingBlock['sets'] | null =>
      lookup(name, exerciseId)?.lastSets ?? null,
    [lookup]
  );

  return { suggest, lastSets, reload };
}
