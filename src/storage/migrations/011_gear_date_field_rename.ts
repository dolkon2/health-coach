/**
 * Migration 011 — rename gear's date columns (dimension/earth).
 *
 * Cross-branch reconciliation (2026-07-08) settled on `acquiredOn`/`retiredOn`
 * for gear's date-only fields (a gear acquire/retire is a LocalDate, not an
 * instant — "On" matches the codebase's date-vs-instant naming convention,
 * and it's what the water branch already shipped). Migration 010 already
 * created the `gear` table with `acquiredAt`/`retiredAt`, and that SQL is
 * never hand-edited once shipped — so the rename is a follow-up ALTER rather
 * than a rewrite of 010.
 */
import type { Migration } from './index';

export const migration011: Migration = {
  version: 11,
  name: 'gear_date_field_rename',
  sql: `
    ALTER TABLE gear RENAME COLUMN acquiredAt TO acquiredOn;
    ALTER TABLE gear RENAME COLUMN retiredAt TO retiredOn;
  `,
};
