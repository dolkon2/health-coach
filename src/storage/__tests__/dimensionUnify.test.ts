/**
 * Migration 014 (dimension_unify) — the four legacy starting states.
 *
 * A device may arrive at 014 having run any ONE branch's burned 010–013
 * migrations (Water / Earth / Sky shapes), or none (fresh, or Body). Each
 * case must converge to the canonical schema with data carried over — these
 * tests build each legacy shape exactly as its branch's migrations left it
 * (including the bookkeeping rows that make the runner skip those numbers)
 * and assert the rebuild.
 */
import { describe, it, expect } from '@jest/globals';
import { makeTestDb } from './sqliteTestDb';
import { runMigrations, type SqlDatabase } from '../db';

async function columns(db: SqlDatabase, table: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  return rows.map((r) => r.name).sort();
}

const CANONICAL_GEAR_COLS = [
  'acquiredOn',
  'category',
  'createdAt',
  'id',
  'name',
  'notes',
  'parentId',
  'retiredOn',
  'spec',
  'updatedAt',
].sort();

const CANONICAL_SPOTS_COLS = [
  'createdAt',
  'gaugeSiteId',
  'id',
  'kind',
  'lat',
  'lng',
  'meta',
  'name',
  'notes',
  'riverName',
  'sectionName',
  'updatedAt',
].sort();

