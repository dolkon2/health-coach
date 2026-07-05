/**
 * Water dimension — session form blocks (contract §5 + §8).
 *
 * Guards the freeze-at-save round trip: whitewater and wind blocks (with their
 * IMMUTABLE gauge/wind snapshots) and ingested swim lengths must survive
 * observation → form → observation byte-identical, because the edit path
 * rebuilds the whole payload from form state — anything the inverse drops is
 * silently destroyed on edit. Also guards omit-when-absent: an untouched
 * section writes no block, an empty-string numeric stays absent (null ≠ 0),
 * and legacy payloads without the new blocks hydrate fine.
 */
import { describe, it, expect } from '@jest/globals';
import type { ObservationOf, SwimLength } from '@core/observation';
import type { GaugeSnapshot, WindSnapshot } from '@core/conditions/snapshot';
import {
  buildSessionObservation,
  emptySessionForm,
  resolveSurface,
  sessionFormFromObservation,
  validateSessionForm,
  type BuildContext,
  type SessionForm,
} from '../session';
import { activityById } from '../activity';

const CTX: BuildContext = {
  id: 'w1',
  now: '2026-07-05T17:00:00Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'kg',
  distanceUnit: 'km',
};

const UNITS = { weightUnit: 'kg' as const, distanceUnit: 'km' as const };

function invert(obs: ObservationOf<'session'>): SessionForm {
  let n = 0;
  return sessionFormFromObservation(obs, UNITS, () => `g${n++}`);
}

const GAUGE: GaugeSnapshot = {
  siteId: 'USGS-14123500',
  siteName: 'WHITE SALMON RIVER NEAR UNDERWOOD, WA',
  readings: [
    { parameter: 'discharge', value: 1080, unit: 'ft^3/s', timeUtc: '2026-07-05T16:45:00Z' },
    { parameter: 'gaugeHeight', value: 3.42, unit: 'ft', timeUtc: '2026-07-05T16:45:00Z' },
  ],
  trend: 'falling',
  observedAtUtc: '2026-07-05T16:45:00Z',
  fetchedAtUtc: '2026-07-05T17:00:00Z',
  source: 'usgs',
  approvalStatus: 'Provisional',
};

const WIND: WindSnapshot = {
  lat: 45.7115,
  lng: -121.4977,
  speedKts: 22.4,
  gustKts: 28.1,
  directionDeg: 285,
  observedAtUtc: '2026-07-05T16:00:00Z',
  fetchedAtUtc: '2026-07-05T17:00:00Z',
  source: 'open-meteo-forecast',
};

describe('parawing activity registry entry', () => {
  it('exists on the gps surface with the wind-sport shape', () => {
    const a = activityById('parawing');
    expect(a).toBeDefined();
    expect(a?.surface).toBe('gps');
    expect(a?.modality).toBe('other'); // same shape as wingfoil
    expect(a?.defaultEnergySystem).toBe('mixed');
    expect(resolveSurface({ activity: 'parawing', modality: null })).toBe('gps');
  });
});

describe('whitewater block — build + freeze-at-save round trip', () => {
  function whitewaterForm(): SessionForm {
    const f = emptySessionForm();
    f.activity = 'whitewater';
    f.durationMin = '90';
    f.endurance = { distance: '8', avgHr: '', energySystem: 'mixed' };
    f.whitewater = {
      riverName: 'White Salmon',
      sectionName: 'Green Truss',
      sectionClass: 'IV-V', // legitimate free-text notation — must never gate saving
      waterTempC: '8.5',
      hazards: 'wood in Upper Zig Zag',
      swims: '1',
      rolls: '3',
      spotId: 'spot-truss',
      boatGearId: 'gear-antix',
      gauge: GAUGE,
      precip72hMm: 14.2,
    };
    return f;
  }

  it('writes every field onto payload.whitewater (snapshot frozen whole)', () => {
    const f = whitewaterForm();
    expect(validateSessionForm(f)).toBeNull(); // sectionClass 'IV-V' never blocks
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.whitewater).toEqual({
      riverName: 'White Salmon',
      sectionName: 'Green Truss',
      spotId: 'spot-truss',
      gauge: GAUGE,
      sectionClass: 'IV-V',
      boatGearId: 'gear-antix',
      waterTempC: 8.5,
      hazards: 'wood in Upper Zig Zag',
      swims: 1,
      rolls: 3,
      precip72hMm: 14.2,
    });
    // The envelope still rides alongside (gps surface unchanged).
    expect(obs.payload.endurance?.energySystem).toBe('mixed');
  });

  it('round-trips observation → form → observation byte-identical', () => {
    const obs = buildSessionObservation(whitewaterForm(), CTX);
    const inverted = invert(obs);
    // The snapshot restores carry-whole — never refetched, never rebuilt.
    expect(inverted.whitewater.gauge).toEqual(GAUGE);
    expect(inverted.whitewater.sectionClass).toBe('IV-V');
    expect(inverted.whitewater.waterTempC).toBe('8.5');
    expect(inverted.whitewater.swims).toBe('1');
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'w2' });
    expect(rebuilt.payload).toEqual(obs.payload);
  });

  it("keeps a typed '0' (zero swims is a fact, null ≠ 0)", () => {
    const f = whitewaterForm();
    f.whitewater.swims = '0';
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.whitewater?.swims).toBe(0);
    const rebuilt = buildSessionObservation(invert(obs), { ...CTX, id: 'w3' });
    expect(rebuilt.payload.whitewater?.swims).toBe(0);
  });

  it('empty-string numerics stay absent — never a fabricated 0', () => {
    const f = emptySessionForm();
    f.activity = 'whitewater';
    f.durationMin = '60';
    f.whitewater.riverName = 'Klickitat'; // one populated field so the block writes
    // waterTempC / swims / rolls left as '' — must be ABSENT, not 0.
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.whitewater).toEqual({ riverName: 'Klickitat' });
  });
});

