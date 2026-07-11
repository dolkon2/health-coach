/**
 * Migration 015 (spots_sport) tests: the conservative backfill — river
 * sections get 'kayak', flying sites get 'paragliding', launch spots and any
 * other/legacy kind stay untagged (NULL) rather than guess — plus a plain
 * create/list round-trip and the new listSpots({sport}) filter.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import type { Spot } from '@core/spot';
import { makeTestDb } from './sqliteTestDb';
import { runMigrations, type SqlDatabase } from '../db';
import { createSpot, listSpots, getSpot } from '../spots';

describe('migration 015 — spots_sport backfill', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = makeTestDb();
    // Build the pre-015 canonical shape directly (post-014, pre-015) so the
    // backfill runs against real legacy rows, not spots created after 015
    // already existed (which would trivially carry `sport` from the start).
    await db.execAsync(`
      CREATE TABLE migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, appliedAt TEXT NOT NULL);
      CREATE TABLE spots (
        id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, lat REAL, lng REAL,
        kind TEXT NOT NULL, meta TEXT, riverName TEXT, sectionName TEXT,
        gaugeSiteId TEXT, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT
      );
    `);
    for (let v = 1; v <= 9; v++) {
      await db.runAsync('INSERT INTO migrations (version, name, appliedAt) VALUES (?, ?, ?);', [
        v,
        `legacy_${v}`,
        '2026-07-01T00:00:00.000Z',
      ]);
    }
    await db.runAsync('INSERT INTO migrations (version, name, appliedAt) VALUES (?, ?, ?);', [
      14,
      'dimension_unify',
      '2026-07-09T00:00:00.000Z',
    ]);
    await db.runAsync(
      `INSERT INTO spots (id, name, kind, riverName, sectionName, gaugeSiteId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['river-1', 'Green Truss', 'river-section', 'White Salmon', 'Green Truss', 'USGS-14123500', '2026-07-01T00:00:00.000Z']
    );
    await db.runAsync(`INSERT INTO spots (id, name, kind, createdAt) VALUES (?, ?, ?, ?);`, [
      'flying-1',
      'Tiger Mountain',
      'flying-site',
      '2026-07-01T00:00:00.000Z',
    ]);
    await db.runAsync(`INSERT INTO spots (id, name, kind, createdAt) VALUES (?, ?, ?, ?);`, [
      'launch-1',
      'Hood River sandbar',
      'launch',
      '2026-07-01T00:00:00.000Z',
    ]);
    await db.runAsync(`INSERT INTO spots (id, name, kind, createdAt) VALUES (?, ?, ?, ?);`, [
      'other-1',
      'Some legacy row',
      'unknown-kind',
      '2026-07-01T00:00:00.000Z',
    ]);
    await runMigrations(db); // applies 015 against these pre-existing rows
  });

  it('backfills river-section spots to kayak', async () => {
    expect((await getSpot('river-1', db))?.sport).toBe('kayak');
  });

  it('backfills flying-site spots to paraglide', async () => {
    expect((await getSpot('flying-1', db))?.sport).toBe('paragliding');
  });

  it('leaves launch spots untagged — the wind-sport ambiguity is not guessed', async () => {
    expect((await getSpot('launch-1', db))?.sport).toBeUndefined();
  });

  it('leaves any other/legacy kind untagged', async () => {
    expect((await getSpot('other-1', db))?.sport).toBeUndefined();
  });
});

describe('spot storage — sport tag', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = makeTestDb();
    await runMigrations(db);
  });

  const kayakSpot: Spot = {
    id: 'spot-new',
    name: 'New Green Truss',
    kind: 'river-section',
    sport: 'kayak',
    gaugeSiteId: 'USGS-14123500',
    createdAt: '2026-07-11T10:00:00.000Z',
  };
  const untaggedSpot: Spot = {
    id: 'spot-untagged',
    name: 'Some launch',
    kind: 'launch',
    lat: 45.6,
    lng: -121.5,
    createdAt: '2026-07-11T10:00:00.000Z',
  };

  it('round-trips sport identical, and omits it when absent (null ≠ 0)', async () => {
    await createSpot(kayakSpot, db);
    await createSpot(untaggedSpot, db);
    expect(await getSpot('spot-new', db)).toEqual(kayakSpot);
    expect((await getSpot('spot-untagged', db))?.sport).toBeUndefined();
  });

  it('listSpots({sport}) filters to the tagged spot only', async () => {
    await createSpot(kayakSpot, db);
    await createSpot(untaggedSpot, db);
    const kayakSpots = await listSpots({ sport: 'kayak' }, db);
    expect(kayakSpots.map((s) => s.id)).toEqual(['spot-new']);
  });
});
