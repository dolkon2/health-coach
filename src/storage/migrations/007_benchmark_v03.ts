/**
 * Migration 007 — benchmarks v0.3 (the goal layer).
 *
 * Extends the benchmarks table for benchmarks-spec.md v0.3: a benchmark now
 * resolves to a tracked dimension (`resolution`), behaves as one of two shapes
 * (`shape`: cadence | trend), and may be pinned to Today (`pinned`). `resolution`
 * and `shape` are JSON-encoded text columns (same pattern as observations.payload
 * and session_templates.shape); `pinned` is 0/1 like session_templates.isActive.
 *
 * Additive and forward-compatible: existing rows would get NULL, but the table
 * ships empty (no entry UI created benchmarks before v0.3), so there is nothing
 * to backfill. Semantically `resolution`/`shape` are required — the domain type
 * enforces it and every write provides them; SQLite simply can't add a NOT NULL
 * column without a default to an existing table. (Append-only; never edit a
 * shipped migration — data-model.md.)
 */
import type { Migration } from './index';

export const migration007: Migration = {
  version: 7,
  name: 'benchmark_v03',
  sql: `
    ALTER TABLE benchmarks ADD COLUMN resolution TEXT;
    ALTER TABLE benchmarks ADD COLUMN shape TEXT;
    ALTER TABLE benchmarks ADD COLUMN pinned INTEGER;
  `,
};
