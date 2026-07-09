/**
 * Migration 010 — gear table (quiver entity).
 *
 * Gear items are NOT Observations — a wing is a possession, not an event —
 * so they live in their own table like benchmarks and templates.
 *
 * `spec` is JSON text (same trick `observations.payload` uses) — bespoke
 * per-category fields, parsed by the storage serializer. `category` is its
 * own column, written straight from the GearItem's top-level `category`
 * field.
 *
 * Retirement is a soft state: `retiredAt` set, row kept — a retired wing's
 * history is still real. The index on `retiredAt` serves the default
 * active-only listing (retiredAt IS NULL).
 *
 * Cross-branch reconciliation (2026-07-08): this SQL is unchanged (never
 * hand-edit a shipped migration) even though two things about gear evolved
 * since it shipped — `category` moved from nested-in-spec to top-level
 * (an application-level JSON shape change inside the `spec` column, not a
 * schema change), and 'wing' was renamed to 'paraglider' at the TypeScript
 * level (water's gear uses 'wing' for a different, wind-sport entity — see
 * core/src/gear.ts). The `acquiredAt`/`retiredAt` column names below are
 * also stale post-reconciliation (earth/water use `acquiredOn`/`retiredOn`);
 * migration 013 renames them via ALTER rather than editing this file.
 */
import type { Migration } from './index';

export const migration010: Migration = {
  version: 10,
  name: 'gear',
  sql: `
    CREATE TABLE IF NOT EXISTS gear (
      id          TEXT PRIMARY KEY NOT NULL,
      category    TEXT NOT NULL,
      name        TEXT NOT NULL,
      spec        TEXT NOT NULL,
      acquiredAt  TEXT,
      retiredAt   TEXT,
      notes       TEXT,
      createdAt   TEXT NOT NULL,
      updatedAt   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_gear_category
      ON gear (category);
    CREATE INDEX IF NOT EXISTS idx_gear_retiredAt
      ON gear (retiredAt);
  `,
};
