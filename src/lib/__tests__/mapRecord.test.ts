import { describe, it, expect } from '@jest/globals';
import type { ObservationOf } from '@core/observation';
import type { Spot } from '@core/spot';
import {
  accuracyLevel,
  isRecordableActivity,
  resolveArmedActivity,
  resolveMapCenter,
  spotsWithCoords,
} from '../mapRecord';
import { activityById } from '../activity';

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
    payload: { kind: 'session', modality: 'other', ...payload },
  };
}

function spot(partial: Partial<Spot>): Spot {
  return { id: partial.id ?? 'sp', name: 'Spot', kind: 'launch', ...partial };
}

describe('isRecordableActivity', () => {
  it('is true for Earth/Water/Sky, false for Body', () => {
    expect(isRecordableActivity(activityById('kayak')!)).toBe(true); // water
    expect(isRecordableActivity(activityById('trail-run')!)).toBe(true); // earth
    expect(isRecordableActivity(activityById('paragliding')!)).toBe(true); // sky
    expect(isRecordableActivity(activityById('gym')!)).toBe(false); // body
  });
});

describe('resolveArmedActivity', () => {
  it('honors a recordable deep-linked activity id', () => {
    const a = resolveArmedActivity({ activityParam: 'kayak', sessionsNewestFirst: [] });
    expect(a.id).toBe('kayak');
  });

  it('ignores a Body deep-link and falls through (Body is logged in Training)', () => {
    // No history → falls all the way to the Earth archetype, never "gym".
    const a = resolveArmedActivity({ activityParam: 'gym', sessionsNewestFirst: [] });
    expect(a.id).toBe('trail-run');
  });

  it('resolves a deep-linked element to its default (most-recent then archetype)', () => {
    const withHistory = resolveArmedActivity({
      elementParam: 'water',
      sessionsNewestFirst: [session('2026-07-10', { activity: 'kayak' })],
    });
    expect(withHistory.id).toBe('kayak');
    const noHistory = resolveArmedActivity({ elementParam: 'sky', sessionsNewestFirst: [] });
    expect(noHistory.id).toBe('paragliding');
  });

  it('with no deep link, arms the single most-recently-logged Earth/Water/Sky sport', () => {
    const a = resolveArmedActivity({
      sessionsNewestFirst: [
        session('2026-07-10', { activity: 'gym' }), // body — skipped
        session('2026-07-09', { activity: 'kayak' }), // water — the pick
        session('2026-07-08', { activity: 'trail-run' }),
      ],
    });
    expect(a.id).toBe('kayak');
  });

  it('falls back to the Earth archetype when there is no usable history at all', () => {
    expect(resolveArmedActivity({ sessionsNewestFirst: [] }).id).toBe('trail-run');
  });
});

describe('spotsWithCoords', () => {
  it('keeps only spots with finite lat AND lng', () => {
    const kept = spotsWithCoords([
      spot({ id: 'a', lat: 45.7, lng: -121.5 }),
      spot({ id: 'b', lat: 45.7 }), // no lng
      spot({ id: 'c' }), // river-section style, no coords
      spot({ id: 'd', lat: Number.NaN, lng: -121 }),
    ]);
    expect(kept.map((s) => s.id)).toEqual(['a']);
  });
});

describe('accuracyLevel', () => {
  it('maps a fix accuracy to good / weak / unknown', () => {
    expect(accuracyLevel(8)).toBe('good');
    expect(accuracyLevel(50)).toBe('good');
    expect(accuracyLevel(51)).toBe('weak');
    expect(accuracyLevel(null)).toBe('unknown');
    expect(accuracyLevel(undefined)).toBe('unknown');
    expect(accuracyLevel(Number.NaN)).toBe('unknown');
  });
});

describe('resolveMapCenter', () => {
  it('centers on the user fix when present', () => {
    expect(
      resolveMapCenter({ userLoc: [-121.5, 45.7], spots: [] })
    ).toEqual({ center: [-121.5, 45.7], zoom: 13 });
  });

  it('centers on the spot centroid when there is no user fix', () => {
    const { center, zoom } = resolveMapCenter({
      userLoc: null,
      spots: [spot({ lat: 10, lng: 20 }), spot({ lat: 30, lng: 40 })],
    });
    expect(center).toEqual([30, 20]); // mean lng, mean lat
    expect(zoom).toBe(10);
  });

  it('invents no location when there is neither a fix nor a pinnable spot', () => {
    // Center AND zoom both undefined — the caller omits the Camera entirely so
    // MapLibre keeps its style default rather than parking a zoom at [0,0].
    const { center, zoom } = resolveMapCenter({ userLoc: null, spots: [spot({})] });
    expect(center).toBeUndefined();
    expect(zoom).toBeUndefined();
  });
});
