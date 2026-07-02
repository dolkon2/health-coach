/**
 * Pure layout-key math for the benchmark-keyed Reflect view (Phase 5 Pass 4).
 *
 * Load-bearing assertions: the outcome face keys the hero when both faces
 * exist; windows before the benchmark existed still count (revealed, not
 * started-at-intent); the revealed run counts back over COMPLETE windows only
 * — the in-progress window neither extends nor breaks it.
 */
import { describe, it, expect } from '@jest/globals';
import type { Benchmark, BehaviorFace } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import {
  heroFaceOf,
  defaultLensId,
  pastWindowRanges,
  behaviorWindowCounts,
  consecutiveAtTarget,
  type WindowCount,
} from '../benchmarkReflect';

function session(occurredAt: string): ObservationOf<'session'> {
  return {
    id: `s-${occurredAt}`,
    kind: 'session',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'UTC',
    tier: 1,
    fidelity: 0.95,
    source: { type: 'manual' },
    payload: { kind: 'session', modality: 'paddle', activity: 'kayak' },
  };
}

function bench(over: Partial<Benchmark>): Benchmark {
  return {
    id: over.id ?? 'b1',
    createdAt: '2026-07-01T00:00:00Z',
    status: 'active',
    title: 't',
    pinned: true,
    ...over,
  };
}

const behavior: BehaviorFace = {
  dimension: { metric: 'sessionCount', modality: 'paddle', activity: 'kayak' },
  window: 'week',
  measure: { type: 'count', target: 2 },
};
const outcome = { dimension: { metric: 'bodyweight' as const }, direction: 'down' as const };

// Wednesday; the current ISO week runs Mon Jun 29 → Mon Jul 6.
const NOW = '2026-07-01T18:00:00.000Z';

describe('heroFaceOf / defaultLensId', () => {
  it('the outcome face keys the hero when both exist; behavior-only promotes the rhythm', () => {
    expect(heroFaceOf(bench({ behavior, outcome }))).toBe('outcome');
    expect(heroFaceOf(bench({ outcome }))).toBe('outcome');
    expect(heroFaceOf(bench({ behavior }))).toBe('behavior');
  });

  it('defaults the lens to the first benchmark with a measured story, else the first', () => {
    const behaviorOnly = bench({ id: 'b-beh', behavior });
    const withOutcome = bench({ id: 'b-out', outcome });
    expect(defaultLensId([behaviorOnly, withOutcome])).toBe('b-out');
    expect(defaultLensId([behaviorOnly])).toBe('b-beh');
    expect(defaultLensId([])).toBeNull();
  });
});

describe('pastWindowRanges', () => {
  it('returns n weekly windows oldest → newest, current last', () => {
    const r = pastWindowRanges('week', NOW, 3);
    expect(r.map((w) => w.fromIso)).toEqual([
      '2026-06-15T00:00:00.000Z',
      '2026-06-22T00:00:00.000Z',
      '2026-06-29T00:00:00.000Z',
    ]);
    // Contiguous: each window closes where the next opens.
    expect(r[0].toIso).toBe(r[1].fromIso);
    expect(r[1].toIso).toBe(r[2].fromIso);
  });

  it('steps monthly windows by calendar month, across the year boundary', () => {
    const r = pastWindowRanges('month', '2026-01-15T00:00:00.000Z', 3);
    expect(r.map((w) => w.fromIso)).toEqual([
      '2025-11-01T00:00:00.000Z',
      '2025-12-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ]);
  });
});

describe('behaviorWindowCounts', () => {
  it('counts matching sessions per window; history before the benchmark existed still counts', () => {
    const sessions = [
      session('2026-06-16T08:00:00.000Z'), // window 1 (Jun 15) — pre-benchmark, still revealed
      session('2026-06-17T08:00:00.000Z'), // window 1
      session('2026-06-23T08:00:00.000Z'), // window 2 (Jun 22)
      session('2026-06-30T08:00:00.000Z'), // window 3 (Jun 29, current)
    ];
    const counts = behaviorWindowCounts(behavior, sessions, NOW, 3)!;
    expect(counts.map((c) => c.count)).toEqual([2, 1, 1]);
    expect(counts.map((c) => c.complete)).toEqual([true, true, false]);
    expect(counts.every((c) => c.target === 2)).toBe(true);
  });

  it('returns null for a magnitude measure', () => {
    const face: BehaviorFace = {
      ...behavior,
      measure: { type: 'magnitude', target: 100, unit: 'km' },
    };
    expect(behaviorWindowCounts(face, [], NOW, 3)).toBeNull();
  });
});

describe('consecutiveAtTarget', () => {
  const w = (count: number, complete = true): WindowCount => ({
    fromIso: 'x',
    toIso: 'y',
    count,
    target: 2,
    complete,
  });

  it('counts back from the most recent complete window', () => {
    expect(consecutiveAtTarget([w(0), w(2), w(3), w(1, false)])).toBe(2);
  });

  it('the in-progress window neither breaks nor extends the run', () => {
    expect(consecutiveAtTarget([w(2), w(2), w(0, false)])).toBe(2);
    expect(consecutiveAtTarget([w(2), w(2), w(5, false)])).toBe(2);
  });

  it('a missed last complete window resets to zero — without drama', () => {
    expect(consecutiveAtTarget([w(2), w(2), w(1), w(0, false)])).toBe(0);
  });

  it('handles all-hit and empty histories', () => {
    expect(consecutiveAtTarget([w(2), w(4), w(2)])).toBe(3);
    expect(consecutiveAtTarget([])).toBe(0);
  });
});
