/**
 * timeline.ts — Orders and windows observations.
 *
 * The data flow: things happen -> become Observations -> timeline orders them
 * -> engines turn them into facts.
 */
import type { Observation, ISOInstant, LocalDate } from './observation';
import { notImplemented } from './notImplemented';

/** Ascending by occurredAt (oldest first). Pure; does not mutate the input. */
export function orderByTime(observations: Observation[]): Observation[] {
  return [...observations].sort((a, b) =>
    a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0
  );
}

/** Inclusive window [from, to] over occurredAt. */
export function windowBetween(
  observations: Observation[],
  from: ISOInstant,
  to: ISOInstant
): Observation[] {
  return observations.filter((o) => o.occurredAt >= from && o.occurredAt <= to);
}

/** The calendar-date portion (UTC) of an instant, e.g. '2026-06-26'. */
export function dayKey(instant: ISOInstant): LocalDate {
  return instant.slice(0, 10);
}

/**
 * Group observations into local civil days. Still TODO: correct per-timezone
 * bucketing (needs the user's tz). Not required until a screen needs day
 * buckets; Pass 3 uses date-range queries instead.
 */
export function bucketByLocalDay(
  _observations: Observation[]
): Map<LocalDate, Observation[]> {
  return notImplemented('timeline.bucketByLocalDay', 'a later pass');
}
