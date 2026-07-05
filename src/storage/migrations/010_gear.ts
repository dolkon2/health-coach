/**
 * Migration 010 — gear table (quiver entity).
 *
 * Gear items are NOT Observations — a wing is a possession, not an event —
 * so they live in their own table like benchmarks and templates.
 *
 * `spec` is JSON text (same trick `observations.payload` uses) — bespoke
 * per-category fields behind a `category` discriminator, parsed by the
 * storage serializer. The `category` column is a queryable copy of
 * `spec.category`, kept in sync by the storage layer on every write.
 *
 * Retirement is a soft state: `retiredAt` set, row kept — a retired wing's
 * history is still real. The index on `retiredAt` serves the default
 * active-only listing (retiredAt IS NULL).
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
