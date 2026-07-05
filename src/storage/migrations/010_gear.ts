/**
 * Migration 010 — gear (the quiver entity, dimension/earth Pass E1).
 *
 * Gear rows are user-declared facts, NOT Observations — no occurredAt, no
 * fidelity, no tier (like benchmarks and templates). `spec` is JSON text (the
 * `observations.payload` trick) so per-category blocks — targetKm, component
 * service intervals, ski day marks — evolve without DDL as other dimensions
 * extend the category union on their branches.
 *
 * Deliberately NO mileage/odometer column: accrual is derived-on-read from the
 * sessions tagging the gear (⚑ E-4) — a stored total could drift from the
 * timeline it summarizes. `parentId` links a component to its bike; `retiredAt`
 * is set on retire (never a delete — retired gear keeps the history it earned).
 *
 * Numbered 010: this branch reserves 010–012 (⚑ E-11); sky/water/body
 * coordinate their numbers before merging to main.
 */
import type { Migration } from './index';

export const migration010: Migration = {
  version: 10,
  name: 'gear',
  sql: `
    CREATE TABLE IF NOT EXISTS gear (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      parentId    TEXT,
      acquiredAt  TEXT,
      retiredAt   TEXT,
      spec        TEXT,
      notes       TEXT,
      createdAt   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_gear_category
      ON gear (category);
  `,
};
