/**
 * Migration 014 — dimension unify (the 2026-07-09 four-branch merge).
 *
 * Earth, Sky, and Water each shipped their own Gear/Spot tables under
 * migration numbers 010–013 on parallel branches, with different column sets
 * AND different name casing (Water snake_case, Earth/Sky camelCase). Those
 * numbers are burned (see the registry comment) — a device may have run any
 * one branch's versions, or none. This migration introspects what actually
 * exists via PRAGMA table_info and converges every possible starting state to
 * ONE canonical schema, carrying all data over:
 *
 *   gear   — canonical superset: id/name/category/parentId(Earth)/acquiredOn/
 *            retiredOn/spec/notes/createdAt/updatedAt(Sky, nullable)
 *   kits   — Water's table, camelCased (gearIds/createdAt)
 *   spots  — Water's typed columns (riverName/sectionName/gaugeSiteId)
 *            PLUS Sky's kind+meta bag; lat/lng nullable (pre-geocode Water
 *            rows exist); updatedAt nullable
 *   conditions_snapshots — Sky's 012 verbatim (created here for non-Sky
 *            devices; identical no-op on Sky devices)
 *
 * A code migration (`run`), not SQL — pure SQL can't branch on which legacy
 * shape a device has. Idempotent by construction: a table already in
 * canonical shape is detected and left alone. Legacy shapes are detected by
 * their distinguishing columns, never guessed. Rebuilds follow the standard
 * SQLite recipe (create __new, INSERT…SELECT with column mapping, drop old,
 * rename) so NOT NULL constraints can be relaxed too (Sky's spots lat/lng).
 */
import type { Migration, MigrationDb } from './index';

async function columnsOf(db: MigrationDb, table: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  return new Set(rows.map((r) => r.name));
}

const CANONICAL_GEAR = `
  CREATE TABLE IF NOT EXISTS gear (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    parentId    TEXT,
    acquiredOn  TEXT,
    retiredOn   TEXT,
    spec        TEXT,
    notes       TEXT,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_gear_category  ON gear (category);
  CREATE INDEX IF NOT EXISTS idx_gear_retiredOn ON gear (retiredOn);
`;

const CANONICAL_KITS = `
  CREATE TABLE IF NOT EXISTS kits (
    id        TEXT PRIMARY KEY NOT NULL,
    name      TEXT NOT NULL,
    gearIds   TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`;

const CANONICAL_SPOTS = `
  CREATE TABLE IF NOT EXISTS spots (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    lat         REAL,
    lng         REAL,
    kind        TEXT NOT NULL,
    meta        TEXT,
    riverName   TEXT,
    sectionName TEXT,
    gaugeSiteId TEXT,
    notes       TEXT,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_spots_kind ON spots (kind);
`;

// Sky's 012, verbatim — the one dimension table with no collision.
const CANONICAL_CONDITIONS = `
  CREATE TABLE IF NOT EXISTS conditions_snapshots (
    id         TEXT PRIMARY KEY NOT NULL,
    spotId     TEXT NOT NULL,
    capturedAt TEXT NOT NULL,
    dateLocal  TEXT NOT NULL,
    source     TEXT NOT NULL,
    surface    TEXT,
    aloft      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_conditions_spot_day
    ON conditions_snapshots (spotId, dateLocal);
`;

