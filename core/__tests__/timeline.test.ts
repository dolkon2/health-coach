/**
 * Timeline tests — the tz-aware day bucketing the windowed expenditure engine
 * needs (Ring 2 / Pass 2.6). The headline: an instant near midnight buckets into
 * the user's *local civil day*, not the UTC slice `dayKey` returns.
 */
import { describe, it, expect } from '@jest/globals';
import type { Observation } from '@core/observation';
import { bucketByLocalDay, localDayOf, dayKey } from '@core/timeline';

function obs(id: string, occurredAt: string, tz: string): Observation {
  return {
    id,
    kind: 'weighIn',
    occurredAt,
    loggedAt: occurredAt,
    tz,
    tier: 1,
    fidelity: 1,
    source: { type: 'manual' },
    payload: { kind: 'weighIn', weightKg: 80 },
  };
}

describe('localDayOf / bucketByLocalDay — tz-aware civil days', () => {
  it('a late-night instant buckets into the local day, not the UTC day', () => {
    // 2026-06-02T06:00:00Z is 2026-06-01 23:00 in America/Los_Angeles (PDT, UTC-7).
    const o = obs('a', '2026-06-02T06:00:00Z', 'America/Los_Angeles');
    expect(dayKey(o.occurredAt)).toBe('2026-06-02'); // the old UTC slice
    expect(localDayOf(o.occurredAt, o.tz)).toBe('2026-06-01'); // the real local day
    expect([...bucketByLocalDay([o]).keys()]).toEqual(['2026-06-01']);
  });

  it('groups multiple observations by their own local day', () => {
    const a = obs('a', '2026-06-02T06:00:00Z', 'America/Los_Angeles'); // local 06-01 23:00
    const b = obs('b', '2026-06-02T20:00:00Z', 'America/Los_Angeles'); // local 06-02 13:00
    const c = obs('c', '2026-06-03T05:00:00Z', 'America/Los_Angeles'); // local 06-02 22:00
    const buckets = bucketByLocalDay([a, b, c]);
    expect(buckets.get('2026-06-01')?.map((o) => o.id)).toEqual(['a']);
    expect(buckets.get('2026-06-02')?.map((o) => o.id).sort()).toEqual(['b', 'c']);
  });

  it('respects each observation\'s own timezone', () => {
    // Same instant, two loggers: UTC keeps 06-02, Honolulu (UTC-10) rolls to 06-01.
    const utc = obs('u', '2026-06-02T05:00:00Z', 'UTC');
    const hi = obs('h', '2026-06-02T05:00:00Z', 'Pacific/Honolulu');
    const buckets = bucketByLocalDay([utc, hi]);
    expect(buckets.get('2026-06-02')?.map((o) => o.id)).toEqual(['u']);
    expect(buckets.get('2026-06-01')?.map((o) => o.id)).toEqual(['h']);
  });
});
