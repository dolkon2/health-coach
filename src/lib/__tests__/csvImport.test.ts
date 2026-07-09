/**
 * csvImport.test.ts — dedupe + storage write for CSV import (Body P5), real
 * SQL via makeTestDb() (not a mock — genuine round-trip through the same
 * observations table the app reads).
 */
import { describe, expect, it } from '@jest/globals';
import { runMigrations } from '@/storage/db';
import { makeTestDb } from '@/storage/__tests__/sqliteTestDb';
import { createObservation, listObservations } from '@/storage/observations';
import { applyCsvImport, rowKey, type ImportedSession } from '../csvImport';

let idCounter = 0;
function ctx() {
  return { idFactory: () => `id-${idCounter++}`, tz: 'UTC', loggedAt: '2026-01-01T00:00:00.000Z' };
}

function session(overrides: Partial<ImportedSession> = {}): ImportedSession {
  return {
    date: '2026-06-29T07:12:41.000Z',
    workoutName: 'Push Day',
    sets: [
      {
        exercise: 'Bench Press (Barbell)',
        movementPattern: 'upper-push',
        weightKg: 100,
        reps: 5,
        rowKey: rowKey({
          date: '2026-06-29 07:12:41',
          workoutName: 'Push Day',
          exercise: 'Bench Press (Barbell)',
          setOrder: '1',
          weightKg: 100,
          reps: 5,
        }),
      },
    ],
    ...overrides,
  };
}

describe('applyCsvImport', () => {
  it('writes a new session with its row keys stored in source.rowHashes', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const result = await applyCsvImport([session()], 'strong-csv', 'samples.csv', ctx(), db);
    expect(result).toEqual({ sessionsWritten: 1, setsWritten: 1, sessionsSkippedAsFullDuplicate: 0 });

    const rows = await listObservations({ kinds: ['session'] }, db);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toMatchObject({ type: 'fileimport', format: 'strong-csv', filename: 'samples.csv' });
    if (rows[0].source.type === 'fileimport') {
      expect(rows[0].source.rowHashes).toHaveLength(1);
    }
  });

  it('re-importing the exact same file is a no-op (idempotent)', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await applyCsvImport([session()], 'strong-csv', 'samples.csv', ctx(), db);
    const second = await applyCsvImport([session()], 'strong-csv', 'samples.csv', ctx(), db);
    expect(second).toEqual({ sessionsWritten: 0, setsWritten: 0, sessionsSkippedAsFullDuplicate: 1 });

    const rows = await listObservations({ kinds: ['session'] }, db);
    expect(rows).toHaveLength(1); // still just the one session from the first import
  });

  it('a re-import with one new row alongside an already-seen one writes only the new row', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await applyCsvImport([session()], 'strong-csv', 'samples.csv', ctx(), db);

    const overlapping = session({
      sets: [
        ...session().sets, // the already-imported row
        {
          exercise: 'Bench Press (Barbell)',
          movementPattern: 'upper-push',
          weightKg: 100,
          reps: 5,
          rowKey: rowKey({
            date: '2026-06-29 07:12:41',
            workoutName: 'Push Day',
            exercise: 'Bench Press (Barbell)',
            setOrder: '2', // a genuinely different row
            weightKg: 100,
            reps: 5,
          }),
        },
      ],
    });
    const result = await applyCsvImport([overlapping], 'strong-csv', 'samples.csv', ctx(), db);
    expect(result.sessionsWritten).toBe(1);
    expect(result.setsWritten).toBe(1); // only the new row, not the already-seen one
  });

  it('a manually-logged session with a coincidentally similar set never blocks the CSV import', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    // A hand-entered session carries no rowHashes — it must never suppress an
    // otherwise-new CSV row just because the fact happens to look similar.
    await createObservation(
      {
        id: 'manual-1',
        kind: 'session',
        occurredAt: '2026-06-29T07:12:41.000Z',
        loggedAt: '2026-06-29T07:12:41.000Z',
        tz: 'UTC',
        tier: 1,
        fidelity: 0.95,
        source: { type: 'manual' },
        payload: {
          kind: 'session',
          modality: 'gym',
          lifting: {
            sets: [{ exercise: 'Bench Press (Barbell)', movementPattern: 'upper-push', weightKg: 100, reps: 5 }],
          },
        },
      },
      db
    );
    const result = await applyCsvImport([session()], 'strong-csv', 'samples.csv', ctx(), db);
    expect(result.sessionsWritten).toBe(1);
    expect(result.sessionsSkippedAsFullDuplicate).toBe(0);
  });
});
