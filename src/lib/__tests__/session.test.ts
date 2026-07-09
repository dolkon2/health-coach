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
import type { GeoPoint, ObservationOf } from '@core/observation';
import {
  buildSessionObservation,
  emptyExerciseDraft,
  emptySessionForm,
  emptySetDraft,
  ghostSetPlaceholders,
  isSetFilled,
  resolveSurface,
  sessionFormFromObservation,
  validateSessionForm,
  withEntryType,
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
      sets: [{ id: 'a', weight: '0', reps: '10', holdSec: '', rir: '1', isWarmup: false }],
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
          holdSec: '',
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
    f.practice = { ...f.practice, style };
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
describe('Body P1a — hold (isometric) sets on the gym surface', () => {
  /** A calisthenics session with one hold exercise: 2 working holds + 1 warm-up hold. */
  function holdForm(): SessionForm {
    const f = emptySessionForm();
    f.activity = 'calisthenics';
    f.gym.exercises = [
      {
        id: 'e1',
        name: 'plank',
        movementPattern: 'core',
        sets: [
          { id: 'w', weight: '', reps: '', holdSec: '20', rir: '', isWarmup: true },
          { id: 'a', weight: '', reps: '', holdSec: '60', rir: '', isWarmup: false },
          { id: 'b', weight: '', reps: '', holdSec: '45', rir: '', isWarmup: false },
        ],
      },
    ];
    return f;
  }

  it('isSetFilled accepts a hold-only set (reps>0 OR holdSec>0)', () => {
    const empty = emptySetDraft('x');
    expect(isSetFilled(empty)).toBe(false);
    expect(isSetFilled({ ...empty, holdSec: '30' })).toBe(true); // hold, weight empty = bodyweight
    expect(isSetFilled({ ...empty, holdSec: '30', weight: '10' })).toBe(true); // weighted hold
    expect(isSetFilled({ ...empty, holdSec: '0' })).toBe(false); // 0 s is not a hold
    // Rep-set rule unchanged: reps alone without a weight is still unfilled.
    expect(isSetFilled({ ...empty, reps: '5' })).toBe(false);
    expect(isSetFilled({ ...empty, reps: '5', weight: '0' })).toBe(true);
  });

  it('a hold-only exercise validates and builds: holdSec stored, reps 0, 0 kg added load', () => {
    expect(validateSessionForm(holdForm())).toBeNull();
    const obs = buildSessionObservation(holdForm(), CTX);
    const sets = obs.payload.lifting?.sets ?? [];
    expect(sets).toHaveLength(3);
    for (const s of sets) {
      expect(s.reps).toBe(0); // the hold time is the work — no fabricated rep count
      expect(s.weightKg).toBe(0); // empty weight = strict bodyweight (0 added load)
    }
    expect(sets.map((s) => s.holdSec)).toEqual([20, 60, 45]);
  });

  it('a weighted hold stores the typed weight as ADDED load', () => {
    const f = holdForm();
    f.gym.exercises[0].sets = [
      { id: 'a', weight: '10', reps: '', holdSec: '30', rir: '', isWarmup: false },
    ];
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.lifting?.sets[0].weightKg).toBe(10);
    expect(obs.payload.lifting?.sets[0].holdSec).toBe(30);
  });

  it('round-trips hold sets through invert → rebuild (payload identical)', () => {
    const obs = buildSessionObservation(holdForm(), CTX);
    let n = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
    const sets = inverted.gym.exercises[0].sets;
    expect(sets.map((s) => s.holdSec)).toEqual(['20', '60', '45']);
    expect(sets.every((s) => s.reps === '')).toBe(true); // restored the way it was left, not '0'
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 's2' });
    expect(rebuilt.payload.lifting).toEqual(obs.payload.lifting);
  });

  it('round-trips a library exerciseId per set while the name stays the stored fact', () => {
    const f = holdForm();
    f.gym.exercises[0].exerciseId = 'plank';
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.lifting?.sets.every((s) => s.exerciseId === 'plank')).toBe(true);
    expect(obs.payload.lifting?.sets[0].exercise).toBe('plank');
    let n = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
    expect(inverted.gym.exercises).toHaveLength(1);
    expect(inverted.gym.exercises[0].exerciseId).toBe('plank');
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 's3' });
    expect(rebuilt.payload.lifting).toEqual(obs.payload.lifting);
  });

  it('reveal(): hold-only session speaks seconds held, never a 0 kg volume-load line', () => {
    const obs = buildSessionObservation(holdForm(), CTX);
    // Warm-up hold excluded: 60 + 45 = 105 s across 2 working sets.
    expect(reveal(obs)).toBe('core · 2 sets · 105 s held');
  });

  it('reveal(): mixed reps + holds shows both figures, holds adding no volume', () => {
    const f = holdForm();
    f.gym.exercises.push({
      id: 'e2',
      name: 'weighted pull-up',
      movementPattern: 'upper-pull',
      sets: [
        { id: 'c', weight: '20', reps: '5', holdSec: '', rir: '', isWarmup: false },
        { id: 'd', weight: '20', reps: '5', holdSec: '', rir: '', isWarmup: false },
      ],
    });
    const obs = buildSessionObservation(f, CTX);
    // 4 working sets; volume = 20*5 + 20*5 = 200 kg (holds contribute zero); 105 s held.
    expect(reveal(obs)).toBe('core + upper-pull · 4 sets · 200 kg volume load · 105 s held');
  });

  it('weekly stimulus: holds count as pattern sets + holdSecByPattern, zero volumeLoadKg', () => {
    const obs = buildSessionObservation(holdForm(), { ...CTX, now: '2026-06-17T17:00:00Z' });
    const [week] = computeWeeklyStimulus([obs]);
    expect(week.byPattern.core).toEqual({ sets: 2, volumeLoadKg: 0 });
    expect(week.holdSecByPattern.core).toBe(105); // warm-up hold excluded
  });
});
describe('Body P1a — deprecated martial-arts sessions stay editable', () => {
  it('an edited historic martial-arts session KEEPS its practice block', () => {
    // The activity was deprecated (hidden from pickers), not removed: activityById
    // must still resolve it, or resolveSurface would fall back to the modality
    // ('other' → no sport block) and an edit would silently drop the block.
    const historic: ObservationOf<'session'> = {
      id: 'ma1',
      kind: 'session',
      occurredAt: '2026-05-01T18:00:00Z',
      loggedAt: '2026-05-01T19:05:00Z',
      tz: 'America/Los_Angeles',
      tier: 1,
      fidelity: 0.95,
      source: { type: 'manual' },
      payload: {
        kind: 'session',
        modality: 'other',
        activity: 'martial-arts',
        durationMin: 60,
        practice: { style: 'bjj' },
      },
      notes: 'open mat',
    };

    let n = 0;
    const form = sessionFormFromObservation(
      historic,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
    expect(form.activity).toBe('martial-arts');
    expect(form.practice.style).toBe('bjj');
    expect(resolveSurface(form)).toBe('practice'); // NOT the modality fallback to 'other'

    const rebuilt = buildSessionObservation(form, { ...CTX, id: 'ma2' });
    expect(rebuilt.payload.practice).toEqual({ style: 'bjj' }); // the block survives the edit
    expect(rebuilt.payload.activity).toBe('martial-arts');
    expect(rebuilt.payload.modality).toBe('other'); // unchanged nearest modality
    expect(rebuilt.payload.durationMin).toBe(60);
  });
});

describe('Body P1b — practice-side fields', () => {
  const invert = (obs: ObservationOf<'session'>) => {
    let n = 0;
    return sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
  };

  it('round-trips styleId + free style together (taxonomy pick keeps the text fact)', () => {
    const f = emptySessionForm();
    f.activity = 'yoga';
    f.durationMin = '45';
    f.practice = { ...f.practice, style: 'vinyasa', styleId: 'vinyasa' };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.practice).toEqual({ style: 'vinyasa', styleId: 'vinyasa' });

    const rebuilt = buildSessionObservation(invert(obs), { ...CTX, id: 'p2' });
    expect(rebuilt.payload.practice).toEqual({ style: 'vinyasa', styleId: 'vinyasa' });
  });

  it('round-trips the dance context tag', () => {
    const f = emptySessionForm();
    f.activity = 'dance';
    f.durationMin = '90';
    f.practice = { ...f.practice, contextTag: 'social' };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.practice?.contextTag).toBe('social');

    const inverted = invert(obs);
    expect(inverted.practice.contextTag).toBe('social');
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'd2' });
    expect(rebuilt.payload.practice?.contextTag).toBe('social');
  });

  it('round-trips body areas — side and tightness kept, unrated stays absent', () => {
    const f = emptySessionForm();
    f.activity = 'mobility';
    f.durationMin = '20';
    f.practice = {
      ...f.practice,
      bodyAreas: [
        { id: 'b1', zoneId: 'hips', tightness: '4' },
        { id: 'b2', zoneId: 'calves-ankles', side: 'left', tightness: '' },
        { id: 'b3', zoneId: '', tightness: '3' }, // zoneless draft: never built
      ],
    };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.practice?.bodyAreas).toEqual([
      { zoneId: 'hips', tightness: 4 },
      { zoneId: 'calves-ankles', side: 'left' }, // not rated ≠ rated low
    ]);

    const inverted = invert(obs);
    expect(inverted.practice.bodyAreas.map((a) => a.zoneId)).toEqual([
      'hips',
      'calves-ankles',
    ]);
    expect(inverted.practice.bodyAreas[0].tightness).toBe('4');
    expect(inverted.practice.bodyAreas[1].tightness).toBe('');
    expect(inverted.practice.bodyAreas[1].side).toBe('left');
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'm2' });
    expect(rebuilt.payload.practice?.bodyAreas).toEqual(obs.payload.practice?.bodyAreas);
  });

  it('rejects an out-of-range tightness instead of clamping it', () => {
    const f = emptySessionForm();
    f.activity = 'mobility';
    f.durationMin = '20';
    f.practice = {
      ...f.practice,
      bodyAreas: [{ id: 'b1', zoneId: 'hips', tightness: '9' }],
    };
    expect(validateSessionForm(f)).toMatch(/Tightness/);
  });

  it('pain attaches to a NON-practice session and 0 persists as a recorded reading', () => {
    const f = calisthenicsForm(); // gym surface
    f.painAreas = [
      { id: 'p1', zoneId: 'knees', side: 'right', pain: '0' },
      { id: 'p2', zoneId: 'lower-back', pain: '3' },
      { id: 'p3', zoneId: 'hips', pain: '' }, // untouched draft: absent, NOT a 0
    ];
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.painAreas).toEqual([
      { zoneId: 'knees', side: 'right', pain: 0 },
      { zoneId: 'lower-back', pain: 3 },
    ]);

    const inverted = invert(obs);
    expect(inverted.painAreas.map((a) => a.pain)).toEqual(['0', '3']);
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'c2' });
    expect(rebuilt.payload.painAreas).toEqual(obs.payload.painAreas);
  });

  it('a session with no pain entries carries NO painAreas key (absent ≠ pain-free)', () => {
    const obs = buildSessionObservation(calisthenicsForm(), CTX);
    expect('painAreas' in obs.payload).toBe(false);
  });

  it('rejects an out-of-range pain score instead of clamping it', () => {
    const f = calisthenicsForm();
    f.painAreas = [{ id: 'p1', zoneId: 'knees', pain: '11' }];
    expect(validateSessionForm(f)).toMatch(/Pain/);
  });
});

