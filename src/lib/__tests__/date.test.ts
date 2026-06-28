/**
 * date helpers — the one with real logic worth pinning is `localTimeLabel`: a meal
 * must read at the wall-clock time it was logged, in the zone it was logged in, not
 * the device's current zone (the data-model's local-time honesty). Asserted
 * locale-robustly (12h/24h, padding, and the AM/PM separator all vary by ICU).
 */
import { describe, it, expect } from '@jest/globals';
import { localTimeLabel } from '@/lib/date';

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
