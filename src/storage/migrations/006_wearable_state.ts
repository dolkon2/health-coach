/**
 * Migration 006 — wearable_state.
 *
 * A tiny key/value table the HealthKit adapter uses to remember two flags
 * across launches: whether the user has tapped "Connect Apple Health" and
 * whether the one-time 3-month backfill has run. Lives in the existing
 * SQLite db so we don't pull in AsyncStorage just for two booleans.
 */
import type { Migration } from './index';

export const migration006: Migration = {
  version: 6,
  name: 'wearable_state',
  sql: `
    CREATE TABLE IF NOT EXISTS wearable_state (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `,
};
