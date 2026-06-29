/**
 * Storage round-trip tests for SessionTemplate (Phase 6 Pass 1).
 *
 * Real SQL via better-sqlite3 in-memory — exercises migration 002, the
 * serializer, and the CRUD module. One round-trip per surface confirms each
 * shape variant survives JSON.stringify/parse with its discriminator intact.
 */
import { describe, it, expect } from '@jest/globals';
import type {
  SessionTemplate,
  GymTemplateShape,
  GpsTemplateShape,
  ClimbingTemplateShape,
  SwimTemplateShape,
  PracticeTemplateShape,
} from '@core/sessionTemplate';
import { runMigrations } from '../db';
import {
  createTemplate,
  listTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
} from '../sessionTemplates';
import { makeTestDb } from './sqliteTestDb';

function gymTemplate(id: string, name = 'Push Day'): SessionTemplate {
  const shape: GymTemplateShape = {
    surface: 'gym',
    exercises: [
      {
        id: 'ex1',
        name: 'Barbell bench',
        movementPattern: 'upper-push',
        restBetweenSetsSec: 120,
        sets: [
          { id: 's1', targetReps: '8', targetWeightKg: 60 },
          { id: 's2', targetReps: '6', targetWeightKg: 75 },
          { id: 's3', targetReps: '5-8', targetWeightKg: 80 },
        ],
      },
      {
        id: 'ex2',
        name: 'Overhead press',
        movementPattern: 'upper-push',
        restBetweenSetsSec: 90,
        sets: [
          { id: 's1', targetReps: '6-10', targetWeightKg: 45 },
          { id: 's2', targetReps: '6-10', targetWeightKg: 45 },
          { id: 's3', targetReps: '6-10', targetWeightKg: 45 },
        ],
      },
      {
        id: 'ex3',
        name: 'Dips',
        movementPattern: 'upper-push',
        sets: [
          { id: 's1', targetReps: 'AMRAP' },
          { id: 's2', targetReps: 'AMRAP' },
          { id: 's3', targetReps: 'AMRAP' },
        ],
      },
    ],
  };
  return {
    id,
    name,
    surface: 'gym',
    activity: 'gym',
    shape,
    isActive: true,
    createdAt: '2026-06-28T10:00:00Z',
    updatedAt: '2026-06-28T10:00:00Z',
  };
}

function gpsTemplate(id: string): SessionTemplate {
  const shape: GpsTemplateShape = {
    surface: 'gps',
    targetDistanceM: 5000,
    energySystem: 'aerobic',
    notes: 'Easy zone-2 effort',
  };
  return {
    id,
    name: 'Park run',
    surface: 'gps',
    activity: 'run',
    shape,
    dayAssignment: 2, // Wednesday
    isActive: true,
    createdAt: '2026-06-28T10:01:00Z',
    updatedAt: '2026-06-28T10:01:00Z',
  };
}

function practiceTemplate(id: string): SessionTemplate {
  const shape: PracticeTemplateShape = {
    surface: 'practice',
    targetDurationMin: 60,
    style: 'vinyasa',
  };
  return {
    id,
    name: 'Vinyasa',
    surface: 'practice',
    activity: 'yoga',
    shape,
    isActive: true,
    createdAt: '2026-06-28T10:02:00Z',
    updatedAt: '2026-06-28T10:02:00Z',
  };
}

function climbingTemplate(id: string): SessionTemplate {
  const shape: ClimbingTemplateShape = {
    surface: 'climbing',
    style: 'boulder',
    targetGradeRange: 'V3-V5',
    targetSends: 8,
  };
  return {
    id,
    name: 'Bouldering session',
    surface: 'climbing',
    activity: 'climb',
    shape,
    isActive: true,
    createdAt: '2026-06-28T10:03:00Z',
    updatedAt: '2026-06-28T10:03:00Z',
  };
}

function swimTemplate(id: string): SessionTemplate {
  const shape: SwimTemplateShape = {
    surface: 'swim',
    mode: 'pool',
    poolLengthM: 25,
    targetLaps: 40,
    stroke: 'freestyle',
    energySystem: 'aerobic',
  };
  return {
    id,
    name: 'Pool laps',
    surface: 'swim',
    activity: 'swim',
    shape,
    isActive: true,
    createdAt: '2026-06-28T10:04:00Z',
    updatedAt: '2026-06-28T10:04:00Z',
  };
}

