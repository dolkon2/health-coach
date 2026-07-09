/**
 * skyLedger.ts — real sky Observations -> FlightFact[] -> the pure USHPA
 * ledger calculator (core/src/ushpaLedger.ts).
 *
 * The ledger math is decoupled from the flight schema on purpose (see
 * ushpaLedger.ts's own doc comment); this is the adapter that finally
 * connects them, now that the sky logging surface exists.
 *
 * Airtime source: when a session carries segments (a real track was
 * detected/edited), airtime is the sum of its 'air' segments — ground time
 * never counts. A hand-logged session with no track carries no segment
 * breakdown, so its whole manual duration IS the flight time by convention
 * (that's what the user typed when asked "how long was the flight").
 */
import type { ObservationOf } from '@core/observation';
import { localDayOf } from '@core/timeline';
import type { FlightFact, FlightStyle } from '@core/ushpaLedger';
import { totalAirtimeSec } from './skySegmentStats';

const STYLE_BY_ACTIVITY: Record<string, FlightStyle> = {
  paragliding: 'xc',
  hikeAndFly: 'hikefly',
  speedflying: 'speed',
  parakiting: 'parakite',
};

/** The four sky-dimension activity ids — the single source of truth callers
 * (e.g. the ledger screen's session filter) should use instead of keeping
 * their own copy that could drift from STYLE_BY_ACTIVITY. */
export const SKY_ACTIVITY_IDS: ReadonlySet<string> = new Set(Object.keys(STYLE_BY_ACTIVITY));

/**
 * Converts sky sessions into ledger-ready facts. Non-sky sessions (no
 * matching activity) are silently skipped — the caller is expected to have
 * already filtered to sky activities, but this stays defensive rather than
 * throwing on a mixed list.
 */
export function skyFlightFacts(sessions: ObservationOf<'session'>[]): FlightFact[] {
  const facts: FlightFact[] = [];
  for (const obs of sessions) {
    const style = obs.payload.activity ? STYLE_BY_ACTIVITY[obs.payload.activity] : undefined;
    if (!style) continue;

    const track = obs.payload.sky?.track;
    const segments = obs.payload.sky?.segments;
    const airtimeMin =
      track != null && segments != null && segments.length > 0
        ? totalAirtimeSec(track, segments) / 60
        : (obs.payload.durationMin ?? 0);
    const spotId = obs.payload.sky?.spotId;

    facts.push({
      dateLocal: localDayOf(obs.occurredAt, obs.tz),
      airtimeMin,
      ...(spotId ? { spotId } : {}),
      style,
    });
  }
  return facts;
}
