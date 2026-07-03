/**
 * Migration 009 — settings.
 *
 * A generic key/value table for user settings (the wearable_state pattern,
 * generalized). First tenant: the body profile (expenditure build, Pass B) —
 * height / birth year / sex / optional bodyfat / activity level, stored as one
 * JSON value so the shape can evolve without DDL. Future tenants: units,
 * nutrition focus, rest timer — the useSettings stub's real home.
 */
import type { Migration } from './index';

export const migration009: Migration = {
  version: 9,
  name: 'settings',
  sql: `
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `,
};
