/**
 * Migration 001 — initial schema.
 *
 * One generic `observations` table (the constitution's "everything is an
 * Observation" — never parallel tables per kind). `source` and `payload` are
 * JSON-encoded text columns. Indexes back the timeline queries the engine runs.
 *
 * Note: this is a `.ts` module exporting the SQL string rather than a raw `.sql`
 * file, because Metro can't import `.sql`. The SQL itself is plain SQLite DDL.
 */
import type { Migration } from './index';

export const migration001: Migration = {
  version: 1,
  name: 'initial',
  sql: `
    CREATE TABLE IF NOT EXISTS observations (
      id          TEXT PRIMARY KEY NOT NULL,
      kind        TEXT NOT NULL,
      occurredAt  TEXT NOT NULL,
      loggedAt    TEXT NOT NULL,
      tz          TEXT NOT NULL,
      tier        INTEGER NOT NULL,
      fidelity    REAL NOT NULL,
      source      TEXT NOT NULL,
      payload     TEXT NOT NULL,
      notes       TEXT,
      supersedes  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_observations_kind_occurredAt
      ON observations (kind, occurredAt);
    CREATE INDEX IF NOT EXISTS idx_observations_occurredAt
      ON observations (occurredAt);

    CREATE TABLE IF NOT EXISTS benchmarks (
      id                 TEXT PRIMARY KEY NOT NULL,
      createdAt          TEXT NOT NULL,
      resolvedAt         TEXT,
      status             TEXT NOT NULL,
      title              TEXT NOT NULL,
      description        TEXT,
      targetDate         TEXT,
      relatedModalities  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_benchmarks_status
      ON benchmarks (status);
  `,
};