describe('session_templates storage', () => {
  it('round-trips a gym template with full exercise list', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = gymTemplate('t-gym-1');
    await createTemplate(original, db);

    const back = await getTemplateById('t-gym-1', db);
    expect(back).not.toBeNull();
    expect(back!.name).toBe('Push Day');
    expect(back!.surface).toBe('gym');
    expect(back!.activity).toBe('gym');
    expect(back!.isActive).toBe(true);
    expect(back!.dayAssignment).toBeUndefined();
    expect(back!.shape).toEqual(original.shape);
    // discriminator survived
    const gym = back!.shape as GymTemplateShape;
    expect(gym.exercises).toHaveLength(3);
    // per-set targets survived intact (Phase 6 Pass 1 redesign)
    expect(gym.exercises[0].sets).toHaveLength(3);
    expect(gym.exercises[0].sets[0].targetReps).toBe('8');
    expect(gym.exercises[0].restBetweenSetsSec).toBe(120);
    expect(gym.exercises[1].restBetweenSetsSec).toBe(90);
    expect(gym.exercises[2].restBetweenSetsSec).toBeUndefined();
    expect(gym.exercises[2].sets[0].targetReps).toBe('AMRAP');
    expect(gym.exercises[2].sets[0].targetWeightKg).toBeUndefined();
  });

  it('round-trips each surface shape with discriminator intact', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createTemplate(gymTemplate('t-gym'), db);
    await createTemplate(gpsTemplate('t-gps'), db);
    await createTemplate(climbingTemplate('t-climb'), db);
    await createTemplate(swimTemplate('t-swim'), db);
    await createTemplate(practiceTemplate('t-practice'), db);

    const list = await listTemplates(db);
    expect(list).toHaveLength(5);

    const bySurface = Object.fromEntries(list.map((t) => [t.surface, t]));
    expect(bySurface.gym.shape.surface).toBe('gym');
    expect(bySurface.gps.shape.surface).toBe('gps');
    expect(bySurface.climbing.shape.surface).toBe('climbing');
    expect(bySurface.swim.shape.surface).toBe('swim');
    expect(bySurface.practice.shape.surface).toBe('practice');

    expect((bySurface.gps.shape as GpsTemplateShape).targetDistanceM).toBe(5000);
    expect((bySurface.practice.shape as PracticeTemplateShape).style).toBe('vinyasa');
    expect((bySurface.climbing.shape as ClimbingTemplateShape).style).toBe('boulder');
    expect((bySurface.swim.shape as SwimTemplateShape).mode).toBe('pool');
  });

  it('preserves dayAssignment when set, omits the key when not', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createTemplate(gymTemplate('t-no-day'), db); // no dayAssignment
    await createTemplate(gpsTemplate('t-wed'), db); // dayAssignment 2

    const noDay = await getTemplateById('t-no-day', db);
    const wed = await getTemplateById('t-wed', db);

    expect(noDay!.dayAssignment).toBeUndefined();
    expect(wed!.dayAssignment).toBe(2);
  });

  it('listTemplates returns most-recently-updated first', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createTemplate(gymTemplate('t-old'), db);
    await createTemplate({
      ...gpsTemplate('t-new'),
      updatedAt: '2026-06-29T12:00:00Z',
    }, db);

    const list = await listTemplates(db);
    expect(list.map((t) => t.id)).toEqual(['t-new', 't-old']);
  });

  it('updateTemplate patches the row and bumps updatedAt; createdAt preserved', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = gymTemplate('t-1');
    await createTemplate(original, db);

    await updateTemplate(
      't-1',
      {
        name: 'Push Day v2',
        isActive: false,
        dayAssignment: 0,
        updatedAt: '2026-07-01T09:00:00Z',
      },
      db
    );

    const back = await getTemplateById('t-1', db);
    expect(back!.name).toBe('Push Day v2');
    expect(back!.isActive).toBe(false);
    expect(back!.dayAssignment).toBe(0);
    expect(back!.createdAt).toBe(original.createdAt);
    expect(back!.updatedAt).toBe('2026-07-01T09:00:00Z');
    // shape unchanged
    expect(back!.shape).toEqual(original.shape);
  });

  it('updateTemplate throws when the id does not exist', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await expect(
      updateTemplate('ghost', { name: 'whatever' }, db)
    ).rejects.toThrow(/no template with id ghost/);
  });

  it('deleteTemplate removes the row and returns true; false when missing', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createTemplate(gymTemplate('t-1'), db);

    expect(await deleteTemplate('t-1', db)).toBe(true);
    expect(await getTemplateById('t-1', db)).toBeNull();
    expect(await listTemplates(db)).toHaveLength(0);

    // Idempotent.
    expect(await deleteTemplate('t-1', db)).toBe(false);
  });

  it('isActive defaults round-trip as boolean (stored as 0/1)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createTemplate({ ...gymTemplate('t-on'), isActive: true }, db);
    await createTemplate({ ...gymTemplate('t-off', 'Pull Day'), isActive: false }, db);

    const on = await getTemplateById('t-on', db);
    const off = await getTemplateById('t-off', db);
    expect(on!.isActive).toBe(true);
    expect(off!.isActive).toBe(false);
  });
});
