/**
 * Migration 004 — meal_templates.name.
 *
 * A saved meal carried no human label, so the re-log picker read "N items · date"
 * (quirk 19). FoodItem now persists a `description`, and a template gets a readable
 * `name` (its meal description, or its items' names joined). This adds the nullable
 * column to hold it — additive and forward-compatible: existing rows get NULL and
 * fall back to their item names at display time. (Append-only; never edit a shipped
 * migration — data-model.md.)
 */
import type { Migration } from './index';

export const migration004: Migration = {
  version: 4,
  name: 'meal_template_name',
  sql: `
    ALTER TABLE meal_templates ADD COLUMN name TEXT;
  `,
};