describe('Body P1b — breathwork through the session form', () => {
  function whm(rounds: Array<{ sec: string; breaths?: string }>, durationMin = ''): SessionForm {
    const f = emptySessionForm();
    f.activity = 'breathwork';
    f.durationMin = durationMin;
    f.breathwork = {
      patternId: 'whm',
      cycles: '',
      capture: 'manual',
      rounds: rounds.map((r, i) => ({
        id: `r${i}`,
        retentionSec: r.sec,
        breaths: r.breaths ?? '',
      })),
    };
    return f;
  }

  it('a duration-less manual session with rounds is VALID (rounds-present = filled)', () => {
    expect(validateSessionForm(whm([{ sec: '95' }]))).toBeNull();
  });

  it('without rounds, breathwork still needs a duration like any practice', () => {
    expect(validateSessionForm(whm([]))).toMatch(/duration/);
  });

  it('a typed duration must still parse — the exemption never swallows garbage', () => {
    expect(validateSessionForm(whm([{ sec: '95' }], '0'))).toMatch(/duration/);
  });

  it('builds rounds without fabricating a duration, and the edit path restores them', () => {
    const obs = buildSessionObservation(
      whm([{ sec: '95', breaths: '35' }, { sec: '112' }]),
      CTX
    );
    expect('durationMin' in obs.payload).toBe(false); // absent, never a 0
    expect(obs.payload.breathwork).toEqual({
      patternId: 'whm',
      rounds: [{ retentionSeconds: 95, breathsCount: 35 }, { retentionSeconds: 112 }],
      capture: 'manual',
    });
    expect(obs.payload.practice).toBeUndefined(); // no fabricated practice block

    let n = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `g${n++}`
    );
    expect(inverted.durationMin).toBe('');
    expect(inverted.breathwork.rounds.map((r) => r.retentionSec)).toEqual(['95', '112']);
    expect(inverted.breathwork.rounds[0].breaths).toBe('35');
    expect(inverted.breathwork.capture).toBe('manual');

    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 'bw2' });
    expect(rebuilt.payload.breathwork).toEqual(obs.payload.breathwork);
    expect('durationMin' in rebuilt.payload).toBe(false);
  });

  it('an aborted (empty) round is never stored as a 0-second row', () => {
    const obs = buildSessionObservation(
      whm([{ sec: '95' }, { sec: '' }], '12'),
      CTX
    );
    expect(obs.payload.breathwork?.rounds).toEqual([{ retentionSeconds: 95 }]);
    expect(obs.payload.durationMin).toBe(12); // a typed duration is honored
  });

  it('breathwork fields are keyed on the activity — yoga never grows the block', () => {
    const f = emptySessionForm();
    f.activity = 'yoga';
    f.durationMin = '45';
    f.breathwork = {
      patternId: 'whm',
      cycles: '',
      capture: 'manual',
      rounds: [{ id: 'r0', retentionSec: '90', breaths: '' }],
    };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.breathwork).toBeUndefined();
  });

  it('cycles-only (timed pattern) builds without rounds or capture', () => {
    const f = whm([], '10');
    f.breathwork = { patternId: 'box-4-4-4-4', cycles: '20', capture: null, rounds: [] };
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.breathwork).toEqual({ patternId: 'box-4-4-4-4', cycles: 20 });
  });
});