describe('wind block — build + freeze-at-save round trip', () => {
  function windForm(activity = 'parawing'): SessionForm {
    const f = emptySessionForm();
    f.activity = activity;
    f.durationMin = '75';
    f.endurance = { distance: '', avgHr: '', energySystem: 'mixed' };
    f.wind = {
      note: 'lit on the 4.2',
      spotId: 'spot-sandbar',
      spotName: 'Hood River sandbar',
      sessionStyle: 'downwind',
      endSpotId: 'spot-viento',
      endSpotName: 'Viento',
      wind: WIND,
      kitId: 'kit-lightwind',
      gearIds: ['gear-wing-42', 'gear-board-95', 'gear-foil-1100'],
    };
    return f;
  }

  it('writes snapshot + sessionStyle + endSpot + kit/gear onto payload.wind', () => {
    const obs = buildSessionObservation(windForm(), CTX);
    expect(obs.payload.activity).toBe('parawing'); // activity id IS the sub-sport
    expect(obs.payload.wind).toEqual({
      spotId: 'spot-sandbar',
      spotName: 'Hood River sandbar',
      sessionStyle: 'downwind',
      endSpotId: 'spot-viento',
      endSpotName: 'Viento',
      wind: WIND,
      kitId: 'kit-lightwind',
      gearIds: ['gear-wing-42', 'gear-board-95', 'gear-foil-1100'],
      note: 'lit on the 4.2',
    });
  });

  it('round-trips observation → form → observation byte-identical', () => {
    const obs = buildSessionObservation(windForm('wingfoil'), CTX);
    const inverted = invert(obs);
    expect(inverted.wind.wind).toEqual(WIND); // carry-whole, never refetched
    expect(inverted.wind.sessionStyle).toBe('downwind');
    expect(inverted.wind.endSpotId).toBe('spot-viento');
    expect(inverted.wind.endSpotName).toBe('Viento');
    expect(inverted.wind.kitId).toBe('kit-lightwind');
    expect(inverted.wind.gearIds).toEqual(['gear-wing-42', 'gear-board-95', 'gear-foil-1100']);
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'w4' });
    expect(rebuilt.payload).toEqual(obs.payload);
  });

  it('a back-and-forth session with no end spot round-trips too', () => {
    const f = windForm();
    f.wind = { note: '', spotId: 'spot-sandbar', spotName: 'Hood River sandbar', sessionStyle: 'back-and-forth', wind: WIND };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.wind?.sessionStyle).toBe('back-and-forth');
    expect(obs.payload.wind?.endSpotId).toBeUndefined();
    const rebuilt = buildSessionObservation(invert(obs), { ...CTX, id: 'w5' });
    expect(rebuilt.payload).toEqual(obs.payload);
  });
});

describe('untouched sections write no blocks (omit-when-absent)', () => {
  it('a plain run carries neither whitewater nor wind', () => {
    const f = emptySessionForm();
    f.activity = 'run';
    f.durationMin = '30';
    f.endurance = { distance: '5', avgHr: '', energySystem: 'aerobic' };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.whitewater).toBeUndefined();
    expect(obs.payload.wind).toBeUndefined();
  });

  it('a whitewater session with an untouched section writes no empty block', () => {
    const f = emptySessionForm();
    f.activity = 'whitewater';
    f.durationMin = '60';
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.whitewater).toBeUndefined(); // absent, not {}
    expect(obs.payload.wind).toBeUndefined();
  });

  it('an empty gearIds array does not conjure a wind block', () => {
    const f = emptySessionForm();
    f.activity = 'wingfoil';
    f.durationMin = '45';
    f.wind = { note: '   ', gearIds: [] }; // whitespace note + empty picks = untouched
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.wind).toBeUndefined();
  });
});

