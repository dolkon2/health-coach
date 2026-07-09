/**
 * Migration 010 — gear, kits, spots (Water dimension).
 *
 * Three small entity tables backing the quiver/kit/spot primitives
 * (core/src/gear.ts, core/src/spot.ts). `spec` and `gear_ids` are JSON TEXT
 * columns — the flat category-keyed GearSpec and the kit's gear-id list ride
 * whole, so shapes can evolve without DDL.
 *
 * Cross-branch reconciliation (2026-07-08): the original "Water=010,
 * Earth=011, Sky=012, Body=013" contract didn't hold in practice — earth and
 * sky each independently shipped their own migration 010 too. Real
 * migration-number renumbering happens at actual merge time (rewriting an
 * already-applied migration's SQL would silently miss already-migrated
 * devices, since the runner tracks applied versions by number, not content).
 * This reconciliation pass instead aligned the TypeScript shapes across
 * branches — water's `category` (top-level), `acquiredOn`/`retiredOn` naming,
 * and `Kit` all won as the cross-branch convention; earth and sky ported
 * onto them. `spot.ts`'s shape (typed columns here vs. sky's flexible
 * kind+meta bag) is intentionally left unreconciled — deferred to the real
 * merge, given Water's spot-picker UI is still under active revision.
 * CREATE TABLE IF NOT EXISTS remains the defensive belt for whatever merge
 * ordering actually happens.
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
