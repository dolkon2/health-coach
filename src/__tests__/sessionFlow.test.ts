/**
 * Pass 4 end-to-end data path — the slice the Log Session modal drives, minus React.
 *
 *   form state -> buildSessionObservation -> createObservation
 *   -> listObservations(today) -> filter sessions -> stimulus.reveal()
 *
 * Proves the gym form maps to a flat LiftingBlock, persists, reads back in the
 * local-day window, and produces the real "what this contributed" line — and
 * that the movement-pattern-required rule actually blocks an untagged exercise
 * before it can reach storage.
 */
import { describe, it, expect } from '@jest/globals';
import { isKind, type ObservationOf } from '@core/observation';
import { reveal } from '@core/stimulus';
import { runMigrations } from '../storage/db';
import {
  createObservation,
  deleteObservation,
  listObservations,
  updateObservation,
} from '../storage/observations';
import { makeTestDb } from '../storage/__tests__/sqliteTestDb';
import {
  buildSessionObservation,
  emptySessionForm,
  sessionFormFromObservation,
  validateSessionForm,
  type BuildContext,
  type SessionForm,
} from '../lib/session';

const CTX: BuildContext = {
  id: 's1',
  now: '2026-06-26T17:00:00Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'kg', // build in kg so the volume-load assertions are exact
  distanceUnit: 'km',
};

// A two-exercise pull session: a warm-up set (excluded) + working sets.
function pullDayForm(): SessionForm {
  const form = emptySessionForm();
  form.modality = 'gym';
  form.durationMin = '52';
  form.perceivedEffort = 8;
  form.gym.exercises = [
    {
      id: 'e1',
      name: 'barbell row',
      movementPattern: 'upper-pull',
      sets: [
        { id: 'w', weight: '40', reps: '8', rir: '', isWarmup: true }, // warm-up, no volume
        { id: 'a', weight: '100', reps: '5', rir: '2', isWarmup: false },
        { id: 'b', weight: '100', reps: '5', rir: '1', isWarmup: false },
      ],
    },
    {
      id: 'e2',
      name: 'lat pulldown',
      movementPattern: 'upper-pull',
      sets: [{ id: 'c', weight: '70', reps: '10', rir: '2', isWarmup: false }],
    },
  ];
  return form;
}

