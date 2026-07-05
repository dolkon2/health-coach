import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import {
  buildSessionObservation,
  sessionFormFromObservation,
  emptySessionForm,
  type SessionForm,
} from '../session';

const CTX = {
  id: 's-import-1',
  now: '2026-07-01T19:30:00.000Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'kg',
  distanceUnit: 'km',
} as const;

const PATH: GeoPoint[] = [
  { lat: 45.5, lng: -122.6, tsSec: 1782921600, eleM: 100 },
  { lat: 45.51, lng: -122.6, tsSec: 1782922200, eleM: 140 },
  { lat: 45.52, lng: -122.6, tsSec: 1782922800, eleM: 120 },
];

function importedRunForm(): SessionForm {
  const f = emptySessionForm();
  return {
    ...f,
    activity: 'run',
    durationMin: '20',
    endurance: {
      distance: '2.2',
      avgHr: '',
      energySystem: 'aerobic',
      gpsPath: PATH,
      elevationGainM: 40,
      importMeta: {
        format: 'gpx',
        filename: 'morning_run.gpx',
        startTime: '2026-07-01T16:00:00.000Z',
      },
    },
  };
}

describe('GPX-imported session build', () => {
  it('writes route + elevation onto the payload with fileimport provenance', () => {
    const obs = buildSessionObservation(importedRunForm(), CTX);

    expect(obs.payload.endurance?.gpsPath).toEqual(PATH);
    expect(obs.payload.endurance?.elevationGainM).toBe(40);
    expect(obs.payload.endurance?.distanceM).toBe(2200);
    expect(obs.source).toEqual({ type: 'fileimport', format: 'gpx', filename: 'morning_run.gpx' });
    // Device-recorded trace: measured, not guessed — above manual 0.5, below live watch 0.95.
    expect(obs.fidelity).toBe(0.9);
    // The session happened when the file says it did; it was logged now.
    expect(obs.occurredAt).toBe('2026-07-01T16:00:00.000Z');
    expect(obs.loggedAt).toBe(CTX.now);
    expect(obs.tier).toBe(1);
  });

  it('a manual GPS session is untouched by the new fields', () => {
    const f = emptySessionForm();
    const obs = buildSessionObservation(
      { ...f, activity: 'run', durationMin: '30', endurance: { distance: '5', avgHr: '', energySystem: 'aerobic' } },
      CTX
    );
    expect(obs.payload.endurance?.gpsPath).toBeUndefined();
    expect(obs.source).toEqual({ type: 'manual' });
    expect(obs.fidelity).toBe(0.5);
    expect(obs.occurredAt).toBe(CTX.now);
  });

  it('round-trips through the edit path: form → build → form → build is stable', () => {
    const first = buildSessionObservation(importedRunForm(), CTX);
    const rebuiltForm = sessionFormFromObservation(
      first,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => 'x'
    );

    expect(rebuiltForm.endurance.gpsPath).toEqual(PATH);
    expect(rebuiltForm.endurance.elevationGainM).toBe(40);
    expect(rebuiltForm.endurance.importMeta).toEqual({
      format: 'gpx',
      filename: 'morning_run.gpx',
      startTime: '2026-07-01T16:00:00.000Z',
    });

    // Rebuild as the edit path does (now = original occurredAt) and confirm
    // nothing drifts: same route, same provenance, same date.
    const second = buildSessionObservation(rebuiltForm, {
      ...CTX,
      now: first.occurredAt,
    });
    expect(second.payload.endurance).toEqual(first.payload.endurance);
    expect(second.source).toEqual(first.source);
    expect(second.occurredAt).toBe(first.occurredAt);
  });

  it('an imported route with fewer than 2 points is dropped, not stored', () => {
    const f = importedRunForm();
    f.endurance.gpsPath = [PATH[0]];
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.endurance?.gpsPath).toBeUndefined();
    expect(obs.source).toEqual({ type: 'manual' });
    expect(obs.fidelity).toBe(0.5);
  });
});
