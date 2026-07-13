/**
 * Migration 018 — benchmark_groups (Phase 4 P4-3 / B4, benchmarks-templates.md
 * §4 "obvious call": relational facts, not a settings-KV blob).
 *
 * `benchmark_groups` is the group itself, `paused` its per-group toggle
 * (pausing drops members from Home/Reflect framing — @/hooks/useBenchmarkStatuses,
 * @/hooks/useBenchmarkReflect — without touching any member benchmark's own
 * lifecycle status). `benchmark_group_members` is the many-to-many join; no
 * FK constraints (no other table in this schema uses them — cascade on delete
 * is the storage layer's job, matching observations.ts/gear.ts convention).
 */
import type { Migration } from './index';

export const migration018: Migration = {
  version: 18,
  name: 'benchmark_groups',
  sql: `
    CREATE TABLE IF NOT EXISTS benchmark_groups (
      id        TEXT PRIMARY KEY NOT NULL,
      createdAt TEXT NOT NULL,
      title     TEXT NOT NULL,
      paused    INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS benchmark_group_members (
      groupId     TEXT NOT NULL,
      benchmarkId TEXT NOT NULL,
      PRIMARY KEY (groupId, benchmarkId)
    );
  `,
};
