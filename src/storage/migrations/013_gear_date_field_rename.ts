/**
 * Migration 013 — rename gear's date columns (dimension/sky).
 *
 * Cross-branch reconciliation (2026-07-08) settled on `acquiredOn`/`retiredOn`
 * for gear's date-only fields (a gear acquire/retire is a LocalDate, not an
 * instant — matches earth and water). Migration 010 already created the
 * `gear` table with `acquiredAt`/`retiredAt`, and that SQL is never
 * hand-edited once shipped — so the rename is a follow-up ALTER. Numbered 013
 * (not 011) because this branch's own 011/012 (spots/conditions) already
 * exist; real cross-branch migration-number renumbering is a merge-time
 * concern this reconciliation pass didn't attempt (see 010_gear.ts and
 * water's 010_gear_kits_spots.ts for the full note).
 */
import type { Migration } from './index';

export const migration013: Migration = {
  version: 13,
  name: 'gear_date_field_rename',
  sql: `
    ALTER TABLE gear RENAME COLUMN acquiredAt TO acquiredOn;
    ALTER TABLE gear RENAME COLUMN retiredAt TO retiredOn;
  `,
};
