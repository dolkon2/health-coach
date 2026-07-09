/**
 * Pass 2 — surface-driven logger + activity identity + honest GPS fidelity.
 *
 * Complements sessionFlow.test.ts (the gym/endurance data path) by guarding the
 * three-layer model: an activity resolves a *surface* (which body/block) and a
 * nearest *modality* (what the engine reads); fidelity follows the surface; and
 * reveal() prefers the chosen identity over the coarse modality. Pure build/reveal
 * — no storage needed.
 */
import { describe, it, expect } from '@jest/globals';
import { reveal, computeWeeklyStimulus } from '@core/stimulus';
import type { GeoPoint } from '@core/observation';
import {
  buildSessionObservation,
  emptySessionForm,
  resolveSurface,
  sessionFormFromObservation,
  validateSessionForm,
  type BuildContext,
  type SessionForm,
} from '../session';

const CTX: BuildContext = {
  id: 's1',
  now: '2026-06-26T17:00:00Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'kg',
  distanceUnit: 'km',
};

/** A minimal valid gym form under the given activity identity. */
function calisthenicsForm(): SessionForm {
  const f = emptySessionForm();
  f.activity = 'calisthenics';
  f.durationMin = '40';
  f.gym.exercises = [
    {
      id: 'e1',
      name: 'pull-up',
      movementPattern: 'upper-pull',
      sets: [{ id: 'a', weight: '0', reps: '10', rir: '1', isWarmup: false }],
    },
  ];
  return f;
}

describe('Pass 2 — activity identity + surface routing', () => {
  it('resolves the surface from the activity, not the raw modality', () => {
    // Many identities → few surfaces (the router is invisible plumbing).
    expect(resolveSurface({ activity: 'calisthenics', modality: null })).toBe('gym');
    expect(resolveSurface({ activity: 'crossfit', modality: null })).toBe('gym');
    expect(resolveSurface({ activity: 'hike', modality: null })).toBe('gps');
    expect(resolveSurface({ activity: 'surf', modality: null })).toBe('gps');
    expect(resolveSurface({ activity: 'swim', modality: null })).toBe('swim');
    expect(resolveSurface({ activity: 'climb', modality: null })).toBe('climbing');
    expect(resolveSurface({ activity: 'yoga', modality: null })).toBe('practice');
    // Legacy / Today quick-log path: no identity, resolve from the modality.
    expect(resolveSurface({ modality: 'gym' })).toBe('gym');
    expect(resolveSurface({ modality: 'run' })).toBe('gps');
    expect(resolveSurface({ modality: 'other' })).toBe('other');
  });

  it('stores the identity and its nearest modality (Calisthenics → gym surface)', () => {
    const obs = buildSessionObservation(calisthenicsForm(), CTX);
    expect(obs.payload.activity).toBe('calisthenics');
    expect(obs.payload.modality).toBe('gym'); // nearest engine modality
    expect(obs.payload.lifting?.sets).toHaveLength(1);
    expect(obs.fidelity).toBe(0.95); // gym surface — set-by-set capture is precise
  });

  it('round-trips the activity identity through invert → rebuild', () => {
    const obs = buildSessionObservation(calisthenicsForm(), CTX);
    let n = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
    expect(inverted.activity).toBe('calisthenics');

    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 's2' });
    expect(rebuilt.payload.activity).toBe('calisthenics');
    expect(rebuilt.payload.modality).toBe('gym');
  });

  it('drops manual GPS fidelity to 0.5 (no wearable) while gym stays 0.95', () => {
    const run = emptySessionForm();
    run.activity = 'run';
    run.durationMin = '30';
    run.endurance = { distance: '5', avgHr: '150', energySystem: 'aerobic' };
    expect(buildSessionObservation(run, CTX).fidelity).toBe(0.5);
  });

  it('brings Hike onto the GPS surface — distance is captured and revealed', () => {
    const hike = emptySessionForm();
    hike.activity = 'hike';
    hike.durationMin = '120';
    hike.endurance = { distance: '8', avgHr: '', energySystem: 'aerobic' };
    const obs = buildSessionObservation(hike, CTX);
    expect(obs.payload.modality).toBe('hike');
    expect(obs.payload.endurance?.distanceM).toBeCloseTo(8000, 1);
    expect(reveal(obs)).toBe('aerobic · 120 min · 8.0 km');
  });

  it("reveal()'s fallback line prefers the activity over the coarse modality", () => {
    // A practice-surface identity carries no sport block yet (Pass 6), so reveal
    // falls back to the duration line — which should say 'yoga', not 'mobility'.
    const yoga = emptySessionForm();
    yoga.activity = 'yoga';
    yoga.durationMin = '25';
    const obs = buildSessionObservation(yoga, CTX);
    expect(obs.payload.modality).toBe('mobility');
    expect(obs.payload.lifting).toBeUndefined();
    expect(obs.payload.endurance).toBeUndefined();
    expect(reveal(obs)).toBe('yoga · 25 min');
  });

  it('still builds a bare quick-log session from a modality alone (no identity)', () => {
    const f = emptySessionForm();
    f.modality = 'other';
    f.durationMin = '15';
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.activity).toBeUndefined();
    expect(obs.payload.modality).toBe('other');
    expect(reveal(obs)).toBe('other · 15 min');
  });
});

