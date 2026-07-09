/**
 * Migration 012 — conditions_snapshots table (conditions freeze).
 *
 * A snapshot is a captured-at-the-time fact — insert-only, never updated, so
 * there are no createdAt/updatedAt bookkeeping columns: capturedAt IS the
 * write time. `surface` and `aloft` are JSON text blocks (absent fields stay
 * absent, never zero-filled).
 *
 * The composite index serves the product query: "this site's history by day"
 * — compare today's freeze to previous days at the same spot.
 */
import type { Migration } from './index';

export const migration012: Migration = {
  version: 12,
  name: 'conditions',
  sql: `
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
  `,
};
