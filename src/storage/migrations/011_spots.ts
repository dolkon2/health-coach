/**
 * Migration 011 — spots table (Spot/place entity, cross-dimension).
 *
 * A spot is a named point on the map, not an Observation — no occurredAt, no
 * fidelity. `kind` is the free-string discriminator ('flying-site' for Sky;
 * other dimensions add their own at merge) and drives the only product query,
 * hence the index. `meta` is JSON text for dimension-specific facts (same
 * trick as gear.spec / observations.payload).
 */
import type { Migration } from './index';

export const migration011: Migration = {
  version: 11,
  name: 'spots',
  sql: `
    CREATE TABLE IF NOT EXISTS spots (
      id        TEXT PRIMARY KEY NOT NULL,
      name      TEXT NOT NULL,
      lat       REAL NOT NULL,
      lng       REAL NOT NULL,
      kind      TEXT NOT NULL,
      meta      TEXT,
      notes     TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_spots_kind
      ON spots (kind);
  `,
};
