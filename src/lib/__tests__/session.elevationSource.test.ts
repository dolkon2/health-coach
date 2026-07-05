/**
 * The Proof — elevationGainSource rides the session form honestly (E2):
 *   1. The source is written ONLY alongside a written elevationGainM — a label
 *      without a value would fabricate provenance; no gain → neither key.
 *   2. Route prefill ('gps') survives build → invert → rebuild verbatim.
 *   3. A pre-E2 payload (no source; possibly no gain) hydrates with the key
 *      absent — never defaulted — and rebuilds without inventing one.
 *   4. applyElevationGainEdit is the honesty gate on the text field: any direct
 *      edit is the user's number → 'manual', even over a 'gps' prefill; typed
 *      with no route → 'manual'; cleared/unparsable/negative → BOTH keys removed.
 *   5. An explicit 0 WITH a source is a declared fact — a typed zero ('manual')
 *      or a measured flat track ('gps') — and survives build + round-trip
 *      (null ≠ 0; what the form caption shows is what saves). A sourceless 0
 *      never lands.
 */
import { describe, it, expect } from '@jest/globals';
import {
  applyElevationGainEdit,
  buildSessionObservation,
  emptySessionForm,
  sessionFormFromObservation,
  type BuildContext,
  type SessionForm,
} from '../session';
import type { GeoPoint, ObservationOf } from '@core/observation';

const CTX: BuildContext = {
  id: 'e2-1',
  now: '2026-07-05T17:00:00Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'kg',
  distanceUnit: 'km',
};

const gp = (over: Partial<GeoPoint>): GeoPoint => ({ lat: 0, lng: 0, tsSec: 0, ...over });

function capturedRun(): SessionForm {
  const f = emptySessionForm();
  f.activity = 'run';
  f.durationMin = '30';
  f.endurance = {
    distance: '',
    avgHr: '',
    energySystem: 'aerobic',
    gpsPath: [
      gp({ lat: 0, lng: 0, tsSec: 1_000, eleM: 100, eleSource: 'gps' }),
      gp({ lat: 0, lng: 1, tsSec: 1_600, eleM: 130, eleSource: 'gps' }),
    ],
    elevationGainM: 30,
    elevationGainSource: 'gps',
    captureMeta: { startTime: '2026-07-05T16:30:00Z' },
  };
  return f;
}

function invert(obs: ObservationOf<'session'>): SessionForm {
  let n = 0;
  return sessionFormFromObservation(
    obs,
    { weightUnit: 'kg', distanceUnit: 'km' },
    () => `g${n++}`
  );
}