describe('Pass 3 — gym duration derived from set timestamps (no manual fallback)', () => {
  function gymFormWithStamps(stamps: ReadonlyArray<string | undefined>): SessionForm {
    const f = emptySessionForm();
    f.activity = 'gym';
    f.durationMin = '99'; // a manual value gym must now IGNORE — duration is derived
    f.gym.exercises = [
      {
        id: 'e1',
        name: 'back squat',
        movementPattern: 'quad-dom',
        sets: stamps.map((completedAt, i) => ({
          id: `s${i}`,
          weight: '100',
          reps: '5',
          rir: '',
          isWarmup: false,
          ...(completedAt ? { completedAt } : {}),
        })),
      },
    ];
    return f;
  }

  it('derives gym duration from the set-timestamp spread, overriding the manual value', () => {
    const obs = buildSessionObservation(
      gymFormWithStamps(['2026-06-26T17:00:00Z', '2026-06-26T17:45:00Z']),
      CTX
    );
    expect(obs.payload.durationMin).toBe(45); // the spread, not the manual 99
    expect(obs.fidelity).toBe(0.95); // lived capture
    expect(obs.payload.lifting?.sets[0].completedAt).toBe('2026-06-26T17:00:00Z');
  });

  it('leaves duration absent (unknown, not 0) when no timestamps are present', () => {
    const obs = buildSessionObservation(gymFormWithStamps([undefined, undefined]), CTX);
    expect(obs.payload.durationMin).toBeUndefined(); // gym ignores the manual field
    expect(obs.fidelity).toBe(0.95); // the set data itself is still precisely captured
  });

  it('leaves duration absent when stamps are clustered (batch entry)', () => {
    const obs = buildSessionObservation(
      gymFormWithStamps(['2026-06-26T17:00:00Z', '2026-06-26T17:00:30Z']),
      CTX
    );
    expect(obs.payload.durationMin).toBeUndefined(); // clustered spread → unknown, never fabricated
  });

  it('builds and validates a gym session with no manual duration at all', () => {
    const f = gymFormWithStamps([undefined, undefined]);
    f.durationMin = ''; // nothing entered — gym must not require it
    expect(validateSessionForm(f)).toBeNull();
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.durationMin).toBeUndefined();
    expect(obs.payload.lifting?.sets).toHaveLength(2);
  });

  it('round-trips completedAt through invert → rebuild', () => {
    const obs = buildSessionObservation(
      gymFormWithStamps(['2026-06-26T17:00:00Z', '2026-06-26T17:45:00Z']),
      CTX
    );
    let n = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
    expect(inverted.gym.exercises[0].sets.some((s) => s.completedAt === '2026-06-26T17:00:00Z')).toBe(
      true
    );
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 's9' });
    expect(rebuilt.payload.durationMin).toBe(45); // derived again from the preserved stamps
  });
});

