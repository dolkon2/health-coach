/**
 * date helpers — the one with real logic worth pinning is `localTimeLabel`: a meal
 * must read at the wall-clock time it was logged, in the zone it was logged in, not
 * the device's current zone (the data-model's local-time honesty). Asserted
 * locale-robustly (12h/24h, padding, and the AM/PM separator all vary by ICU).
 */
import { describe, it, expect } from '@jest/globals';
import {
  addDays,
  daysBetween,
  dayNavLabel,
  dayNavCapsLabel,
  dayOfMonth,
  localTimeLabel,
  noonOfLocalDate,
  paddedDayWindow,
  todayLocalDate,
  weekOf,
  weekdayLetter,
  weekdayMonZero,
} from '@/lib/date';

describe('localTimeLabel — tz-aware wall-clock time', () => {
  const iso = '2026-06-10T15:14:00Z'; // a fixed UTC instant

  it('renders the time in the entry’s own stored zone', () => {
    const la = localTimeLabel(iso, 'America/Los_Angeles'); // 08:14 PDT (UTC-7)
    const ny = localTimeLabel(iso, 'America/New_York'); // 11:14 EDT (UTC-4)
    expect(la).toMatch(/\b0?8:14\b/);
    expect(ny).toMatch(/\b11:14\b/);
    expect(la).not.toBe(ny); // the stored zone changes the wall-clock time
  });
});

describe('paddedDayWindow — UTC window covering local-day requests', () => {
  it('pads ±1 day around a single LocalDate', () => {
    // The ±24h pad is what makes the window tz-robust: a meal logged at
    // 23:30 PST on 2026-06-25 lives at 06:30 UTC on 2026-06-26, and a meal
    // at 00:30 EST on 2026-06-25 lives at 05:30 UTC on 2026-06-25 — both
    // belong to "2026-06-25" in their respective zones, and both fall
    // inside this window.
    const { startUtc, endUtc } = paddedDayWindow(['2026-06-25']);
    expect(startUtc).toBe('2026-06-24T00:00:00.000Z');
    expect(endUtc).toBe('2026-06-26T23:59:59.999Z');
  });

  it('spans min−1d to max+1d for a multi-day range', () => {
    const { startUtc, endUtc } = paddedDayWindow([
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
      '2026-06-26',
      '2026-06-27',
      '2026-06-28',
    ]);
    expect(startUtc).toBe('2026-06-21T00:00:00.000Z');
    expect(endUtc).toBe('2026-06-29T23:59:59.999Z');
  });

  it('is order-independent — sorted vs unsorted input produce the same window', () => {
    const sorted = paddedDayWindow(['2026-06-22', '2026-06-25', '2026-06-28']);
    const jumbled = paddedDayWindow(['2026-06-28', '2026-06-22', '2026-06-25']);
    expect(jumbled).toEqual(sorted);
  });

  it('correctly handles a range crossing a month boundary', () => {
    const { startUtc, endUtc } = paddedDayWindow(['2026-06-30', '2026-07-01']);
    expect(startUtc).toBe('2026-06-29T00:00:00.000Z');
    expect(endUtc).toBe('2026-07-02T23:59:59.999Z');
  });

  it('throws on an empty input rather than silently widening to all-time', () => {
    expect(() => paddedDayWindow([])).toThrow(/must not be empty/);
  });
});

describe('todayLocalDate', () => {
  it('formats the device-local date as YYYY-MM-DD', () => {
    // Use a fixed Date to avoid clock dependence. Local-zone interpretation
    // matters here — passing a constructor (y, m-1, d) avoids UTC drift.
    expect(todayLocalDate(new Date(2026, 5, 22))).toBe('2026-06-22');
    expect(todayLocalDate(new Date(2027, 0, 1))).toBe('2027-01-01');
  });
});