describe('session flow (Pass 4)', () => {
  it('saves a gym session and reads back its contribution line via stimulus.reveal()', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const obs = buildSessionObservation(pullDayForm(), CTX);
    await createObservation(obs, db);

    const today = await listObservations(
      { from: '2026-06-26T00:00:00Z', to: '2026-06-26T23:59:59Z' },
      db
    );
    const sessions = today.filter((o): o is ObservationOf<'session'> => isKind(o, 'session'));
    expect(sessions).toHaveLength(1);

    // The form flattened to one LiftingBlock with a set per row (warm-up kept,
    // tagged). Three working sets across two exercises, both upper-pull.
    expect(sessions[0].payload.lifting?.sets).toHaveLength(4);

    // volume load = working sets only: 100*5 + 100*5 + 70*10 = 1,700 kg.
    expect(reveal(sessions[0])).toBe('upper-pull · 3 sets · 1,700 kg volume load');
  });

  it('deleting a logged session removes it from today (and the contribution disappears)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const obs = buildSessionObservation(pullDayForm(), CTX);
    await createObservation(obs, db);

    await deleteObservation(obs.id, db);

    const today = await listObservations(
      { from: '2026-06-26T00:00:00Z', to: '2026-06-26T23:59:59Z' },
      db
    );
    const sessions = today.filter((o): o is ObservationOf<'session'> => isKind(o, 'session'));
    expect(sessions).toHaveLength(0);
  });

  it('excludes warm-up sets from volume load and set count', () => {
    const form = pullDayForm();
    // Strip to a single exercise: one warm-up + one working set.
    form.gym.exercises = [
      {
        id: 'e1',
        name: 'back squat',
        movementPattern: 'quad-dom',
        sets: [
          { id: 'w', weight: '60', reps: '5', rir: '', isWarmup: true },
          { id: 'a', weight: '120', reps: '3', rir: '2', isWarmup: false },
        ],
      },
    ];
    const obs = buildSessionObservation(form, CTX);
    expect(reveal(obs)).toBe('quad-dom · 1 set · 360 kg volume load'); // 120*3
  });

  it('refuses to build a gym session with an untagged exercise (movement pattern required)', () => {
    const form = pullDayForm();
    form.gym.exercises[0].movementPattern = null; // drop the tag

    expect(validateSessionForm(form)).toBe('Tag a movement pattern for "barbell row".');
    expect(() => buildSessionObservation(form, CTX)).toThrow(/movement pattern/i);
  });

  it('lists multiple patterns ordered by working-set count', () => {
    const form = emptySessionForm();
    form.modality = 'gym';
    form.durationMin = '60';
    form.gym.exercises = [
      {
        id: 'e1',
        name: 'deadlift',
        movementPattern: 'hip-hinge',
        sets: [{ id: 'a', weight: '140', reps: '3', rir: '2', isWarmup: false }],
      },
      {
        id: 'e2',
        name: 'front squat',
        movementPattern: 'quad-dom',
        sets: [
          { id: 'b', weight: '100', reps: '5', rir: '2', isWarmup: false },
          { id: 'c', weight: '100', reps: '5', rir: '1', isWarmup: false },
        ],
      },
    ];
    // quad-dom has 2 working sets vs hip-hinge's 1, so it leads.
    expect(reveal(buildSessionObservation(form, CTX))).toBe(
      'quad-dom + hip-hinge · 3 sets · 1,420 kg volume load' // 100*5+100*5+140*3
    );
  });

  it('editing a session updates the contribution line (same id, no extra rows)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const obs = buildSessionObservation(pullDayForm(), CTX);
    await createObservation(obs, db);
    expect(reveal(obs)).toBe('upper-pull · 3 sets · 1,700 kg volume load');

    // Edit: invert to form, drop the lat-pulldown exercise, save back.
    const form = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `gen-${Math.random()}`
    );
    form.gym.exercises = form.gym.exercises.filter((e) => e.name !== 'lat pulldown');
    const edited = buildSessionObservation(form, { ...CTX, id: obs.id });
    await updateObservation(edited, db);

    const today = await listObservations(
      { from: '2026-06-26T00:00:00Z', to: '2026-06-26T23:59:59Z' },
      db
    );
    const sessions = today.filter((o): o is ObservationOf<'session'> => isKind(o, 'session'));
    expect(sessions).toHaveLength(1); // still one row, not two
    expect(sessions[0].id).toBe(obs.id); // id preserved
    // 1,700 - (70*10) = 1,000 kg volume load left.
    expect(reveal(sessions[0])).toBe('upper-pull · 2 sets · 1,000 kg volume load');
  });

  it('round-trips a gym session through sessionFormFromObservation -> build (payload survives)', () => {
    const obs = buildSessionObservation(pullDayForm(), CTX);

    let counter = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `gen-${counter++}`
    );

    // Inverted form rebuilds the same payload (modulo id/occurredAt, which the
    // build context owns). The lifting block is what matters: same sets, same
    // patterns, same warm-up flags.
    const rebuilt = buildSessionObservation(inverted, { ...CTX, id: 's2' });

    expect(rebuilt.payload.modality).toBe(obs.payload.modality);
    expect(rebuilt.payload.durationMin).toBe(obs.payload.durationMin);
    expect(rebuilt.payload.perceivedEffort).toBe(obs.payload.perceivedEffort);
    expect(rebuilt.payload.lifting?.sets).toHaveLength(obs.payload.lifting!.sets.length);

    // Field-by-field on the sets (volume-load reveals would also match).
    rebuilt.payload.lifting!.sets.forEach((s, i) => {
      const orig = obs.payload.lifting!.sets[i];
      expect(s.exercise).toBe(orig.exercise);
      expect(s.movementPattern).toBe(orig.movementPattern);
      expect(s.reps).toBe(orig.reps);
      expect(s.weightKg).toBeCloseTo(orig.weightKg, 6);
      expect(s.rir ?? null).toBe(orig.rir ?? null);
      expect(s.isWarmup === true).toBe(orig.isWarmup === true);
    });
  });

  it('round-trips an endurance session — distance and HR preserved across units', () => {
    const form = emptySessionForm();
    form.modality = 'run';
    form.durationMin = '45';
    form.endurance = { distance: '8.2', avgHr: '152', energySystem: 'aerobic' };
    const obs = buildSessionObservation(form, CTX);

    let counter = 0;
    const inverted = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `gen-${counter++}`
    );
    expect(inverted.modality).toBe('run');
    expect(Number(inverted.endurance.distance)).toBeCloseTo(8.2, 2);
    expect(inverted.endurance.avgHr).toBe('152');
    expect(inverted.endurance.energySystem).toBe('aerobic');
  });

  it('builds an endurance session and reveals its energy system, time and distance', () => {
    const form = emptySessionForm();
    form.modality = 'run';
    form.durationMin = '45';
    form.endurance = { distance: '8.2', avgHr: '152', energySystem: 'aerobic' };
    const obs = buildSessionObservation(form, CTX);

    expect(obs.payload.endurance?.distanceM).toBeCloseTo(8200, 1); // 8.2 km -> metres
    expect(reveal(obs)).toBe('aerobic · 45 min · 8.2 km · 152 bpm');
  });
});
