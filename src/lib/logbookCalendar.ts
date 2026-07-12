/**
 * Pure month-grid math for the Profile logbook calendar (Strong-style month
 * grid, checkmark days — profile-settings.md §2). Kept separate from the
 * component so the civil-day arithmetic is unit-testable and never fabricates a
 * day. All dates are LocalDate ('YYYY-MM-DD') in the device's local zone, using
 * the same `Date`-normalization idiom as `date.ts` (addDays/todayLocalDate).
 */
import type { LocalDate } from '@core/observation';
import { todayLocalDate, addDays } from './date';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The first day of the month containing `date` ('YYYY-MM-01'). */
export function monthStart(date: LocalDate): LocalDate {
  const [y, m] = date.split('-');
  return `${y}-${m}-01`;
}

/** "June 2026" for the month containing `date`. */
export function monthLabel(date: LocalDate): string {
  const [y, m] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/**
 * The month `delta` months from the one containing `date`, as its first day.
 * Negative walks backward; crosses year boundaries via `Date` normalization.
 */
export function shiftMonth(date: LocalDate, delta: number): LocalDate {
  const [y, m] = date.split('-').map(Number);
  return todayLocalDate(new Date(y, m - 1 + delta, 1));
}

export type MonthCell = { date: LocalDate; inMonth: boolean };

/**
 * A fixed 6×7 (42-cell) Sunday-first grid covering the month containing `date`,
 * with leading/trailing days drawn from the adjacent months and flagged
 * `inMonth: false`. Six rows so the grid height never jumps between months.
 */
export function monthCells(date: LocalDate): MonthCell[] {
  const first = monthStart(date);
  const [fy, fm] = first.split('-').map(Number);
  const firstDow = new Date(fy, fm - 1, 1).getDay(); // 0 = Sun … 6 = Sat
  const gridStart = addDays(first, -firstDow);
  const monthKey = `${first.slice(0, 7)}`; // 'YYYY-MM'
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    return { date: d, inMonth: d.startsWith(monthKey) };
  });
}
