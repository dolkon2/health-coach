/**
 * useSpotsGlance — Home's Pinned Spots glance module (H4,
 * home-tab.md §3), capped at 3, "ordered by most-recently-visited". That
 * ordering needs a sessions-at-spot query that doesn't exist yet (P3's
 * listSessionsForSpot) — this hook uses createdAt desc as the honest
 * fallback, same posture as the spots list (app/spots.tsx).
 *
 * Live readings via the display-path conditions module (never the freeze
 * store) — one fetch per glance spot, cached ~10min there.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Spot } from '@core/spot';
import { listSpots } from '@/storage/spots';
import { fetchCurrentForSpots, type CurrentConditions } from '@/lib/conditions/current';
import { sortSpotsByRecency } from '@/lib/spotHeadline';

const GLANCE_CAP = 3;

export function useSpotsGlance(): {
  spots: Spot[];
  current: Record<string, CurrentConditions>;
  reload: () => void;
} {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [current, setCurrent] = useState<Record<string, CurrentConditions>>({});

  const reload = useCallback(() => {
    let cancelled = false;
    (async () => {
      const all = await listSpots();
      const top = sortSpotsByRecency(all).slice(0, GLANCE_CAP);
      if (cancelled) return;
      setSpots(top);
      const byId = await fetchCurrentForSpots(top);
      if (cancelled) return;
      setCurrent(byId);
    })().catch(() => {
      // A failed load renders the zero-spots floor row — quiet, not wrong.
      if (!cancelled) setSpots([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  return { spots, current, reload };
}
