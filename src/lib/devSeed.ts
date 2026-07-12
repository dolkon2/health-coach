/**
 * devSeed.ts — a developer-only sample-data loader for previewing Reflect.
 *
 * This is a TESTING aid, not product data. Every row it writes is tagged in the
 * `notes` column with SAMPLE_TAG, so clearSampleData() removes exactly the seed
 * and never touches real logged data. It exists so you can see a populated trend
 * chart and stimulus ledger immediately, then wipe it and use the app for real.
 *
 * It writes through the same honest paths the UI uses — direct weigh-in
 * Observations and buildSessionObservation for sessions — so the seeded data is
 * shaped exactly like real data, just back-dated and tagged.
 */
import type { MovementPattern, Observation } from '@core/observation';
import type { Route } from '@core/route';
import { getDb } from '@/storage/db';
import { createObservation } from '@/storage/observations';
import { createRoute } from '@/storage/routes';
import { buildSessionObservation, emptySessionForm, type SessionForm } from './session';
import { uuidv7 } from './id';
import { deviceTz } from './date';

export const SAMPLE_TAG = '__sample__';

/** An ISO instant `days` ago at a fixed local hour, so dayKey lands on the right day. */
function daysAgoIso(days: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ── Sample weigh-ins: ~10 days of a gentle, noisy downward trend (kg). ─────────
const SAMPLE_WEIGHTS: Array<[daysAgo: number, kg: number]> = [
  [13, 81.2],
  [11, 81.0],
  [10, 80.7],
  [8, 80.9],
  [6, 80.4],
  [5, 80.5],
  [3, 80.1],
  [2, 79.9],
  [1, 80.0],
  [0, 79.7],
];

type GymExercise = { name: string; pattern: MovementPattern; sets: Array<[kg: number, reps: number]> };

function gymForm(durationMin: number, exercises: GymExercise[]): SessionForm {
  const form = emptySessionForm();
  form.modality = 'gym';
  form.durationMin = String(durationMin);
  form.perceivedEffort = 8;
  form.notes = SAMPLE_TAG;
  form.gym.exercises = exercises.map((ex, i) => ({
    id: `e${i}`,
    name: ex.name,
    movementPattern: ex.pattern,
    sets: ex.sets.map(([kg, reps], j) => ({
      id: `s${i}-${j}`,
      weight: String(kg),
      reps: String(reps),
      holdSec: '',
      rir: '2',
      isWarmup: false,
    })),
  }));
  return form;
}

function runForm(durationMin: number, km: number): SessionForm {
  const form = emptySessionForm();
  form.modality = 'run';
  form.durationMin = String(durationMin);
  form.perceivedEffort = 6;
  form.notes = SAMPLE_TAG;
  form.endurance = { distance: String(km), avgHr: '148', energySystem: 'aerobic' };
  return form;
}

function climbForm(durationMin: number): SessionForm {
  const form = emptySessionForm();
  form.modality = 'climb';
  form.durationMin = String(durationMin);
  form.perceivedEffort = 7;
  form.notes = SAMPLE_TAG;
  form.climb = {
    style: 'boulder',
    indoor: true,
    sends: [
      { id: 'a', grade: 'V2', attempts: '1', sent: true, outcome: 'flash', route: '', pitches: '' },
      { id: 'b', grade: 'V3', attempts: '3', sent: true, outcome: 'redpoint', route: '', pitches: '' },
      { id: 'c', grade: 'V4', attempts: '4', sent: false, outcome: 'attempt', route: '', pitches: '' },
    ],
    totalProblems: '',
  };
  return form;
}

// ── Sample sessions across the last two ISO weeks: multi-pattern lifting (fills
// the bars), a run (aerobic minutes, not in bars), and a climb (drill-down only,
// not in bars — demonstrates the climb/hike gap honestly). ─────────────────────
const SAMPLE_SESSIONS: Array<{ daysAgo: number; form: SessionForm }> = [
  {
    daysAgo: 10,
    form: gymForm(55, [
      { name: 'back squat', pattern: 'quad-dom', sets: [[100, 5], [100, 5], [100, 5]] },
      { name: 'romanian deadlift', pattern: 'hip-hinge', sets: [[90, 8], [90, 8], [90, 8]] },
    ]),
  },
  {
    daysAgo: 8,
    form: gymForm(50, [
      { name: 'barbell row', pattern: 'upper-pull', sets: [[80, 8], [80, 8], [80, 8]] },
      { name: 'lat pulldown', pattern: 'upper-pull', sets: [[60, 10], [60, 10]] },
    ]),
  },
  { daysAgo: 6, form: runForm(35, 6.2) },
  {
    daysAgo: 3,
    form: gymForm(45, [
      { name: 'bench press', pattern: 'upper-push', sets: [[70, 5], [70, 5], [70, 5]] },
      { name: 'overhead press', pattern: 'upper-push', sets: [[45, 8], [45, 8]] },
    ]),
  },
  {
    daysAgo: 2,
    form: gymForm(50, [
      { name: 'front squat', pattern: 'quad-dom', sets: [[80, 5], [80, 5], [80, 5]] },
      { name: 'deadlift', pattern: 'hip-hinge', sets: [[120, 3], [120, 3], [120, 3]] },
    ]),
  },
  { daysAgo: 1, form: climbForm(90) },
  {
    daysAgo: 0,
    form: gymForm(40, [
      { name: 'barbell row', pattern: 'upper-pull', sets: [[82, 8], [82, 8], [82, 8]] },
    ]),
  },
];

// ── Sample routes (routes-spec P1, Session 9) — one per element that
// actually records on the map, so the Training shelf and Routes list have
// something real to render. ────────────────────────────────────────────────
const SAMPLE_ROUTES: Array<Pick<Route, 'name' | 'activityId' | 'source' | 'points'>> = [
  {
    name: 'Hood River Loop',
    activityId: 'run',
    source: 'plotted',
    points: [
      { lat: 45.7118, lng: -121.4995 },
      { lat: 45.7135, lng: -121.4972 },
      { lat: 45.7151, lng: -121.494 },
      { lat: 45.7139, lng: -121.4907 },
      { lat: 45.7118, lng: -121.4995 },
    ],
  },
  {
    name: 'White Salmon — Green Truss run',
    activityId: 'kayak',
    source: 'plotted',
    points: [
      { lat: 45.7291, lng: -121.4886 },
      { lat: 45.726, lng: -121.4874 },
      { lat: 45.7224, lng: -121.4855 },
      { lat: 45.719, lng: -121.4831 },
    ],
  },
];

/** Insert the back-dated, tagged sample weigh-ins and sessions. */
export async function seedSampleData(): Promise<void> {
  for (const r of SAMPLE_ROUTES) {
    await createRoute({
      id: uuidv7(),
      name: r.name,
      activityId: r.activityId,
      source: r.source,
      points: r.points,
      visibility: 'private',
      notes: SAMPLE_TAG,
    });
  }

  for (const [daysAgo, kg] of SAMPLE_WEIGHTS) {
    const iso = daysAgoIso(daysAgo, 8); // morning weigh-ins
    const obs: Observation = {
      id: uuidv7(),
      kind: 'weighIn',
      occurredAt: iso,
      loggedAt: iso,
      tz: deviceTz(),
      tier: 1,
      fidelity: 1.0,
      source: { type: 'manual' },
      payload: { kind: 'weighIn', weightKg: kg },
      notes: SAMPLE_TAG,
    };
    await createObservation(obs);
  }

  for (const { daysAgo, form } of SAMPLE_SESSIONS) {
    const iso = daysAgoIso(daysAgo, 17); // afternoon sessions
    const obs = buildSessionObservation(form, {
      id: uuidv7(),
      now: iso,
      tz: deviceTz(),
      weightUnit: 'kg',
      distanceUnit: 'km',
    });
    await createObservation(obs);
  }
}

/** Remove only the seeded rows (matched by SAMPLE_TAG) — real data is untouched. */
export async function clearSampleData(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM observations WHERE notes = ?;', [SAMPLE_TAG]);
  await db.runAsync('DELETE FROM routes WHERE notes = ?;', [SAMPLE_TAG]);
}