describe('Pass 5 — swimming surface', () => {
  function poolSwim(): SessionForm {
    const f = emptySessionForm();
    f.activity = 'swim';
    f.durationMin = '30';
    f.swim = {
      mode: 'pool',
      poolLengthM: '25',
      laps: '60',
      distance: '',
      stroke: 'freestyle',
      energySystem: 'aerobic',
    };
    return f;
  }

  it('pool distance is laps × pool length (audited), at higher fidelity', () => {
    const obs = buildSessionObservation(poolSwim(), CTX);
    expect(obs.payload.modality).toBe('swim');
    expect(obs.payload.swimming?.distanceM).toBe(1500); // 60 × 25
    expect(obs.payload.swimming?.poolLengthM).toBe(25);
    expect(obs.payload.swimming?.laps).toBe(60);
    expect(obs.fidelity).toBe(0.85);
    expect(reveal(obs)).toBe('aerobic · 30 min · 1,500 m · freestyle');
  });

  it('open-water swim takes a direct estimate at lower fidelity', () => {
    const f = poolSwim();
    f.swim = { ...f.swim, mode: 'open', distance: '2' }; // 2 km
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.swimming?.distanceM).toBeCloseTo(2000, 1);
    expect(obs.payload.swimming?.poolLengthM).toBeUndefined();
    expect(obs.fidelity).toBe(0.5);
  });

  it('round-trips a pool swim through invert → rebuild', () => {
    const obs = buildSessionObservation(poolSwim(), CTX);
    let n = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
    expect(inverted.swim.mode).toBe('pool');
    expect(inverted.swim.poolLengthM).toBe('25');
    expect(inverted.swim.laps).toBe('60');
    expect(inverted.swim.stroke).toBe('freestyle');
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'sw2' });
    expect(rebuilt.payload.swimming?.distanceM).toBe(1500);
  });

  it('contributes energy-system minutes to the weekly ledger (not sessionIds-only)', () => {
    const obs = buildSessionObservation(poolSwim(), { ...CTX, now: '2026-06-17T17:00:00Z' });
    const [week] = computeWeeklyStimulus([obs]);
    expect(week.byEnergySystem.aerobic.minutes).toBe(30);
    expect(week.sessionIds).toContain(obs.id);
  });
});

describe('Pass 6 — practice surface', () => {
  function yoga(style: string): SessionForm {
    const f = emptySessionForm();
    f.activity = 'yoga';
    f.durationMin = '45';
    f.practice = { style };
    return f;
  }

  it('records a style tag and maps to the mobility modality', () => {
    const obs = buildSessionObservation(yoga('vinyasa'), CTX);
    expect(obs.payload.modality).toBe('mobility');
    expect(obs.payload.practice?.style).toBe('vinyasa');
    expect(reveal(obs)).toBe('vinyasa · 45 min');
  });

  it('falls back to the activity identity when no style is given (no fabricated block)', () => {
    const obs = buildSessionObservation(yoga(''), CTX);
    expect(obs.payload.practice).toBeUndefined();
    expect(reveal(obs)).toBe('yoga · 45 min');
  });

  it('contributes no volume or energy bars — sessionIds only (honest)', () => {
    const obs = buildSessionObservation(yoga('hatha'), { ...CTX, now: '2026-06-17T17:00:00Z' });
    const [week] = computeWeeklyStimulus([obs]);
    expect(week.sessionIds).toContain(obs.id);
    expect(Object.keys(week.byPattern)).toHaveLength(0);
    expect(week.byEnergySystem.aerobic.minutes).toBe(0);
    expect(week.byEnergySystem.glycolytic.minutes).toBe(0);
    expect(week.byEnergySystem.mixed.minutes).toBe(0);
  });

  it('round-trips the style through invert → rebuild', () => {
    const obs = buildSessionObservation(yoga('yin'), CTX);
    let n = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
    expect(inverted.practice.style).toBe('yin');
    expect(inverted.activity).toBe('yoga');
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'pr2' });
    expect(rebuilt.payload.practice?.style).toBe('yin');
  });
});

describe('Native GPS capture — live in-app recording (rung 2)', () => {
  const gp = (over: Partial<GeoPoint>): GeoPoint => ({ lat: 0, lng: 0, tsSec: 0, ...over });

  function recordedRun(): SessionForm {
    const f = emptySessionForm();
    f.activity = 'run';
    f.durationMin = '30';
    f.endurance = {
      distance: '',
      avgHr: '',
      energySystem: 'aerobic',
      gpsPath: [gp({ lat: 0, lng: 0, tsSec: 1_000 }), gp({ lat: 0, lng: 1, tsSec: 1_600 })],
      captureMeta: { startTime: '2026-06-26T16:30:00Z' },
    };
    return f;
  }

  it('is a tier-1 manual session at live-phone fidelity (0.7), dated to the recording start', () => {
    const obs = buildSessionObservation(recordedRun(), CTX);
    expect(obs.tier).toBe(1);
    expect(obs.fidelity).toBe(0.7); // above a manual guess (0.5), below a file import (0.9)
    expect(obs.source).toEqual({ type: 'manual' }); // a live recording isn't a file
    expect(obs.occurredAt).toBe('2026-06-26T16:30:00Z'); // when it happened, not CTX.now
    expect(obs.payload.endurance?.gpsPath).toHaveLength(2);
  });

  it('a manual GPS session with no recorded route stays a typed guess (0.5)', () => {
    const f = emptySessionForm();
    f.activity = 'run';
    f.durationMin = '30';
    f.endurance = { distance: '5', avgHr: '', energySystem: 'aerobic' };
    expect(buildSessionObservation(f, CTX).fidelity).toBe(0.5);
  });

  it('round-trips the capture through invert → rebuild (fidelity + occurredAt preserved)', () => {
    const obs = buildSessionObservation(recordedRun(), CTX);
    let n = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
    expect(inverted.endurance.gpsPath).toHaveLength(2);
    expect(inverted.endurance.captureMeta?.startTime).toBe('2026-06-26T16:30:00Z');
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'gps2' });
    expect(rebuilt.fidelity).toBe(0.7);
    expect(rebuilt.source).toEqual({ type: 'manual' });
    expect(rebuilt.occurredAt).toBe('2026-06-26T16:30:00Z');
  });
});

