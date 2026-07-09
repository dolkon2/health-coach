import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import {
  buildSessionObservation,
  enduranceWithRoute,
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

/**
 * The Proof — enduranceWithRoute rebuilds the slice, never spreads it, so a
 * prior route's provenance can't linger on new geometry:
 *   1. Importing an <ele>-less route over a form holding a 'gps'-labeled gain
 *      drops BOTH stale keys — no fabricated "GPS-computed" gain on a file
 *      that contains zero elevation data (⚑ E-9).
 *   2. capture → import leaves no stale captureMeta beside the new importMeta
 *      (and vice versa).
 *   3. Hand-entered fields (avgHr/energySystem, distance when the route has
 *      none) survive the swap.
 */
describe('enduranceWithRoute (route-attach reducer)', () => {
  const stale: SessionForm['endurance'] = {
    distance: '4.2',
    avgHr: '150',
    energySystem: 'aerobic',
    gpsPath: PATH,
    elevationGainM: 500,
    elevationGainSource: 'gps',
    importMeta: { format: 'gpx', filename: 'first.gpx', startTime: '2026-07-01T15:00:00.000Z' },
  };
  const NEW_PATH: GeoPoint[] = [
    { lat: 44.0, lng: -121.0, tsSec: 0 },
    { lat: 44.01, lng: -121.0, tsSec: 0 },
  ];

  it('a gain-less second import drops the previous gain AND its gps label', () => {
    const next = enduranceWithRoute(stale, { gpsPath: NEW_PATH }, {
      importMeta: { format: 'gpx', filename: 'planned.gpx' },
    });
    expect(next.gpsPath).toBe(NEW_PATH);
    expect('elevationGainM' in next).toBe(false);
    expect('elevationGainSource' in next).toBe(false);
    expect(next.importMeta).toEqual({ format: 'gpx', filename: 'planned.gpx' });
    // Hand-entered fields survive; the typed distance stays when the route has none.
    expect(next.avgHr).toBe('150');
    expect(next.energySystem).toBe('aerobic');
    expect(next.distance).toBe('4.2');
  });

  it('a gain WITH a label lands both keys; a caller-supplied distance replaces the old', () => {
    const next = enduranceWithRoute(
      stale,
      { gpsPath: NEW_PATH, distance: '7.5', elevationGainM: 120, elevationGainSource: 'gps' },
      { importMeta: { format: 'gpx' } }
    );
    expect(next.elevationGainM).toBe(120);
    expect(next.elevationGainSource).toBe('gps');
    expect(next.distance).toBe('7.5');
  });

  it('a gain without a label (planned <rte> file) lands the value alone', () => {
    const next = enduranceWithRoute(stale, { gpsPath: NEW_PATH, elevationGainM: 80 }, {
      importMeta: { format: 'gpx' },
    });
    expect(next.elevationGainM).toBe(80);
    expect('elevationGainSource' in next).toBe(false);
  });

  it('capture over a prior import carries no stale importMeta (and import drops captureMeta)', () => {
    const captured = enduranceWithRoute(stale, { gpsPath: NEW_PATH }, {
      captureMeta: { startTime: '2026-07-01T18:00:00.000Z' },
    });
    expect('importMeta' in captured).toBe(false);
    expect(captured.captureMeta?.startTime).toBe('2026-07-01T18:00:00.000Z');

    const reimported = enduranceWithRoute(captured, { gpsPath: PATH }, {
      importMeta: { format: 'gpx', filename: 'second.gpx' },
    });
    expect('captureMeta' in reimported).toBe(false);
    expect(reimported.importMeta?.filename).toBe('second.gpx');
  });
});
