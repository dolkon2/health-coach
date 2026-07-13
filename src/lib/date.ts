/**
 * Local civil-day helpers. Time is the user's local day (data-model principle 4):
 * an 11:30pm and a 12:30am entry are different days.
 */
import type { LocalDate } from '@core/observation';

/** 'YYYY-MM-DD' -> 'M/D' — the compact tick/row-label form used by the weight
 *  trend chart and weigh-in history list. */
export function shortLocalDate(localDate: LocalDate): string {
  const [, m, d] = localDate.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** e.g. "Thursday, June 26" — rendered mixed-case by the display type variant. */
export function todayLocalLabel(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Today's LocalDate ('YYYY-MM-DD') in the device's local zone — the canonical
 * "today" the week strip + day-nav compare against. Pure modulo `d`, so callers
 * can pass a fixed `Date` in tests.
 */
export function todayLocalDate(d: Date = new Date()): LocalDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Whole civil days from `a` to `b` (positive when `b` is later). Pure
 * calendar arithmetic via UTC epoch math — no DST wobble, no zone lookup:
 * two LocalDates are already civil-day facts.
 */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * `date` ± `n` days, civil-day arithmetic in the device's local zone.
 * Negative `n` walks backward; zero is a no-op. Crosses month/year boundaries
 * via the `Date` constructor's normalization (which DST-shifts correctly).
 */
export function addDays(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number);
  return todayLocalDate(new Date(y, m - 1, d + n));
}

/**
 * The Sun–Sat civil week containing `date`, as 7 LocalDate strings (Sunday
 * first). US convention; locale-aware first-day-of-week is deferred to a
 * settings pass (no v1 user has asked).
 */
export function weekOf(date: LocalDate): LocalDate[] {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sun … 6 = Sat
  const sun = addDays(date, -dow);
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(sun, i));
}

/**
 * The label that sits above the week strip — "Today" / "Yesterday" /
 * "Tomorrow" for adjacent days, falling back to "Sun, Jun 22" elsewhere.
 * Symmetric across past + future since Pass 2 allows future-day viewing
 * (meal planning).
 */
export function dayNavLabel(date: LocalDate, today: LocalDate): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  if (date === addDays(today, 1)) return 'Tomorrow';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The caps day-nav title — "THU · JUL 9" (uppercase weekday · month day).
 * The Nutrition day header shows the explicit date in the caps register
 * (the mockup's own structure), not the "Today/Yesterday" wording — the
 * WeekStrip's selected cell already carries the "which day" cue.
 */
export function dayNavCapsLabel(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()
    .replace(', ', ' · ');
}

/**
 * Weekday index in the app's Mon=0…Sun=6 convention — the same scale
 * `SessionTemplate.dayAssignment` and `DAYS_OF_WEEK` use (NOT JS's Sun=0).
 * Used to match recurring templates to a given day (Home's today's-template
 * card). Converts `getDay()` (Sun=0…Sat=6) by rotating Sunday to the end.
 */
export function weekdayMonZero(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** e.g. "S" / "M" / "T" — the single-letter weekday for the strip's day cells. */
export function weekdayLetter(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(y, m - 1, d).getDay()];
}

/** The day-of-month integer for the strip's date cell, e.g. 22 for "2026-06-22". */
export function dayOfMonth(date: LocalDate): number {
  return Number(date.split('-')[2]);
}

/**
 * The ISO instant for 12:00 PM on `date` in the device's local zone — the
 * default `occurredAt` Pass 2.5 uses when the user opens the logger from a
 * non-today day in the Nutrition tab. Noon avoids DST edge-case ambiguity
 * (spring-forward in some zones skips 02:00; fall-back doubles up 01:00 —
 * neither happens at 12:00) and reads as "midday, you can adjust if needed."
 */
export function noonOfLocalDate(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

/** e.g. "2026" */
export function yearLabel(d: Date = new Date()): string {
  return String(d.getFullYear());
}

/** e.g. "7h 32m" — shared by SleepCard and Home's StepsSleepStrip so a
 *  duration-display fix only has to happen in one place. */
export function formatDurationHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${h}h ${m}m`;
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
 * A UTC window guaranteed to contain every observation whose *local-day* (in
 * whatever zone it was logged in) falls within `localDates`. We can't predict
 * the stored `tz` of each observation, and a meal logged near midnight in a
 * different zone can bleed across UTC dates — so the window pads ±24h around
 * the min/max requested days. Callers post-filter via `localDayOf` (the engine
 * already does this in `bucketByLocalDay`) to land each entry on its real day.
 *
 * Throws on an empty input — a zero-day window has no meaningful bounds, and
 * silently widening to "all time" would mask a caller bug.
 */
export function paddedDayWindow(
  localDates: ReadonlyArray<LocalDate>
): { startUtc: string; endUtc: string } {
  if (localDates.length === 0) {
    throw new Error('paddedDayWindow: localDates must not be empty');
  }
  let min = localDates[0];
  let max = localDates[0];
  for (const d of localDates) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  const day = 86_400_000;
  const minMs = Date.parse(`${min}T00:00:00.000Z`);
  const maxMs = Date.parse(`${max}T00:00:00.000Z`);
  const startUtc = new Date(minMs - day).toISOString();
  const endUtc = new Date(maxMs + 2 * day - 1).toISOString();
  return { startUtc, endUtc };
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

/**
 * A running-clock duration — "4:07", "1:23:05" — from whole seconds. Hours
 * appear only when nonzero. The one shared formatter for every recording
 * surface (live Record panel, save sheet; log-session/GpsRecorderPanel
 * carry older private copies — flagged for consolidation), so the same
 * session can never show differently-formatted elapsed strings.
 */
export function formatDurationClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
