/**
 * Migration 005 — session_templates table.
 *
 * Saved training shapes (Phase 6 Pass 1). Templates are NOT Observations —
 * they have no `occurredAt`, no fidelity, no tier. They live in their own
 * table like benchmarks and meal templates.
 *
 * `shape` is JSON text (same trick `observations.payload` uses) — surface-
 * specific target fields, parsed by the storage serializer.
 *
 * `dayAssignment` and `isActive` are recorded now but only consumed by
 * Pass 4 (auto-populate active templates onto new weeks).
 *
 * Numbered 005 because main already shipped 002–004 for the nutrition
 * pipeline (cached_foods, meal_templates, meal_template_name) by the
 * time this branch merged.
 */
import type { Migration } from './index';

export const migration005: Migration = {
  version: 5,
  name: 'session_templates',
  sql: `
    CREATE TABLE IF NOT EXISTS session_templates (
      id              TEXT PRIMARY KEY NOT NULL,
      name            TEXT NOT NULL,
      surface         TEXT NOT NULL,
      activity        TEXT NOT NULL,
      shape           TEXT NOT NULL,
      dayAssignment   INTEGER,
      isActive        INTEGER NOT NULL,
      createdAt       TEXT NOT NULL,
      updatedAt       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_session_templates_surface
      ON session_templates (surface);
    CREATE INDEX IF NOT EXISTS idx_session_templates_isActive
      ON session_templates (isActive);
  `,
};