describe('Sky dimension — paragliding/hike&fly/speedflying/parakiting surface', () => {
  const gp = (over: Partial<GeoPoint>): GeoPoint => ({ lat: 0, lng: 0, tsSec: 0, ...over });

  function igcFlight(): SessionForm {
    const f = emptySessionForm();
    f.activity = 'paragliding';
    f.durationMin = '45';
    f.sky = {
      track: [gp({ tsSec: 1_720_000_000 }), gp({ lat: 0.01, tsSec: 1_720_003_000 })],
      trackSource: 'igc',
      segments: [
        { kind: 'ground', startIdx: 0, endIdx: 0, provenance: 'auto' },
        { kind: 'air', startIdx: 0, endIdx: 1, provenance: 'auto' },
      ],
      ascentMode: '',
      onSkis: false,
    };
    return f;
  }

  it('resolves the sky surface for all four sky activities', () => {
    for (const activity of ['paragliding', 'hikeAndFly', 'speedflying', 'parakiting']) {
      const f = emptySessionForm();
      f.activity = activity;
      expect(resolveSurface(f)).toBe('sky');
    }
  });

  it('an IGC-imported track is measured (0.9 fidelity), tagged as a fileimport, dated to the track start', () => {
    const obs = buildSessionObservation(igcFlight(), CTX);
    expect(obs.tier).toBe(1);
    expect(obs.fidelity).toBe(0.9);
    expect(obs.source).toEqual({ type: 'fileimport', format: 'igc' });
    expect(obs.occurredAt).toBe(new Date(1_720_000_000 * 1000).toISOString());
    expect(obs.payload.sky?.track).toHaveLength(2);
    expect(obs.payload.sky?.segments).toHaveLength(2);
  });

  it('a live-captured track is measured at phone-GPS fidelity (0.7), source stays manual', () => {
    const f = igcFlight();
    f.sky = { ...f.sky, trackSource: 'liveGps' };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.fidelity).toBe(0.7);
    expect(obs.source).toEqual({ type: 'manual' });
  });

  it('a hand-logged sky session with no track stays a typed guess (0.5)', () => {
    const f = emptySessionForm();
    f.activity = 'parakiting';
    f.durationMin = '90';
    const obs = buildSessionObservation(f, CTX);
    expect(obs.fidelity).toBe(0.5);
    expect(obs.source).toEqual({ type: 'manual' });
    expect(obs.occurredAt).toBe(CTX.now);
    expect(obs.payload.sky).toEqual({});
  });

  it('carries ascentMode and onSkis when set', () => {
    const f = igcFlight();
    f.activity = 'speedflying';
    f.sky = { ...f.sky, ascentMode: 'lift', onSkis: true };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.sky?.ascentMode).toBe('lift');
    expect(obs.payload.sky?.onSkis).toBe(true);
  });

  it('never writes ascentMode for a non-speedflying activity, even if stale form state carries one', () => {
    // ascentMode is speedflying-only; a leftover value from switching
    // activities in the UI must never reach a different activity's session.
    const f = igcFlight();
    f.activity = 'paragliding';
    f.sky = { ...f.sky, ascentMode: 'lift' };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.sky?.ascentMode).toBeUndefined();
  });

  it('round-trips a sky session through invert -> rebuild', () => {
    const obs = buildSessionObservation(igcFlight(), CTX);
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => 'x'
    );
    expect(inverted.sky.track).toHaveLength(2);
    expect(inverted.sky.trackSource).toBe('igc');
    expect(inverted.sky.segments).toHaveLength(2);

    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'sky2' });
    expect(rebuilt.fidelity).toBe(0.9);
    expect(rebuilt.source).toEqual({ type: 'fileimport', format: 'igc' });
    expect(rebuilt.occurredAt).toBe(obs.occurredAt);
  });
});
