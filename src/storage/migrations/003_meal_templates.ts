/**
 * Migration 003 — meal_templates.
 *
 * A saved meal *definition* (the user's "save this meal"), modeled on the
 * benchmarks table — it has no `occurredAt`; it is a definition, not a timeline
 * event. Stores only the canonical items + whether the user confirmed it.
 *
 * Deliberately NO earned_fidelity column and NO occurrences column: earned
 * fidelity is engine-derived (Phase 7), and occurrences are a *query* over the
 * foodEntry observations carrying this template's id — never a stored counter a
 * re-log could inflate (food-logging-spec.md § Earned fidelity, plan § 4).
 *
 * Sharing/privacy (Ring 4 forward-ref): kept additive-friendly like observations
 * and benchmarks — a future visibility scope is an additive migration + a
 * permissions join, not a reshape of this table.
 */
import type { Migration } from './index';

export const migration003: Migration = {
  version: 3,
  name: 'meal_templates',
  sql: `
    CREATE TABLE IF NOT EXISTS meal_templates (
      id             TEXT PRIMARY KEY NOT NULL,
      createdAt      TEXT NOT NULL,
      userConfirmed  INTEGER NOT NULL,
      canonicalItems TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_meal_templates_createdAt
      ON meal_templates (createdAt);
  `,
};
