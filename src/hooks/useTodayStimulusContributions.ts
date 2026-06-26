/**
 * useTodayStimulusContributions — the "what this contributed" line per session.
 *
 * Runs each of today's session Observations through core/stimulus.reveal() and
 * returns a map keyed by Observation id. Takes the sessions as input (Today
 * already has them from useTodayObservations) rather than re-querying — one
 * source of truth, no extra fetch. Pure transform; memoised on the sessions.
 */
import { useMemo } from 'react';
import type { ObservationId, ObservationOf } from '@core/observation';
import { reveal } from '@core/stimulus';

export function useTodayStimulusContributions(
  sessions: ObservationOf<'session'>[]
): Record<ObservationId, string> {
  return useMemo(() => {
    const out: Record<ObservationId, string> = {};
    for (const s of sessions) out[s.id] = reveal(s);
    return out;
  }, [sessions]);
}
