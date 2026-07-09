/**
 * Pass 5 end-to-end ledger path — the slice the Reflect StimulusLedger drives,
 * minus React.
 *
 *   form state -> buildSessionObservation -> createObservation
 *   -> listObservations(window) -> filter sessions -> stimulus.computeWeeklyStimulus()
 *
 * Proves sessions group by ISO week, gym volume accrues per movement pattern with
 * warm-ups excluded (matching reveal()), endurance accrues minutes by energy
 * system, the per-week sessionIds are complete (for the drill-down), and an empty
 * input is an honest empty ledger — not a throw, not a fabricated week.
 *
 * Build context uses kg so the volume-load assertions are exact (mirrors
 * sessionFlow.test.ts). Dates are UTC instants so dayKey/isoWeekStart bucket
 * deterministically: 2026-06-08 and 2026-06-15 are both Mondays.
 */
import { describe, it, expect } from '@jest/globals';
import { isKind, type ObservationOf } from '@core/observation';
import { computeWeeklyStimulus } from '@core/stimulus';
import { runMigrations } from '../storage/db';
import { createObservation, listObservations } from '../storage/observations';
import { makeTestDb } from '../storage/__tests__/sqliteTestDb';
import {
  buildSessionObservation,
  emptySessionForm,
  type BuildContext,
  type SessionForm,
} from '../lib/session';

function ctx(id: string, now: string): BuildContext {
  return { id, now, tz: 'America/Los_Angeles', weightUnit: 'kg', distanceUnit: 'km' };
}

// A pull session: a warm-up (excluded) + two working sets, all upper-pull.
function pullForm(): SessionForm {
  const form = emptySessionForm();
  form.modality = 'gym';
  form.durationMin = '50';
  form.gym.exercises = [
    {
      id: 'e1',
      name: 'barbell row',
      movementPattern: 'upper-pull',
      sets: [
        { id: 'w', weight: '40', reps: '8', holdSec: '', rir: '', isWarmup: true },
        { id: 'a', weight: '100', reps: '5', holdSec: '', rir: '2', isWarmup: false },
        { id: 'b', weight: '100', reps: '5', holdSec: '', rir: '1', isWarmup: false },
      ],
    },
  ];
  return form;
}

// A squat session: warm-up (excluded) + one working set, quad-dom.
function squatForm(): SessionForm {
  const form = emptySessionForm();
  form.modality = 'gym';
  form.durationMin = '40';
  form.gym.exercises = [
    {
      id: 'e1',
      name: 'back squat',
      movementPattern: 'quad-dom',
      sets: [
        { id: 'w', weight: '60', reps: '5', holdSec: '', rir: '', isWarmup: true },
        { id: 'a', weight: '120', reps: '3', holdSec: '', rir: '2', isWarmup: false },
      ],
    },
  ];
  return form;
}

function runForm(): SessionForm {
  const form = emptySessionForm();
  form.modality = 'run';
  form.durationMin = '30';
  form.endurance = { distance: '6', avgHr: '', energySystem: 'aerobic' };
  return form;
}

describe('weekly stimulus ledger (Pass 5)', () => {
  it('groups sessions by ISO week with per-pattern volume and energy-system minutes', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    // Week of 2026-06-15: a pull session (Mon) + a run (Wed).
    await createObservation(buildSessionObservation(pullForm(), ctx('pull', '2026-06-15T17:00:00Z')), db);
    await createObservation(buildSessionObservation(runForm(), ctx('run', '2026-06-17T17:00:00Z')), db);
    // Week of 2026-06-08: a squat session (Mon).
    await createObservation(buildSessionObservation(squatForm(), ctx('squat', '2026-06-08T17:00:00Z')), db);

    const rows = await listObservations(
      { from: '2026-06-01T00:00:00Z', to: '2026-06-30T23:59:59Z', kinds: ['session'] },
      db
    );
    const sessions = rows.filter((o): o is ObservationOf<'session'> => isKind(o, 'session'));
    const ledger = computeWeeklyStimulus(sessions);

    // Two weeks, oldest first.
    expect(ledger.map((w) => w.weekStart)).toEqual(['2026-06-08', '2026-06-15']);

    const wk08 = ledger[0];
    const wk15 = ledger[1];

    // Squat week: one working quad-dom set, 120*3 = 360 kg. No upper-pull.
    expect(wk08.byPattern['quad-dom']).toEqual({ sets: 1, volumeLoadKg: 360 });
    expect(wk08.byPattern['upper-pull']).toBeUndefined();
    expect(wk08.sessionIds).toEqual(['squat']);

    // Pull week: two working upper-pull sets, 100*5 + 100*5 = 1,000 kg (warm-up out).
    expect(wk15.byPattern['upper-pull']).toEqual({ sets: 2, volumeLoadKg: 1000 });
    // The run added 30 aerobic minutes but no pattern volume.
    expect(wk15.byEnergySystem.aerobic.minutes).toBe(30);
    expect(wk15.byEnergySystem.glycolytic.minutes).toBe(0);
    // Both sessions show up for the drill-down, ordered by occurredAt.
    expect(wk15.sessionIds).toEqual(['pull', 'run']);
  });

  it('returns an empty ledger for no sessions (honest, not a throw)', () => {
    expect(computeWeeklyStimulus([])).toEqual([]);
  });
});
