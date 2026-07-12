/**
 * Migration 017 — recording_buffer (Map Record M2, map-tab.md §4).
 *
 * The crash-safe GPS recording buffer: while a recording runs, the background
 * location task appends every fix that passes the capture sanity gate here —
 * "SQLite is the recording, React state a cache" (gps-recording-expo.md §8).
 * On save the buffer is summarized into an ordinary session Observation and
 * cleared; on relaunch a row with status 'active' is the recovery marker that
 * drives the "finish the partial session" banner.
 *
 * ⚠️ Version 017, not 016 — 016 is reserved for the routes table
 * (routes-spec P1, Session 9). 010–013 remain burned; gaps are safe, the
 * runner applies by version number.
 *
 * Store raw, derive clean (research §5): points keep accuracy/speed so the
 * M3 honesty stats can be derived at read time; the gate's drop counters live
 * on the session row so nothing is discarded silently.
 */
import type { Migration } from './index';

export const migration017: Migration = {
  version: 17,
  name: 'recording_buffer',
  sql: `
    CREATE TABLE IF NOT EXISTS recording_sessions (
      id                  TEXT PRIMARY KEY NOT NULL,
      activityId          TEXT NOT NULL,
      element             TEXT NOT NULL,
      startedAt           TEXT NOT NULL,
      status              TEXT NOT NULL,
      droppedLowAccuracy  INTEGER NOT NULL DEFAULT 0,
      droppedTsRegression INTEGER NOT NULL DEFAULT 0,
      mockedCount         INTEGER NOT NULL DEFAULT 0,
      meta                TEXT
    );
    CREATE TABLE IF NOT EXISTS recording_points (
      recordingId TEXT NOT NULL,
      seq         INTEGER NOT NULL,
      lat         REAL NOT NULL,
      lng         REAL NOT NULL,
      tsSec       INTEGER NOT NULL,
      eleM        REAL,
      eleSource   TEXT,
      accuracy    REAL,
      speed       REAL,
      mocked      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (recordingId, seq)
    );
  `,
};
