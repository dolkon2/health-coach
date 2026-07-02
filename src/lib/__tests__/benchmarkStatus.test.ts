/**
 * Pure status math for Today's benchmark cards (Phase 5 Pass 3).
 *
 * No DB, no React. The load-bearing assertions: the behavior line is a plain
 * windowed COUNT (never a streak); session matching degrades honestly
 * (activity-exact, legacy modality fallback, explicit mismatch excluded); the
 * outcome line reports the ACTUAL movement — including movement against the
 * wish — and never invents a delta from sparse data.
 */
import { describe, it, expect } from '@jest/globals';
import type { BehaviorFace, OutcomeFace } from '@core/benchmark';
import type { ObservationOf } from '@core/observation';
import type { WeightTrendPoint } from '@core/trend';
import {
  currentWindowRange,
  sessionMatchesDimension,
  behaviorStatus,
  outcomeStatus,
  behaviorLine,
  outcomeLine,
} from '../benchmarkStatus';

function session(
  occurredAt: string,
  payload: Partial<ObservationOf<'session'>['payload']> = {}
): ObservationOf<'session'> {
  return {
    id: `s-${occurredAt}-${payload.activity ?? payload.modality ?? 'x'}`,
    kind: 'session',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'UTC',
    tier: 1,
    fidelity: 0.95,
    source: { type: 'manual' },
    payload: { kind: 'session', modality: 'paddle', ...payload },
  };
}

function point(date: string, trendKg: number): WeightTrendPoint {
  return { date, trendKg, rawWeighInIds: [], confidence: 0.8 };
}

const kayakFace: BehaviorFace = {
  dimension: { metric: 'sessionCount', modality: 'paddle', activity: 'kayak' },
  window: 'week',
  measure: { type: 'count', target: 4 },
};

// 2026-07-01 is a Wednesday; its ISO week starts Monday 2026-06-29.
const NOW = '2026-07-01T18:00:00Z';

describe('currentWindowRange', () => {
  it('opens the week on the ISO Monday and closes exclusively the next Monday', () => {
    expect(currentWindowRange('week', NOW)).toEqual({
      fromIso: '2026-06-29T00:00:00Z',
      toIso: '2026-07-06T00:00:00.000Z',
    });
  });

  it('handles a Sunday belonging to the week begun the prior Monday', () => {
    expect(currentWindowRange('week', '2026-07-05T10:00:00Z').fromIso).toBe(
      '2026-06-29T00:00:00Z'
    );
  });

  it('opens the month on the first and closes on the next first, across year end', () => {
    expect(currentWindowRange('month', NOW)).toEqual({
      fromIso: '2026-07-01T00:00:00Z',
      toIso: '2026-08-01T00:00:00.000Z',
    });
    expect(currentWindowRange('month', '2026-12-15T00:00:00Z').toIso).toBe(
      '2027-01-01T00:00:00.000Z'
    );
  });
});

describe('sessionMatchesDimension', () => {
  const dim = kayakFace.dimension;

  it('matches the exact activity', () => {
    expect(sessionMatchesDimension(session(NOW, { activity: 'kayak' }), dim)).toBe(true);
  });

  it('excludes a session that names a DIFFERENT activity, even in the same modality', () => {
    expect(
      sessionMatchesDimension(session(NOW, { activity: 'sup', modality: 'paddle' }), dim)
    ).toBe(false);
  });

  it('falls back to the movement family for legacy sessions with no activity', () => {
    expect(sessionMatchesDimension(session(NOW, { modality: 'paddle' }), dim)).toBe(true);
    expect(sessionMatchesDimension(session(NOW, { modality: 'run' }), dim)).toBe(false);
  });

  it('matches by modality when the dimension has no activity', () => {
    const modDim = { metric: 'sessionCount', modality: 'run' } as const;
    expect(sessionMatchesDimension(session(NOW, { modality: 'run' }), modDim)).toBe(true);
    expect(
      sessionMatchesDimension(session(NOW, { modality: 'run', activity: 'trail-run' }), modDim)
    ).toBe(true);
    expect(sessionMatchesDimension(session(NOW, { modality: 'paddle' }), modDim)).toBe(false);
  });

  it('counts every session for a bare dimension (any-session pairing)', () => {
    const anyDim = { metric: 'sessionCount' } as const;
    expect(sessionMatchesDimension(session(NOW, { modality: 'gym' }), anyDim)).toBe(true);
    expect(sessionMatchesDimension(session(NOW, { activity: 'kayak' }), anyDim)).toBe(true);
  });

  it('never matches a non-session dimension', () => {
    expect(sessionMatchesDimension(session(NOW), { metric: 'bodyweight' })).toBe(false);
  });
});

