/**
 * date helpers — the one with real logic worth pinning is `localTimeLabel`: a meal
 * must read at the wall-clock time it was logged, in the zone it was logged in, not
 * the device's current zone (the data-model's local-time honesty). Asserted
 * locale-robustly (12h/24h, padding, and the AM/PM separator all vary by ICU).
 */
import { describe, it, expect } from '@jest/globals';
import { localTimeLabel, paddedDayWindow } from '@/lib/date';

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