describe('swim lengths — ingested per-length rows ride the form whole', () => {
  const LENGTHS: SwimLength[] = [
    { startSec: 0, durationS: 32.5, distanceM: 22.86, strokes: 18, stroke: 'freestyle' },
    { startSec: 41, durationS: 34.1, distanceM: 22.86, strokes: 19, stroke: 'freestyle' },
    { startSec: 92, durationS: 48.7, distanceM: 22.86, stroke: 'kickboard' },
    { startSec: 150, durationS: 36.2, distanceM: 22.86, strokes: 21, stroke: 'unknown' },
  ];

  /** An ingested pool swim as the HealthKit normalizer writes it: MEASURED
   * distance (1487.3 ≠ laps × poolLengthM), yard pool (22.86 m), no session-
   * level stroke. */
  function ingestedSwim(): ObservationOf<'session'> {
    return {
      id: 'hk1',
      kind: 'session',
      occurredAt: '2026-07-04T14:00:00Z',
      loggedAt: '2026-07-04T15:00:00Z',
      tz: 'America/Los_Angeles',
      tier: 1,
      fidelity: 0.95,
      source: { type: 'healthkit', rawType: 'HKWorkout', workoutUuid: 'uuid-abc' },
      payload: {
        kind: 'session',
        modality: 'swim',
        activity: 'swim',
        durationMin: 45,
        swimming: {
          energySystem: 'aerobic',
          distanceM: 1487.3, // the watch total — a measurement, not laps × length
          poolLengthM: 22.86, // 25 yd pool
          laps: 65,
          lengths: LENGTHS,
        },
      },
    };
  }

  it('restores lengths + measured distance carry-whole', () => {
    const form = invert(ingestedSwim());
    expect(form.swim.lengths).toEqual(LENGTHS);
    expect(form.swim.measuredDistanceM).toBe(1487.3);
    expect(form.swim.poolLengthM).toBe('22.86'); // yard pool survives (not rounded to '23')
    expect(form.swim.laps).toBe('65');
    expect(form.swim.distance).toBe(''); // no rounded display-unit shadow of the fact
  });

  it('rebuild keeps the measured distanceM — laps × poolLengthM is NOT recomputed', () => {
    const original = ingestedSwim();
    const rebuilt = buildSessionObservation(invert(original), { ...CTX, id: 'sw1' });
    expect(rebuilt.payload.swimming?.distanceM).toBe(1487.3); // not 22.86 × 65 = 1485.9
    expect(rebuilt.payload.swimming?.lengths).toEqual(LENGTHS);
    expect(rebuilt.payload.swimming?.stroke).toBeUndefined(); // per-length strokes are the truth
    expect(rebuilt.payload.swimming).toEqual(original.payload.swimming);
  });

  it('a manual pool swim (no lengths) still audits laps × pool length', () => {
    const f = emptySessionForm();
    f.activity = 'swim';
    f.durationMin = '30';
    f.swim = { ...f.swim, poolLengthM: '25', laps: '60' };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.swimming?.distanceM).toBe(1500);
    expect(obs.payload.swimming?.lengths).toBeUndefined();
    expect(obs.payload.swimming?.stroke).toBe('freestyle');
  });
});

describe('legacy payloads without the new blocks hydrate fine', () => {
  it('a pre-Water gps session restores seeded empty sections and rebuilds unchanged', () => {
    // Hand-built legacy observation: endurance only, no whitewater/wind/lengths.
    const legacy: ObservationOf<'session'> = {
      id: 'old1',
      kind: 'session',
      occurredAt: '2026-06-01T17:00:00Z',
      loggedAt: '2026-06-01T17:00:00Z',
      tz: 'America/Los_Angeles',
      tier: 1,
      fidelity: 0.5,
      source: { type: 'manual' },
      payload: {
        kind: 'session',
        modality: 'paddle',
        activity: 'kayak',
        durationMin: 60,
        endurance: { energySystem: 'aerobic', distanceM: 5000 },
      },
    };
    const form = invert(legacy);
    // New sections hydrate to their seeded empty defaults, snapshots absent.
    expect(form.whitewater.riverName).toBe('');
    expect(form.whitewater.gauge).toBeUndefined();
    expect(form.wind.note).toBe('');
    expect(form.wind.wind).toBeUndefined();
    expect(form.swim.lengths).toBeUndefined();
    // And an edit-save fabricates nothing.
    const rebuilt = buildSessionObservation(form, { ...CTX, id: 'old2' });
    expect(rebuilt.payload).toEqual(legacy.payload);
  });

  it('a legacy swimming payload without lengths round-trips unchanged', () => {
    const f = emptySessionForm();
    f.activity = 'swim';
    f.durationMin = '30';
    f.swim = { ...f.swim, poolLengthM: '25', laps: '60' };
    const obs = buildSessionObservation(f, CTX);
    const rebuilt = buildSessionObservation(invert(obs), { ...CTX, id: 'sw9' });
    expect(rebuilt.payload).toEqual(obs.payload);
  });
});