describe('elevationGainSource through build', () => {
  it('writes the source only alongside a written gain', () => {
    const obs = buildSessionObservation(capturedRun(), CTX);
    expect(obs.payload.endurance?.elevationGainM).toBe(30);
    expect(obs.payload.endurance?.elevationGainSource).toBe('gps');
  });

  it('no gain → neither key, even if a stray source lingers on the form', () => {
    const f = capturedRun();
    delete f.endurance.elevationGainM; // source left behind on purpose
    const obs = buildSessionObservation(f, CTX);
    expect('elevationGainM' in (obs.payload.endurance ?? {})).toBe(false);
    expect('elevationGainSource' in (obs.payload.endurance ?? {})).toBe(false);
  });

  it('a gain without a source (pre-E2 form state) writes the gain alone', () => {
    const f = capturedRun();
    delete f.endurance.elevationGainSource;
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.endurance?.elevationGainM).toBe(30);
    expect('elevationGainSource' in (obs.payload.endurance ?? {})).toBe(false);
  });

  it('round-trips gps provenance (and per-point eleSource) through invert → rebuild', () => {
    const obs = buildSessionObservation(capturedRun(), CTX);
    const inverted = invert(obs);
    expect(inverted.endurance.elevationGainM).toBe(30);
    expect(inverted.endurance.elevationGainSource).toBe('gps');
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'e2-2' });
    expect(rebuilt.payload.endurance?.elevationGainSource).toBe('gps');
    // The stored gpsPath rides untouched — point labels included.
    expect(rebuilt.payload.endurance?.gpsPath?.[0].eleSource).toBe('gps');
  });

  it('a pre-E2 persisted row hydrates with the source absent, never defaulted', () => {
    const obs = buildSessionObservation(capturedRun(), CTX);
    const legacy: ObservationOf<'session'> = {
      ...obs,
      payload: {
        ...obs.payload,
        endurance: {
          energySystem: 'aerobic',
          elevationGainM: 250,
          gpsPath: [gp({ tsSec: 1_000 }), gp({ lng: 1, tsSec: 1_600 })], // old points: no eleSource
        },
      },
    };
    const inverted = invert(legacy);
    expect(inverted.endurance.elevationGainM).toBe(250);
    expect(inverted.endurance.elevationGainSource).toBeUndefined();
    expect('elevationGainSource' in inverted.endurance).toBe(false);
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'e2-3' });
    expect(rebuilt.payload.endurance?.elevationGainM).toBe(250);
    expect('elevationGainSource' in (rebuilt.payload.endurance ?? {})).toBe(false);
  });

  it('an explicit 0 with a source is a fact, not absence: it writes and round-trips', () => {
    // A flat track run: the user cleared the prefill and typed 0, or a flat
    // GPX computed 0 through the hysteresis. The caption shows "0 m gain ·
    // elevation: …" — the saved observation must agree with the display.
    const f = capturedRun();
    f.endurance.elevationGainM = 0;
    f.endurance.elevationGainSource = 'gps';
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.endurance?.elevationGainM).toBe(0);
    expect(obs.payload.endurance?.elevationGainSource).toBe('gps');

    const inverted = invert(obs);
    expect(inverted.endurance.elevationGainM).toBe(0);
    expect(inverted.endurance.elevationGainSource).toBe('gps');
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'e2-5' });
    expect(rebuilt.payload.endurance?.elevationGainM).toBe(0);
  });

  it('a user-typed 0 saves as manual — the reducer and build agree end to end', () => {
    const f = capturedRun();
    f.endurance = applyElevationGainEdit(f.endurance, '0');
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.endurance?.elevationGainM).toBe(0);
    expect(obs.payload.endurance?.elevationGainSource).toBe('manual');
  });

  it('a sourceless 0 never lands: neither key written', () => {
    const f = capturedRun();
    f.endurance.elevationGainM = 0;
    delete f.endurance.elevationGainSource;
    const obs = buildSessionObservation(f, CTX);
    expect('elevationGainM' in (obs.payload.endurance ?? {})).toBe(false);
    expect('elevationGainSource' in (obs.payload.endurance ?? {})).toBe(false);
  });

  it('a fully pre-E2 row (no gain at all) hydrates and rebuilds clean', () => {
    const f = emptySessionForm();
    f.activity = 'run';
    f.durationMin = '30';
    f.endurance = { distance: '5', avgHr: '', energySystem: 'aerobic' };
    const inverted = invert(buildSessionObservation(f, CTX));
    expect(inverted.endurance.elevationGainM).toBeUndefined();
    expect(inverted.endurance.elevationGainSource).toBeUndefined();
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'e2-4' });
    expect('elevationGainSource' in (rebuilt.payload.endurance ?? {})).toBe(false);
  });
});

describe('applyElevationGainEdit (the text-field reducer)', () => {
  it('typing over a gps prefill re-labels the gain manual — the user overrode it', () => {
    const edited = applyElevationGainEdit(capturedRun().endurance, '450');
    expect(edited.elevationGainM).toBe(450);
    expect(edited.elevationGainSource).toBe('manual');
    // Everything else on the slice survives untouched.
    expect(edited.gpsPath).toHaveLength(2);
    expect(edited.captureMeta?.startTime).toBe('2026-07-05T16:30:00Z');
  });

  it('typing with no route at all is manual too', () => {
    const bare: SessionForm['endurance'] = { distance: '', avgHr: '', energySystem: 'aerobic' };
    const edited = applyElevationGainEdit(bare, '120');
    expect(edited.elevationGainM).toBe(120);
    expect(edited.elevationGainSource).toBe('manual');
  });

  it('clearing the field removes BOTH keys — no value, no label', () => {
    const cleared = applyElevationGainEdit(capturedRun().endurance, '');
    expect('elevationGainM' in cleared).toBe(false);
    expect('elevationGainSource' in cleared).toBe(false);
  });

  it('an unparsable entry is treated as cleared, never stored', () => {
    const cleared = applyElevationGainEdit(capturedRun().endurance, 'abc');
    expect('elevationGainM' in cleared).toBe(false);
    expect('elevationGainSource' in cleared).toBe(false);
  });

  it('typing 0 keeps it — a flat session is a declaration, not absence', () => {
    const edited = applyElevationGainEdit(capturedRun().endurance, '0');
    expect(edited.elevationGainM).toBe(0);
    expect(edited.elevationGainSource).toBe('manual');
  });

  it('a negative "gain" is meaningless and treated as cleared — never displayed or stored', () => {
    const cleared = applyElevationGainEdit(capturedRun().endurance, '-50');
    expect('elevationGainM' in cleared).toBe(false);
    expect('elevationGainSource' in cleared).toBe(false);
  });
});
