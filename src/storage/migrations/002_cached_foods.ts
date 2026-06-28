/**
 * Migration 002 — cached_foods.
 *
 * A local cache of foods the user has looked up, keyed by their source identity
 * (sourceDb + foodId — the same pair that becomes ObservationSource.foodapi).
 * It stores the original source response (`raw`) so a repeat lookup re-hydrates
 * through the Pass 2.2 adapter at any quantity without a second network call,
 * and so logging works offline. `lastUsedAt` backs recently-used ranking.
 *
 * This is public food-database data, not user content — no sharing/privacy
 * scoping needed here (that concern lives on meal logs + templates, Pass 2.4).
 */
import type { Migration } from './index';

export const migration002: Migration = {
  version: 2,
  name: 'cached_foods',
  sql: `
    CREATE TABLE IF NOT EXISTS cached_foods (
      sourceDb    TEXT NOT NULL,
      foodId      TEXT NOT NULL,
      description TEXT NOT NULL,
      raw         TEXT NOT NULL,
      lastUsedAt  TEXT NOT NULL,
      PRIMARY KEY (sourceDb, foodId)
    );

    CREATE INDEX IF NOT EXISTS idx_cached_foods_lastUsedAt
      ON cached_foods (lastUsedAt);
  `,
};
