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
import { reveal } from '@core/stimulus';
import {
  buildSessionObservation,
  emptySessionForm,
  resolveSurface,
  sessionFormFromObservation,
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

describe('Pass 3a — derived gym duration', () => {
  function gymFormWithStamps(stamps: ReadonlyArray<string | undefined>): SessionForm {
    const f = emptySessionForm();
    f.activity = 'gym';
    f.durationMin = '99'; // manual value — should be overridden when stamps span time
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

  it('keeps the manual duration when no timestamps are present (current path, pre-3b)', () => {
    const obs = buildSessionObservation(gymFormWithStamps([undefined, undefined]), CTX);
    expect(obs.payload.durationMin).toBe(99);
    expect(obs.fidelity).toBe(0.95);
  });

  it('keeps the manual duration when stamps are clustered (batch entry)', () => {
    const obs = buildSessionObservation(
      gymFormWithStamps(['2026-06-26T17:00:00Z', '2026-06-26T17:00:30Z']),
      CTX
    );
    expect(obs.payload.durationMin).toBe(99); // clustered → derivation null → manual stands
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
