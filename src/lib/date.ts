/**
 * Local civil-day helpers. Time is the user's local day (data-model principle 4):
 * an 11:30pm and a 12:30am entry are different days.
 */

/** e.g. "Thursday, June 26" — rendered uppercase by the display type variant. */
export function todayLocalLabel(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** e.g. "2026" */
export function yearLabel(d: Date = new Date()): string {
  return String(d.getFullYear());
}

/** The device's IANA timezone, e.g. 'America/Los_Angeles'. Stored on every Observation. */
export function deviceTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The UTC instants bounding the user's *local* civil day containing `d`.
 * `[startUtc, endUtc]` runs from local midnight to the last millisecond before
 * the next local midnight — so a query on occurredAt picks up exactly today's
 * local entries regardless of the device's UTC offset (data-model principle 4).
 */
export function localDayWindow(d: Date = new Date()): { startUtc: string; endUtc: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

/** ISO instant for `days` ago from `d`, used as the lower bound on trend queries. */
export function daysAgoUtc(days: number, d: Date = new Date()): string {
  return new Date(d.getTime() - days * 86_400_000).toISOString();
}

/**
 * The wall-clock time of `iso`, e.g. "8:14 AM". Formatted in `tz` — the zone the
 * Observation was logged in, not the device's current one — so a meal reads at the
 * time you actually ate it, even after you've travelled. Falls back to the device
 * zone when `tz` is omitted.
 */
export function localTimeLabel(iso: string, tz?: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  });
}

/**
 * The hour-of-day label used as the Nutrition tab's left-gutter anchor — "10 AM",
 * "12 PM", "3 PM" — derived from the instant's local time in `tz`. Minutes are
 * intentionally absent: this is the *bucket*, not the time of the meal (that
 * still renders inside the row via `localTimeLabel`).
 */
export function hourBucketLabel(iso: string, tz?: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    hour12: true,
    ...(tz ? { timeZone: tz } : {}),
  });
}
