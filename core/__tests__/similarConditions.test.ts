/**
 * Similar-conditions query tests (contract §9). The headline: ranked history,
 * best-first by weighted wind distance — speed primary, circular direction
 * secondary, wraparound handled, absent direction skipped (never fabricated),
 * sessions without a frozen wind snapshot invisible to the query.
 */
import { describe, it, expect } from '@jest/globals';
import type { ObservationOf } from '@core/observation';
import type { WindSnapshot } from '@core/conditions/snapshot';
import {
  circularDeltaDeg,
  findSimilarWindSessions,
} from '@core/conditions/similar';

function snapshot(speedKts: number, directionDeg?: number): WindSnapshot {
  return {
    lat: 45.7,
    lng: -121.5,
    speedKts,
    ...(directionDeg !== undefined ? { directionDeg } : {}),
    observedAtUtc: '2026-07-01T18:00:00Z',
    fetchedAtUtc: '2026-07-01T18:05:00Z',
    source: 'open-meteo-forecast',
  };
}

function windSession(
  id: string,
  speedKts: number,
  directionDeg?: number,
  gearIds?: string[]
): ObservationOf<'session'> {
  return {
    id,
    kind: 'session',
    occurredAt: '2026-07-01T18:00:00Z',
    loggedAt: '2026-07-01T20:00:00Z',
    tz: 'America/Los_Angeles',
    tier: 1,
    fidelity: 0.5,
    source: { type: 'manual' },
    payload: {
      kind: 'session',
      modality: 'surf',
      activity: 'wingfoil',
      durationMin: 90,
      wind: {
        wind: snapshot(speedKts, directionDeg),
        ...(gearIds ? { gearIds } : {}),
      },
    },
  };
}

/** A session with a WindBlock but NO frozen snapshot (manual log, fetch failed). */
function windlessSession(id: string): ObservationOf<'session'> {
  const s = windSession(id, 0);
  delete (s.payload.wind as { wind?: WindSnapshot }).wind;
  return s;
}

describe('circularDeltaDeg — wraparound-aware bearing distance', () => {
  it('handles wraparound: 350° vs 10° is 20°, not 340°', () => {
    expect(circularDeltaDeg(350, 10)).toBe(20);
    expect(circularDeltaDeg(10, 350)).toBe(20);
  });

  it('plain cases: identical = 0, opposite = 180', () => {
    expect(circularDeltaDeg(90, 90)).toBe(0);
    expect(circularDeltaDeg(0, 180)).toBe(180);
    expect(circularDeltaDeg(45, 90)).toBe(45);
  });
});

describe('findSimilarWindSessions — ranked descriptive history', () => {
  it('ranks by speed proximity, best (lowest score) first', () => {
    const sessions = [
      windSession('far', 20),
      windSession('close', 16),
      windSession('exact', 15),
    ];
    const result = findSimilarWindSessions(sessions, { speedKts: 15 });
    expect(result.map((r) => r.session.id)).toEqual(['exact', 'close', 'far']);
    expect(result[0].score).toBe(0);
    expect(result[0].score).toBeLessThan(result[1].score);
    expect(result[1].score).toBeLessThan(result[2].score);
  });

  it('uses circular direction as the tiebreaker: 355° beats 90° for a 5° target', () => {
    const sessions = [
      windSession('cross', 18, 90), // 85° off
      windSession('wrapped', 18, 355), // 10° off, across the 0° seam
    ];
    const result = findSimilarWindSessions(sessions, {
      speedKts: 18,
      directionDeg: 5,
    });
    expect(result.map((r) => r.session.id)).toEqual(['wrapped', 'cross']);
  });

  it('speed stays primary: a dead-on direction never outranks a much closer speed', () => {
    const sessions = [
      windSession('closerSpeed', 15, 180), // 0 speed delta, opposite direction
      windSession('matchedDirection', 19, 0), // 4 kts off, perfect direction
    ];
    const result = findSimilarWindSessions(sessions, {
      speedKts: 15,
      directionDeg: 0,
    });
    expect(result[0].session.id).toBe('closerSpeed');
  });

  it('skips the direction term when the session lacks one — no fabricated 0°', () => {
    const sessions = [
      windSession('noDirection', 15), // exact speed, direction absent
      windSession('withDirection', 15, 180), // exact speed, opposite direction
    ];
    const result = findSimilarWindSessions(sessions, {
      speedKts: 15,
      directionDeg: 0,
    });
    // The direction-less session pays no direction penalty (term omitted, not 0-filled).
    const noDir = result.find((r) => r.session.id === 'noDirection')!;
    const withDir = result.find((r) => r.session.id === 'withDirection')!;
    expect(noDir.score).toBe(0);
    expect(withDir.score).toBeGreaterThan(0);
  });

  it('skips the direction term when the TARGET lacks one', () => {
    const sessions = [windSession('a', 15, 90), windSession('b', 15, 270)];
    const result = findSimilarWindSessions(sessions, { speedKts: 15 });
    expect(result).toHaveLength(2);
    expect(result[0].score).toBe(0);
    expect(result[1].score).toBe(0);
  });

  it('ignores sessions without a frozen wind snapshot', () => {
    const plainGym: ObservationOf<'session'> = {
      ...windSession('gym', 15),
      payload: { kind: 'session', modality: 'gym' },
    };
    const sessions = [windlessSession('noSnapshot'), plainGym, windSession('real', 15)];
    const result = findSimilarWindSessions(sessions, { speedKts: 15 });
    expect(result.map((r) => r.session.id)).toEqual(['real']);
  });

  it('filters out sessions beyond maxSpeedDeltaKts (default 6)', () => {
    const sessions = [
      windSession('inside', 20), // delta 5
      windSession('edge', 21), // delta 6 — inclusive boundary stays in
      windSession('outside', 22), // delta 7 — out
    ];
    const result = findSimilarWindSessions(sessions, { speedKts: 15 });
    expect(result.map((r) => r.session.id)).toEqual(['inside', 'edge']);
  });

  it('honors a custom maxSpeedDeltaKts', () => {
    const sessions = [windSession('near', 16), windSession('far', 19)];
    const result = findSimilarWindSessions(
      sessions,
      { speedKts: 15 },
      { maxSpeedDeltaKts: 2 }
    );
    expect(result.map((r) => r.session.id)).toEqual(['near']);
  });

  it('caps results at maxResults (default 5)', () => {
    const sessions = [10, 11, 12, 13, 14, 15].map((kts, i) =>
      windSession(`s${i}`, kts)
    );
    const capped = findSimilarWindSessions(sessions, { speedKts: 12 });
    expect(capped).toHaveLength(5);

    const two = findSimilarWindSessions(sessions, { speedKts: 12 }, { maxResults: 2 });
    expect(two.map((r) => r.session.id)).toEqual(['s2', 's1']);
  });

  it('returns [] for empty input', () => {
    expect(findSimilarWindSessions([], { speedKts: 15 })).toEqual([]);
  });

  it('returns the full session so callers can read gear off the payload', () => {
    const sessions = [windSession('geared', 15, 90, ['wing-9m', 'board-95l'])];
    const result = findSimilarWindSessions(sessions, { speedKts: 15 });
    expect(result[0].session.payload.wind?.gearIds).toEqual(['wing-9m', 'board-95l']);
  });
});