describe('Body P3 — entry mode (reps ↔ hold) never leaves both fields filled', () => {
  it('switching reps -> duration clears reps on every set, keeps holdSec', () => {
    const ex = {
      ...emptyExerciseDraft('e1', 's1'),
      sets: [
        { id: 's1', weight: '20', reps: '10', holdSec: '', rir: '', isWarmup: false },
        { id: 's2', weight: '20', reps: '8', holdSec: '15', rir: '', isWarmup: false },
      ],
    };
    const next = withEntryType(ex, 'duration');
    expect(next.entryType).toBe('duration');
    expect(next.sets.map((s) => s.reps)).toEqual(['', '']);
    expect(next.sets.map((s) => s.holdSec)).toEqual(['', '15']);
  });

  it('switching duration -> reps clears holdSec on every set, keeps reps', () => {
    const ex = {
      ...emptyExerciseDraft('e1', 's1'),
      entryType: 'duration' as const,
      sets: [{ id: 's1', weight: '0', reps: '5', holdSec: '30', rir: '', isWarmup: false }],
    };
    const next = withEntryType(ex, 'reps');
    expect(next.entryType).toBe('reps');
    expect(next.sets[0].holdSec).toBe('');
    expect(next.sets[0].reps).toBe('5');
  });

  it('a set can never build with both reps and holdSec after a toggle round-trip', () => {
    // Regression for a code-review catch: typing reps, toggling to Hold, then
    // typing a hold time used to leave the stale reps value in place, so
    // buildLifting would write BOTH reps>0 and holdSec>0 on the same set —
    // violating the "hold sets store reps: 0" convention.
    let ex: ReturnType<typeof emptyExerciseDraft> = {
      ...emptyExerciseDraft('e1', 's1'),
      name: 'plank',
      movementPattern: 'core',
    };
    ex = { ...ex, sets: [{ id: 's1', weight: '0', reps: '10', holdSec: '', rir: '', isWarmup: false }] };
    ex = withEntryType(ex, 'duration'); // toggle — reps must clear
    ex = {
      ...ex,
      sets: ex.sets.map((s) => (s.id === 's1' ? { ...s, holdSec: '30' } : s)),
    };
    const f = emptySessionForm();
    f.activity = 'calisthenics';
    f.gym.exercises = [ex];
    const obs = buildSessionObservation(f, CTX);
    const set = obs.payload.lifting!.sets[0];
    expect(set.holdSec).toBe(30);
    expect(set.reps).toBe(0);
  });
});

describe('Body P3 — ghostSetPlaceholders', () => {
  it('formats stored kg back to display units, restoring hold sets with an empty reps placeholder', () => {
    const sets = [
      { exercise: 'pull-up', movementPattern: 'upper-pull' as const, weightKg: 9.0718, reps: 5 },
      {
        exercise: 'plank',
        movementPattern: 'core' as const,
        weightKg: 0,
        reps: 0,
        holdSec: 45,
      },
    ];
    const placeholders = ghostSetPlaceholders(sets, 'kg');
    expect(placeholders[0]).toEqual({ weight: '9.07', reps: '5', holdSec: '', rir: '' });
    expect(placeholders[1]).toEqual({ weight: '0', reps: '', holdSec: '45', rir: '' });
  });

  it('returns an empty array for a never-logged exercise (null lastSets, never fabricated)', () => {
    expect(ghostSetPlaceholders(null, 'kg')).toEqual([]);
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