/** Marks versions as applied WITHOUT running them — simulates a branch device. */
async function markApplied(db: SqlDatabase, versions: number[]): Promise<void> {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS migrations (
       version INTEGER PRIMARY KEY, name TEXT NOT NULL, appliedAt TEXT NOT NULL
     );`
  );
  for (const v of versions) {
    await db.runAsync('INSERT INTO migrations (version, name, appliedAt) VALUES (?, ?, ?);', [
      v,
      `legacy_${v}`,
      '2026-07-01T00:00:00.000Z',
    ]);
  }
}

describe('migration 014 — fresh device', () => {
  it('creates all four canonical tables', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    expect(await columns(db, 'gear')).toEqual(CANONICAL_GEAR_COLS);
    expect(await columns(db, 'spots')).toEqual(CANONICAL_SPOTS_COLS);
    expect(await columns(db, 'kits')).toEqual(['createdAt', 'gearIds', 'id', 'name'].sort());
    expect((await columns(db, 'conditions_snapshots')).length).toBeGreaterThan(0);
  });
});

describe('migration 014 — Water-shaped device (snake_case 010_gear_kits_spots)', () => {
  it('rebuilds gear/kits/spots to canonical and carries data', async () => {
    const db = makeTestDb();
    await markApplied(db, [10]);
    await db.execAsync(`
      CREATE TABLE gear (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
        spec TEXT, acquired_on TEXT, retired_on TEXT, notes TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE kits (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, gear_ids TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE spots (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL,
        lat REAL, lng REAL, river_name TEXT, section_name TEXT, gauge_site_id TEXT,
        notes TEXT, created_at TEXT NOT NULL
      );
      INSERT INTO gear VALUES ('g1', '9m Wing', 'wing', '{"sizeM2":9}', '2025-04-12', NULL, NULL, '2026-07-01T10:00:00.000Z');
      INSERT INTO kits VALUES ('k1', 'Light wind', '["g1"]', '2026-07-01T10:00:00.000Z');
      INSERT INTO spots VALUES ('s1', 'Green Truss', 'river-section', NULL, NULL, 'White Salmon', 'Green Truss', 'USGS-14123500', NULL, '2026-07-01T10:00:00.000Z');
    `);

    await runMigrations(db);

    expect(await columns(db, 'gear')).toEqual(CANONICAL_GEAR_COLS);
    expect(await columns(db, 'spots')).toEqual(CANONICAL_SPOTS_COLS);

    const gear = await db.getFirstAsync<{ name: string; acquiredOn: string; spec: string }>(
      'SELECT name, acquiredOn, spec FROM gear WHERE id = ?;',
      ['g1']
    );
    expect(gear).toEqual({ name: '9m Wing', acquiredOn: '2025-04-12', spec: '{"sizeM2":9}' });

    const kit = await db.getFirstAsync<{ gearIds: string }>(
      'SELECT gearIds FROM kits WHERE id = ?;',
      ['k1']
    );
    expect(kit).toEqual({ gearIds: '["g1"]' });

    const spot = await db.getFirstAsync<{
      riverName: string;
      gaugeSiteId: string;
      lat: number | null;
      meta: string | null;
    }>('SELECT riverName, gaugeSiteId, lat, meta FROM spots WHERE id = ?;', ['s1']);
    expect(spot).toEqual({
      riverName: 'White Salmon',
      gaugeSiteId: 'USGS-14123500',
      lat: null, // pre-geocode spot survives (canonical lat is nullable)
      meta: null,
    });
  });
});

describe('migration 014 — Earth-shaped device (camelCase 010 gear + 011 rename)', () => {
  it('rebuilds gear to canonical, keeps parentId, creates the missing tables', async () => {
    const db = makeTestDb();
    await markApplied(db, [10, 11]);
    // As Earth's 010 + 011 left it: camelCase, parentId, renamed date columns.
    await db.execAsync(`
      CREATE TABLE gear (
        id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL,
        parentId TEXT, acquiredOn TEXT, retiredOn TEXT, spec TEXT, notes TEXT, createdAt TEXT NOT NULL
      );
      INSERT INTO gear VALUES ('bike1', 'Gravel bike', 'bike', NULL, NULL, NULL, '{}', NULL, '2026-07-01T10:00:00.000Z');
      INSERT INTO gear VALUES ('chain1', 'SRAM chain', 'bike-component', 'bike1', '2026-07-01', NULL, '{"componentType":"chain"}', NULL, '2026-07-01T10:00:00.000Z');
    `);

    await runMigrations(db);

    expect(await columns(db, 'gear')).toEqual(CANONICAL_GEAR_COLS);
    const chain = await db.getFirstAsync<{ parentId: string; acquiredOn: string }>(
      'SELECT parentId, acquiredOn FROM gear WHERE id = ?;',
      ['chain1']
    );
    expect(chain).toEqual({ parentId: 'bike1', acquiredOn: '2026-07-01' });
    // Earth devices never had kits/spots/conditions — 014 creates them.
    expect(await columns(db, 'kits')).toEqual(['createdAt', 'gearIds', 'id', 'name'].sort());
    expect(await columns(db, 'spots')).toEqual(CANONICAL_SPOTS_COLS);
  });
});

describe('migration 014 — Sky-shaped device (010 gear + 011 spots + 012 conditions + 013 rename)', () => {
  it('rebuilds gear (keeps updatedAt) and spots (keeps meta, relaxes lat/lng)', async () => {
    const db = makeTestDb();
    await markApplied(db, [10, 11, 12, 13]);
    // As Sky's migrations left it (010 + 013 rename; 011 spots; 012 conditions).
    await db.execAsync(`
      CREATE TABLE gear (
        id TEXT PRIMARY KEY NOT NULL, category TEXT NOT NULL, name TEXT NOT NULL,
        spec TEXT NOT NULL, acquiredOn TEXT, retiredOn TEXT, notes TEXT,
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
      );
      CREATE TABLE spots (
        id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
        kind TEXT NOT NULL, meta TEXT, notes TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
      );
      CREATE TABLE conditions_snapshots (
        id TEXT PRIMARY KEY NOT NULL, spotId TEXT NOT NULL, capturedAt TEXT NOT NULL,
        dateLocal TEXT NOT NULL, source TEXT NOT NULL, surface TEXT, aloft TEXT
      );
      INSERT INTO gear VALUES ('w1', 'paraglider', 'Ozone Rush 6', '{"style":"xc"}', NULL, NULL, NULL, '2026-07-01T10:00:00.000Z', '2026-07-02T10:00:00.000Z');
      INSERT INTO spots VALUES ('fs1', 'Cliffside', 45.66, -121.55, 'flying-site', '{"requiresMembership":true}', NULL, '2026-07-01T10:00:00.000Z', '2026-07-01T10:00:00.000Z');
      INSERT INTO conditions_snapshots VALUES ('c1', 'fs1', '2026-07-01T10:00:00.000Z', '2026-07-01', 'open-meteo', NULL, NULL);
    `);

    await runMigrations(db);

    expect(await columns(db, 'gear')).toEqual(CANONICAL_GEAR_COLS);
    expect(await columns(db, 'spots')).toEqual(CANONICAL_SPOTS_COLS);

    // Sky's gear table stored category in column 2 / name in column 3 — the
    // rebuild maps by NAME, so the values must land in the right columns.
    const wing = await db.getFirstAsync<{ category: string; name: string; updatedAt: string }>(
      'SELECT category, name, updatedAt FROM gear WHERE id = ?;',
      ['w1']
    );
    expect(wing).toEqual({
      category: 'paraglider',
      name: 'Ozone Rush 6',
      updatedAt: '2026-07-02T10:00:00.000Z',
    });

    const site = await db.getFirstAsync<{ meta: string; riverName: string | null; lat: number }>(
      'SELECT meta, riverName, lat FROM spots WHERE id = ?;',
      ['fs1']
    );
    expect(site).toEqual({ meta: '{"requiresMembership":true}', riverName: null, lat: 45.66 });

    // Existing snapshot rows survive untouched (the CREATE is IF NOT EXISTS).
    const snap = await db.getFirstAsync<{ spotId: string }>(
      'SELECT spotId FROM conditions_snapshots WHERE id = ?;',
      ['c1']
    );
    expect(snap).toEqual({ spotId: 'fs1' });
  });

  it('is idempotent — a second run on an already-canonical db is a no-op', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await db.runAsync('DELETE FROM migrations WHERE version = 14;');
    await runMigrations(db); // re-runs 014 against canonical tables
    expect(await columns(db, 'gear')).toEqual(CANONICAL_GEAR_COLS);
    expect(await columns(db, 'spots')).toEqual(CANONICAL_SPOTS_COLS);
  });
});
