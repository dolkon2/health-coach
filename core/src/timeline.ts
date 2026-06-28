/**
 * timeline.ts — Orders and windows observations.
 *
 * The data flow: things happen -> become Observations -> timeline orders them
 * -> engines turn them into facts.
 */
import type { Observation, ISOInstant, IANATimezone, LocalDate } from './observation';

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

// Intl.DateTimeFormat is expensive to construct, so memoize one per timezone.
const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtfFor(tz: IANATimezone): Intl.DateTimeFormat {
  let dtf = dtfCache.get(tz);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dtfCache.set(tz, dtf);
  }
  return dtf;
}

/**
 * The user's local civil date for an instant, in their own timezone — e.g. a
 * 06:00 UTC moment is still "yesterday" for a US Pacific logger. This is the
 * tz-aware counterpart to `dayKey` (which slices UTC); the engine uses it so a
 * late-night meal lands on the day it was actually eaten (data-model principle 4).
 */
export function localDayOf(instant: ISOInstant, tz: IANATimezone): LocalDate {
  const parts = dtfFor(tz).formatToParts(new Date(instant));
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

/**
 * Group observations into the user's local civil days (tz-aware, per each
 * observation's own `tz`). Unlike the UTC-slicing `dayKey`, an instant near
 * midnight buckets into the day it actually happened locally.
 */
export function bucketByLocalDay(observations: Observation[]): Map<LocalDate, Observation[]> {
  const map = new Map<LocalDate, Observation[]>();
  for (const o of observations) {
    const day = localDayOf(o.occurredAt, o.tz);
    const arr = map.get(day);
    if (arr) arr.push(o);
    else map.set(day, [o]);
  }
  return map;
}
