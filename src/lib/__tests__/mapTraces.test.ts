import { describe, it, expect } from '@jest/globals';
import type { ObservationOf } from '@core/observation';
import { sessionTracks } from '../mapTraces';

function session(
  id: string,
  payload: Partial<ObservationOf<'session'>['payload']> = {}
): ObservationOf<'session'> {
  return {
    id,
    kind: 'session',
    occurredAt: '2026-07-15T12:00:00.000Z',
    loggedAt: '2026-07-15T12:00:00.000Z',
    tz: 'UTC',
    tier: 1,
    fidelity: 0.95,
    source: { type: 'manual' },
    payload: { kind: 'session', modality: 'other', ...payload },
  };
}

const track = [
  { lat: 45.7, lng: -121.5, tsSec: 1 },
  { lat: 45.71, lng: -121.51, tsSec: 2 },
];

describe('sessionTracks', () => {
  it('includes an Earth session track from endurance.gpsPath', () => {
    const out = sessionTracks([session('s1', { activity: 'trail-run', endurance: { energySystem: 'aerobic', gpsPath: track } })]);
    expect(out).toEqual([{ id: 's1', element: 'earth', points: track }]);
  });

  it('includes a Water session track from paddling.gpsPath, not endurance', () => {
    const out = sessionTracks([
      session('s2', { activity: 'kayak', paddling: { discipline: 'flatwater', gpsPath: track } }),
    ]);
    expect(out).toEqual([{ id: 's2', element: 'water', points: track }]);
  });

  it('includes a Sky session track from sky.track', () => {
    const out = sessionTracks([session('s3', { activity: 'paragliding', sky: { track } })]);
    expect(out).toEqual([{ id: 's3', element: 'sky', points: track }]);
  });

  it('structurally excludes Body — no track field is even consulted', () => {
    const out = sessionTracks([
      session('s4', {
        activity: 'gym',
        // Even if a track-shaped field somehow existed on a Body payload,
        // isMapElement's guard rejects the session before trackOf() runs.
        endurance: { energySystem: 'aerobic', gpsPath: track },
      }),
    ]);
    expect(out).toEqual([]);
  });

  it('omits a session with no track', () => {
    const out = sessionTracks([session('s5', { activity: 'trail-run' })]);
    expect(out).toEqual([]);
  });

  it('omits a session with a single-point track (nothing to draw)', () => {
    const out = sessionTracks([
      session('s6', { activity: 'trail-run', endurance: { energySystem: 'aerobic', gpsPath: [track[0]] } }),
    ]);
    expect(out).toEqual([]);
  });

  it('omits a session whose activity id does not resolve', () => {
    const out = sessionTracks([session('s7', { activity: 'not-a-real-activity' })]);
    expect(out).toEqual([]);
  });

  it('omits a session with no activity at all', () => {
    const out = sessionTracks([session('s8', {})]);
    expect(out).toEqual([]);
  });
});
