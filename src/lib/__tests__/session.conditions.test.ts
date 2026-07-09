/**
 * The Proof — frozen conditions ride the session honestly (E3, ⚑ E-2/⚑ E-3):
 *   1. A conditionsMeta on the endurance slice writes payload.conditions at
 *      build — verbatim, tier-3 context BESIDE the tier-1 session — and
 *      survives build → invert → rebuild unchanged (an edit can't shed or
 *      mutate what was frozen).
 *   2. Conditions ride ONLY with the route they were fetched for: no attached
 *      route → payload.conditions never lands, whatever the form holds.
 *   3. A pre-E3 row (no conditions key) hydrates with conditionsMeta ABSENT —
 *      never {} — and rebuilds without inventing one (absence honest).
 *   4. enduranceWithRoute drops a previous route's conditionsMeta: new
 *      geometry starts with no frozen sky until its own fetch lands.
 */
import { describe, it, expect } from '@jest/globals';
import {
  buildSessionObservation,
  emptySessionForm,
  enduranceWithRoute,
  sessionFormFromObservation,
  type BuildContext,
  type SessionForm,
} from '../session';
import type { ConditionsSnapshot } from '@core/conditions';
import type { GeoPoint, ObservationOf } from '@core/observation';

const CTX: BuildContext = {
  id: 'e3-1',
  now: '2026-07-05T17:00:00Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'kg',
  distanceUnit: 'km',
};

const SNAP: ConditionsSnapshot = {
  weather: {
    tier: 3,
    source: 'open-meteo',
    fetchedAt: '2026-07-05T12:00:00.000Z',
    tempC: 18.3,
    windSpeedKmh: 8.8,
    cloudCoverPct: 12,
    freezingLevelM: 3940,
    modelHourUtc: '2026-07-03T14:00:00Z',
  },
};

const gp = (over: Partial<GeoPoint>): GeoPoint => ({ lat: 45.37, lng: -121.7, tsSec: 0, ...over });

function routedRun(conditionsMeta?: ConditionsSnapshot): SessionForm {
  const f = emptySessionForm();
  f.activity = 'run';
  f.durationMin = '40';
  f.endurance = {
    distance: '',
    avgHr: '',
    energySystem: 'aerobic',
    gpsPath: [gp({ tsSec: 1_000 }), gp({ lat: 45.371, tsSec: 1_600 })],
    captureMeta: { startTime: '2026-07-03T14:20:00Z' },
    ...(conditionsMeta ? { conditionsMeta } : {}),
  };
  return f;
}

function invert(obs: ObservationOf<'session'>): SessionForm {
  let n = 0;
  return sessionFormFromObservation(obs, { weightUnit: 'kg', distanceUnit: 'km' }, () =>
    String(++n)
  );
}

describe('payload.conditions round-trip', () => {
  it('writes the snapshot verbatim and survives build → invert → rebuild', () => {
    const obs = buildSessionObservation(routedRun(SNAP), CTX);
    expect(obs.payload.conditions).toEqual(SNAP);

    const restored = invert(obs);
    expect(restored.endurance.conditionsMeta).toEqual(SNAP);

    const rebuilt = buildSessionObservation(restored, CTX);
    expect(rebuilt.payload.conditions).toEqual(SNAP);
  });

  it('never lands without the route it was fetched for', () => {
    const f = routedRun(SNAP);
    f.endurance = { ...f.endurance, gpsPath: undefined, captureMeta: undefined };
    const obs = buildSessionObservation(f, CTX);
    expect('conditions' in obs.payload).toBe(false);
  });

  it('a pre-E3 row hydrates with conditionsMeta absent and rebuilds without inventing one', () => {
    const obs = buildSessionObservation(routedRun(), CTX);
    expect('conditions' in obs.payload).toBe(false);

    const restored = invert(obs);
    expect('conditionsMeta' in restored.endurance).toBe(false);

    const rebuilt = buildSessionObservation(restored, CTX);
    expect('conditions' in rebuilt.payload).toBe(false);
  });
});

describe('enduranceWithRoute — frozen sky never outlives its route', () => {
  it('drops the previous route’s conditionsMeta when new geometry lands', () => {
    const prev = routedRun(SNAP).endurance;
    const next = enduranceWithRoute(
      prev,
      { gpsPath: [gp({ lat: 44.0, lng: -120.0, tsSec: 9_000 }), gp({ lat: 44.01, tsSec: 9_600 })] },
      { importMeta: { format: 'gpx', startTime: '2026-07-04T09:00:00Z' } }
    );
    expect('conditionsMeta' in next).toBe(false);
  });
});