describe('addDays — civil-day arithmetic', () => {
  it('moves forward and backward within a month', () => {
    expect(addDays('2026-06-22', 0)).toBe('2026-06-22');
    expect(addDays('2026-06-22', 1)).toBe('2026-06-23');
    expect(addDays('2026-06-22', -1)).toBe('2026-06-21');
    expect(addDays('2026-06-22', 7)).toBe('2026-06-29');
  });

  it('crosses month boundaries via Date normalization', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('weekOf — Sun-Sat week for a LocalDate', () => {
  it('returns Sun-first when the date is a Sunday', () => {
    // 2026-06-28 was a Sunday — the week starts on the date itself.
    const w = weekOf('2026-06-28');
    expect(w).toEqual([
      '2026-06-28',
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
  });

  it('returns Sun-first when the date is a Saturday', () => {
    // 2026-06-27 was a Saturday — sun is 6 days back, sat is the date itself.
    const w = weekOf('2026-06-27');
    expect(w).toEqual([
      '2026-06-21',
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
      '2026-06-26',
      '2026-06-27',
    ]);
  });

  it('returns Sun-first for a midweek date', () => {
    // 2026-06-24 was a Wednesday.
    const w = weekOf('2026-06-24');
    expect(w[0]).toBe('2026-06-21'); // Sun
    expect(w[3]).toBe('2026-06-24'); // Wed (the queried date)
    expect(w[6]).toBe('2026-06-27'); // Sat
  });
});

describe('dayNavLabel — Today/Yesterday/Tomorrow/date', () => {
  const today = '2026-06-28';

  it('returns "Today" for today', () => {
    expect(dayNavLabel(today, today)).toBe('Today');
  });

  it('returns "Yesterday" for the day before', () => {
    expect(dayNavLabel('2026-06-27', today)).toBe('Yesterday');
  });

  it('returns "Tomorrow" for the day after (future viewing allowed)', () => {
    expect(dayNavLabel('2026-06-29', today)).toBe('Tomorrow');
  });

  it('falls back to a short date label for older / further days', () => {
    // 2026-06-22 was a Monday (the prior week's Sunday is 2026-06-21).
    expect(dayNavLabel('2026-06-22', today)).toMatch(/Mon.*Jun.*22/);
    // 2026-07-04 was a Saturday.
    expect(dayNavLabel('2026-07-04', today)).toMatch(/Sat.*Jul.*4/);
  });
});

describe('noonOfLocalDate — default occurredAt for past/future logging', () => {
  it('returns noon of the given local date (device-tz interpretation)', () => {
    const iso = noonOfLocalDate('2026-06-22');
    const dt = new Date(iso);
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(5); // June (0-indexed)
    expect(dt.getDate()).toBe(22);
    expect(dt.getHours()).toBe(12);
    expect(dt.getMinutes()).toBe(0);
    expect(dt.getSeconds()).toBe(0);
  });

  it('returns a well-formed UTC ISO instant', () => {
    expect(noonOfLocalDate('2026-06-22')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it('handles year boundaries', () => {
    const iso = noonOfLocalDate('2026-01-01');
    const dt = new Date(iso);
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(0);
    expect(dt.getDate()).toBe(1);
    expect(dt.getHours()).toBe(12);
  });

  it('handles a far-future date (meal-plan tomorrow next year)', () => {
    const iso = noonOfLocalDate('2027-12-31');
    const dt = new Date(iso);
    expect(dt.getFullYear()).toBe(2027);
    expect(dt.getMonth()).toBe(11);
    expect(dt.getDate()).toBe(31);
    expect(dt.getHours()).toBe(12);
  });
});

describe('weekdayLetter + dayOfMonth — strip cell content', () => {
  it('returns the single-letter weekday for the day-cell label', () => {
    expect(weekdayLetter('2026-06-28')).toBe('S'); // Sunday
    expect(weekdayLetter('2026-06-29')).toBe('M'); // Monday
    expect(weekdayLetter('2026-07-04')).toBe('S'); // Saturday
  });

  it('returns the day-of-month integer for the date number', () => {
    expect(dayOfMonth('2026-06-28')).toBe(28);
    expect(dayOfMonth('2026-07-01')).toBe(1);
  });
});

describe('dayNavCapsLabel — "THU · JUL 9" caps day-nav title', () => {
  it('renders uppercase weekday · month day', () => {
    expect(dayNavCapsLabel('2026-07-09')).toBe('THU · JUL 9');
    expect(dayNavCapsLabel('2026-07-12')).toBe('SUN · JUL 12');
  });
});

describe('weekdayMonZero — Mon=0…Sun=6 (dayAssignment scale)', () => {
  it('maps each weekday to the DAYS_OF_WEEK index, not JS getDay()', () => {
    expect(weekdayMonZero('2026-06-29')).toBe(0); // Monday
    expect(weekdayMonZero('2026-06-30')).toBe(1); // Tuesday
    expect(weekdayMonZero('2026-07-04')).toBe(5); // Saturday
    expect(weekdayMonZero('2026-07-05')).toBe(6); // Sunday
    expect(weekdayMonZero('2026-07-12')).toBe(6); // Sunday — Bench Day repeats Sun
  });
});

describe('daysBetween — whole civil days, calendar math only', () => {
  it('counts forward, backward, and across a leap boundary', () => {
    expect(daysBetween('2026-07-10', '2026-07-13')).toBe(3);
    expect(daysBetween('2026-07-13', '2026-07-10')).toBe(-3);
    expect(daysBetween('2026-07-13', '2026-07-13')).toBe(0);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap year
  });
});
