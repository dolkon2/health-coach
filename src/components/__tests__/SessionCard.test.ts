import { describe, it, expect } from '@jest/globals';
import type { ObservationOf } from '@core/observation';
import { sessionTrackOf } from '@/components/SessionCard';

function payload(
  partial: Partial<ObservationOf<'session'>['payload']> = {}
): ObservationOf<'session'>['payload'] {
  return { kind: 'session', modality: 'other', ...partial };
}

const track = [
  { lat: 45.7, lng: -121.5, tsSec: 1 },
  { lat: 45.71, lng: -121.51, tsSec: 2 },
];

describe('sessionTrackOf', () => {
  it('reads an Earth session track from endurance.gpsPath', () => {
    expect(sessionTrackOf(payload({ endurance: { energySystem: 'aerobic', gpsPath: track } }))).toBe(
      track
    );
  });

  it('reads a Water session track from paddling.gpsPath, not endurance', () => {
    expect(
      sessionTrackOf(payload({ paddling: { discipline: 'flatwater', gpsPath: track } }))
    ).toBe(track);
  });

  it('reads a Sky session track from sky.track', () => {
    expect(sessionTrackOf(payload({ sky: { track } }))).toBe(track);
  });

  it('returns undefined for a routeless (stats-only) session, never a fabricated track', () => {
    expect(sessionTrackOf(payload())).toBeUndefined();
  });
});
