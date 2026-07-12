/**
 * Migration 016 — routes (routes-spec P1, Session 9; reserved for this slot
 * since migration 017's header — see 017_recording_buffer.ts).
 *
 * A Route is a reusable named line, distinct from a Session's timestamped
 * `gpsPath`/`track` — no `startedAt`/`tsSec` column here by design (a plan
 * has no "when"). `points` is JSON `RoutePoint[]` (core/src/route.ts):
 * personal-scale storage, no spatial index needed (map-tab.md §4 / research
 * routes-implementation.md §3 "Storage").
 */
import type { Migration } from './index';

export const migration016: Migration = {
  version: 16,
  name: 'routes',
  sql: `
    CREATE TABLE IF NOT EXISTS routes (
      id          TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      activityId  TEXT NOT NULL,
      source      TEXT NOT NULL,
      points      TEXT NOT NULL,
      visibility  TEXT NOT NULL DEFAULT 'private',
      notes       TEXT,
      createdAt   TEXT NOT NULL,
      updatedAt   TEXT NOT NULL
    );
  `,
};
