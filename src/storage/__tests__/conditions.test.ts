/**
 * Storage tests for conditions_snapshots (migration 012).
 *
 * Real SQL via better-sqlite3 in-memory. Freezes are immutable facts: the
 * module exposes NO update path, and the primary key rejects a re-freeze
 * under the same id. Listing is the product query — a site's history newest
 * day first, newest capture first within a day.
 */
import { describe, it, expect } from '@jest/globals';
import type { SkyConditionsSnapshot } from '@core/skyConditions';
import { runMigrations } from '../db';
import { saveSnapshot, listSnapshotsForSpot, getSnapshotById } from '../conditions';
import { makeTestDb } from './sqliteTestDb';

function snapshot(
  id: string,
  overrides: Partial<SkyConditionsSnapshot> = {}
): SkyConditionsSnapshot {
  return {
    id,
    spotId: 'spot-1',
    capturedAt: '2026-07-05T21:20:00Z',
    dateLocal: '2026-07-05',
    source: 'open-meteo',
    surface: { tempC: 23.9, windSpeedMS: 4.4, windDirDeg: 282, gustMS: 6.1, precipMm: 0 },
    aloft: {
      p850: { windSpeedMS: 7.2, windDirDeg: 305, tempC: 12.8 },
      p700: { windSpeedMS: 11.4, windDirDeg: 320, tempC: 4.1 },
    },
    ...overrides,
  };
}

describe('conditions storage', () => {
  it('round-trips a full snapshot, surface and aloft JSON intact', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = snapshot('c-1');
    await saveSnapshot(original, db);

    const back = await getSnapshotById('c-1', db);
    expect(back).toEqual(original);
  });

  it('omits absent surface/aloft on the way back (no null leakage)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const sparse: SkyConditionsSnapshot = {
      id: 'c-sparse',
      spotId: 'spot-1',
      capturedAt: '2026-07-05T21:20:00Z',
      dateLocal: '2026-07-05',
      source: 'open-meteo',
    };
    await saveSnapshot(sparse, db);

    const back = await getSnapshotById('c-sparse', db);
    expect(back).toEqual(sparse);
    expect('surface' in back!).toBe(false);
    expect('aloft' in back!).toBe(false);
  });

  it('lists a spot history newest day first, newest capture first within a day', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    // Inserted out of order on purpose — the ORDER BY does the work.
    await saveSnapshot(
      snapshot('c-today-am', { dateLocal: '2026-07-05', capturedAt: '2026-07-05T16:00:00Z' }),
      db
    );
    await saveSnapshot(
      snapshot('c-old', { dateLocal: '2026-07-03', capturedAt: '2026-07-03T20:00:00Z' }),
      db
    );
    await saveSnapshot(
      snapshot('c-today-pm', { dateLocal: '2026-07-05', capturedAt: '2026-07-05T21:20:00Z' }),
      db
    );
    await saveSnapshot(
      snapshot('c-other-spot', { spotId: 'spot-2', dateLocal: '2026-07-06' }),
      db
    );

    const history = await listSnapshotsForSpot('spot-1', {}, db);
    expect(history.map((s) => s.id)).toEqual(['c-today-pm', 'c-today-am', 'c-old']);
  });

  it('honors limit while keeping the ordering', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await saveSnapshot(snapshot('c-1', { dateLocal: '2026-07-03' }), db);
    await saveSnapshot(snapshot('c-2', { dateLocal: '2026-07-04' }), db);
    await saveSnapshot(snapshot('c-3', { dateLocal: '2026-07-05' }), db);

    const latest = await listSnapshotsForSpot('spot-1', { limit: 2 }, db);
    expect(latest.map((s) => s.id)).toEqual(['c-3', 'c-2']);
  });

  it('is insert-only: a second save under the same id is rejected, the freeze stands', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = snapshot('c-1');
    await saveSnapshot(original, db);

    // Plain try/catch rather than .rejects: the rejection is a NATIVE
    // better-sqlite3 SqliteError, which jest's rejects unwrapping has
    // intermittently misread under parallel workers ("did not throw").
    const rewrite = snapshot('c-1', { surface: { tempC: 99 } });
    let rejection: unknown = null;
    try {
      await saveSnapshot(rewrite, db);
    } catch (e) {
      rejection = e;
    }
    expect(String(rejection)).toMatch(/UNIQUE constraint failed/);

    const back = await getSnapshotById('c-1', db);
    expect(back).toEqual(original); // captured-at-the-time fact, untouched
  });

  it('getSnapshotById returns null for an unknown id', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    expect(await getSnapshotById('ghost', db)).toBeNull();
  });
});
