/**
 * Migration 010 — gear, kits, spots (Water dimension).
 *
 * Three small entity tables backing the quiver/kit/spot primitives
 * (core/src/gear.ts, core/src/spot.ts). `spec` and `gear_ids` are JSON TEXT
 * columns — the flat category-keyed GearSpec and the kit's gear-id list ride
 * whole, so shapes can evolve without DDL.
 *
 * Version 10 is Water's cross-branch reservation (contract §0.10:
 * Water=010, Earth=011, Sky=012, Body=013); CREATE TABLE IF NOT EXISTS is
 * the defensive belt for that coordination.
 */
import type { Migration } from './index';

export const migration010: Migration = {
  version: 10,
  name: '010_gear_kits_spots',
  sql: `
    CREATE TABLE IF NOT EXISTS gear (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      spec        TEXT,
      acquired_on TEXT,
      retired_on  TEXT,
      notes       TEXT,
      created_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kits (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      gear_ids   TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS spots (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      kind          TEXT NOT NULL,
      lat           REAL,
      lng           REAL,
      river_name    TEXT,
      section_name  TEXT,
      gauge_site_id TEXT,
      notes         TEXT,
      created_at    TEXT NOT NULL
    );
  `,
};
