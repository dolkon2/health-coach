/**
 * useExercisePatternMemory — local-only "remember the pattern I last tagged".
 *
 * Movement pattern is required (the engine needs it), but it should feel like a
 * fact about the exercise, not a tax. So the first time you tag "barbell back
 * squat" as quad-dom, every later session defaults it to quad-dom.
 *
 * The source of truth is the sessions already in storage — no parallel table.
 * We read past lifting sets and keep the most recently logged pattern per
 * exercise name. A never-seen exercise returns null: no suggestion, no
 * fabrication (constitution). Best-effort — a read failure never blocks logging.
 */
import { useCallback, useEffect, useState } from 'react';
import type { MovementPattern, ObservationOf } from '@core/observation';
import { isKind } from '@core/observation';
import { listObservations } from '@/storage/observations';

type PatternMemory = {
  /** The remembered pattern for an exercise name, or null if unseen. */
  suggest: (name: string) => MovementPattern | null;
  reload: () => void;
};

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function useExercisePatternMemory(): PatternMemory {
  const [byName, setByName] = useState<Record<string, MovementPattern>>({});

  const reload = useCallback(() => {
    let cancelled = false;
    listObservations({ kinds: ['session'] })
      .then((rows) => {
        if (cancelled) return;
        const sessions = rows.filter((o): o is ObservationOf<'session'> =>
          isKind(o, 'session')
        );
        // Ascending by occurredAt, so later sessions overwrite earlier ones —
        // the most recent tag for a name wins.
        const map: Record<string, MovementPattern> = {};
        for (const s of sessions) {
          for (const set of s.payload.lifting?.sets ?? []) {
            const key = normalize(set.exercise);
            if (key) map[key] = set.movementPattern;
          }
        }
        setByName(map);
      })
      .catch(() => {
        // Memory is a convenience; never let it break the log flow.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  const suggest = useCallback(
    (name: string): MovementPattern | null => {
      const key = normalize(name);
      return key ? byName[key] ?? null : null;
    },
    [byName]
  );

  return { suggest, reload };
}
