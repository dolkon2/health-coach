/**
 * timeline.ts — Orders, windows, and per-day buckets the observations.
 *
 * The data flow: things happen -> become Observations -> timeline orders them
 * -> engines turn them into facts. Time is the user's local civil day
 * (data-model.md principle 4): a 11:30pm and a 12:30am snack are different days.
 *
 * Status: signatures only. Implemented in Pass 3 (Today needs day bucketing).
 */
import type { Observation, ISOInstant, LocalDate } from './observation';
import { notImplemented } from './notImplemented';

/** Newest-last ordering by occurredAt. */
export function orderByTime(_observations: Observation[]): Observation[] {
  return notImplemented('timeline.orderByTime', 'Pass 3');
}

/** Inclusive window [from, to] over occurredAt. */
export function windowBetween(
  _observations: Observation[],
  _from: ISOInstant,
  _to: ISOInstant
): Observation[] {
  return notImplemented('timeline.windowBetween', 'Pass 3');
}

/** Group observations into the user's local civil days. */
export function bucketByLocalDay(
  _observations: Observation[]
): Map<LocalDate, Observation[]> {
  return notImplemented('timeline.bucketByLocalDay', 'Pass 3');
}