async function unifyGear(db: MigrationDb): Promise<void> {
  const cols = await columnsOf(db, 'gear');
  if (cols.size === 0) {
    await db.execAsync(CANONICAL_GEAR); // fresh device — no legacy 010 ran
    return;
  }
  if (cols.has('parentId') && cols.has('updatedAt')) return; // already canonical

  // Legacy → canonical column mapping, keyed by each shape's fingerprint.
  //   Water  (010_gear_kits_spots): snake dates, no parentId/updatedAt
  //   Earth  (010_gear [+ 011 rename]): parentId, camel dates, no updatedAt
  //   Sky    (010_gear [+ 013 rename]): updatedAt, camel dates, no parentId
  // The camel date columns are resolved from the ACTUAL schema: a device that
  // upgraded before Earth's 011 / Sky's 013 rename shipped still has
  // acquiredAt/retiredAt — and since those numbers are burned, the rename can
  // only ever happen here.
  const acquired = cols.has('acquiredOn') ? 'acquiredOn' : 'acquiredAt';
  const retired = cols.has('retiredOn') ? 'retiredOn' : 'retiredAt';
  let select: string;
  if (cols.has('acquired_on')) {
    select = `SELECT id, name, category, NULL, acquired_on, retired_on, spec, notes, created_at, NULL FROM gear`;
  } else if (cols.has('parentId')) {
    select = `SELECT id, name, category, parentId, ${acquired}, ${retired}, spec, notes, createdAt, NULL FROM gear`;
  } else {
    select = `SELECT id, name, category, NULL, ${acquired}, ${retired}, spec, notes, createdAt, updatedAt FROM gear`;
  }

  await db.execAsync(`
    DROP TABLE IF EXISTS gear__new;
    CREATE TABLE gear__new (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      parentId    TEXT,
      acquiredOn  TEXT,
      retiredOn   TEXT,
      spec        TEXT,
      notes       TEXT,
      createdAt   TEXT NOT NULL,
      updatedAt   TEXT
    );
    INSERT INTO gear__new ${select};
    DROP TABLE gear;
    ALTER TABLE gear__new RENAME TO gear;
    CREATE INDEX IF NOT EXISTS idx_gear_category  ON gear (category);
    CREATE INDEX IF NOT EXISTS idx_gear_retiredOn ON gear (retiredOn);
  `);
}

async function unifyKits(db: MigrationDb): Promise<void> {
  const cols = await columnsOf(db, 'kits');
  if (cols.size === 0) {
    await db.execAsync(CANONICAL_KITS);
    return;
  }
  if (cols.has('gearIds')) return; // already canonical
  await db.execAsync(`
    DROP TABLE IF EXISTS kits__new;
    CREATE TABLE kits__new (
      id        TEXT PRIMARY KEY NOT NULL,
      name      TEXT NOT NULL,
      gearIds   TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    INSERT INTO kits__new SELECT id, name, gear_ids, created_at FROM kits;
    DROP TABLE kits;
    ALTER TABLE kits__new RENAME TO kits;
  `);
}

async function unifySpots(db: MigrationDb): Promise<void> {
  const cols = await columnsOf(db, 'spots');
  if (cols.size === 0) {
    await db.execAsync(CANONICAL_SPOTS);
    return;
  }
  if (cols.has('riverName') && cols.has('meta')) return; // already canonical

  // Water (river_name, snake bookkeeping, no meta/updatedAt) vs
  // Sky (meta + camel bookkeeping + NOT NULL lat/lng, no typed river columns).
  const select = cols.has('river_name')
    ? `SELECT id, name, lat, lng, kind, NULL, river_name, section_name, gauge_site_id, notes, created_at, NULL FROM spots`
    : `SELECT id, name, lat, lng, kind, meta, NULL, NULL, NULL, notes, createdAt, updatedAt FROM spots`;

  await db.execAsync(`
    DROP TABLE IF EXISTS spots__new;
    CREATE TABLE spots__new (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      lat         REAL,
      lng         REAL,
      kind        TEXT NOT NULL,
      meta        TEXT,
      riverName   TEXT,
      sectionName TEXT,
      gaugeSiteId TEXT,
      notes       TEXT,
      createdAt   TEXT NOT NULL,
      updatedAt   TEXT
    );
    INSERT INTO spots__new ${select};
    DROP TABLE spots;
    ALTER TABLE spots__new RENAME TO spots;
    CREATE INDEX IF NOT EXISTS idx_spots_kind ON spots (kind);
  `);
}

export const migration014: Migration = {
  version: 14,
  name: 'dimension_unify',
  run: async (db) => {
    await unifyGear(db);
    await unifyKits(db);
    await unifySpots(db);
    await db.execAsync(CANONICAL_CONDITIONS);
  },
};