describe('behaviorStatus', () => {
  it('counts qualifying sessions inside the current window only', () => {
    const sessions = [
      session('2026-06-29T08:00:00Z', { activity: 'kayak' }), // Monday — in
      session('2026-07-01T09:00:00Z', { activity: 'kayak' }), // Wednesday — in
      session('2026-06-28T09:00:00Z', { activity: 'kayak' }), // prior Sunday — out
      session('2026-07-01T10:00:00Z', { activity: 'sup' }), // wrong activity — out
      session('2026-06-30T10:00:00Z', { modality: 'run' }), // wrong family — out
      session('2026-06-30T11:00:00Z', { modality: 'paddle' }), // legacy fallback — in
    ];
    const s = behaviorStatus(kayakFace, sessions, NOW);
    expect(s).toEqual({ count: 3, target: 4, windowLabel: 'this week' });
  });

  it('shows an honest zero when nothing qualifies yet', () => {
    expect(behaviorStatus(kayakFace, [], NOW)).toEqual({
      count: 0,
      target: 4,
      windowLabel: 'this week',
    });
  });

  it('buckets monthly faces by calendar month', () => {
    const face: BehaviorFace = { ...kayakFace, window: 'month' };
    const sessions = [
      session('2026-07-01T08:00:00Z', { activity: 'kayak' }), // in
      session('2026-06-30T08:00:00Z', { activity: 'kayak' }), // June — out
    ];
    expect(behaviorStatus(face, sessions, NOW)).toEqual({
      count: 1,
      target: 4,
      windowLabel: 'this month',
    });
  });

  it('returns null for a magnitude measure rather than showing the wrong count', () => {
    const face: BehaviorFace = {
      ...kayakFace,
      measure: { type: 'magnitude', target: 100, unit: 'km' },
    };
    expect(behaviorStatus(face, [session(NOW, { activity: 'kayak' })], NOW)).toBeNull();
  });
});

describe('outcomeStatus', () => {
  const face: OutcomeFace = {
    dimension: { metric: 'bodyweight' },
    direction: 'down',
    target: 75,
  };

  it('is honest about having no data', () => {
    expect(outcomeStatus(face, [])).toEqual({ kind: 'noData' });
  });

  it('reports the latest trend, recent movement, and signed distance to target', () => {
    const points = [
      point('2026-06-17', 83.0),
      point('2026-06-24', 82.7),
      point('2026-07-01', 82.4),
    ];
    const s = outcomeStatus(face, points);
    expect(s.kind).toBe('moving');
    if (s.kind !== 'moving') return;
    expect(s.trendKg).toBe(82.4);
    expect(s.deltaKg).toBeCloseTo(-0.6, 5); // vs the point ~14 days back
    expect(s.deltaDays).toBe(14);
    expect(s.targetKg).toBe(75);
    expect(s.toTargetKg).toBeCloseTo(7.4, 5); // above target — stated, not judged
  });

  it('drops the delta rather than inventing one from a single point', () => {
    const s = outcomeStatus(face, [point('2026-07-01', 82.4)]);
    if (s.kind !== 'moving') throw new Error('expected moving');
    expect(s.deltaKg).toBeNull();
    expect(s.deltaDays).toBeNull();
    expect(s.toTargetKg).toBeCloseTo(7.4, 5);
  });

  it('omits target math for a pure-direction face', () => {
    const pure: OutcomeFace = { dimension: { metric: 'bodyweight' }, direction: 'down' };
    const s = outcomeStatus(pure, [point('2026-06-24', 82.7), point('2026-07-01', 82.4)]);
    if (s.kind !== 'moving') throw new Error('expected moving');
    expect(s.targetKg).toBeUndefined();
    expect(s.toTargetKg).toBeUndefined();
  });
});

describe('card lines', () => {
  it('renders the behavior count plainly — no streak, no celebration', () => {
    expect(behaviorLine({ count: 2, target: 4, windowLabel: 'this week' })).toBe(
      '2/4 this week'
    );
    expect(behaviorLine({ count: 0, target: 12, windowLabel: 'this month' })).toBe(
      '0/12 this month'
    );
  });

  it('renders observed movement with the weigh-in card grammar, kg and lb', () => {
    const s = {
      kind: 'moving' as const,
      trendKg: 82.4,
      deltaKg: -0.6,
      deltaDays: 14,
      targetKg: 75,
      toTargetKg: 7.4,
    };
    expect(outcomeLine(s, 'kg')).toBe('82.4 kg · ↓ 0.6 kg over 14 days · 7.4 kg above target');
    expect(outcomeLine(s, 'lb')).toBe(
      '181.7 lb · ↓ 1.3 lb over 14 days · 16.3 lb above target'
    );
  });

  it('reports movement AGAINST the wish just as plainly (up while aiming down)', () => {
    const s = {
      kind: 'moving' as const,
      trendKg: 82.4,
      deltaKg: 0.8,
      deltaDays: 14,
    };
    expect(outcomeLine(s, 'kg')).toBe('82.4 kg · ↑ 0.8 kg over 14 days');
  });

  it('says "below target" when the trend sits under the threshold', () => {
    const s = {
      kind: 'moving' as const,
      trendKg: 74.2,
      deltaKg: null,
      deltaDays: null,
      targetKg: 75,
      toTargetKg: -0.8,
    };
    expect(outcomeLine(s, 'kg')).toBe('74.2 kg · 0.8 kg below target');
  });

  it('is honest about an empty mirror', () => {
    expect(outcomeLine({ kind: 'noData' }, 'kg')).toBe('no weight data yet');
  });
});
