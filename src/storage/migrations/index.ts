/**
 * The ordered migration registry. Append new migrations here with the next
 * version number — never edit a shipped migration (data-model.md: "Migrations
 * matter from day one… don't hand-edit").
 *
 * ⚠️ Versions 010–013 are BURNED — permanently unregistered (2026-07-09
 * dimension merge). Earth, Sky, and Water each shipped their own migrations
 * under those numbers on parallel branches (Earth: 010 gear + 011 rename ·
 * Water: 010 gear/kits/spots · Sky: 010 gear, 011 spots, 012 conditions,
 * 013 rename), so the same version number means a different schema depending
 * on which branch a device ran. The runner tracks applied migrations by
 * version number alone, so those numbers can never safely carry content
 * again — on some devices they'd be skipped, on others they'd collide.
 * The registry therefore jumps 009 → 014. Migration 014 introspects whatever
 * legacy shape a device actually has (any branch's, or none) and converges
 * it to the canonical schema. The 010–013 files are kept on disk as the
 * historical record of what branch devices ran — do NOT re-register them.
 */
import { migration001 } from './001_initial';
import { migration002 } from './002_cached_foods';
import { migration003 } from './003_meal_templates';
import { migration004 } from './004_meal_template_name';
import { migration005 } from './005_session_templates';
import { migration006 } from './006_wearable_state';
import { migration007 } from './007_benchmark_v03';
import { migration008 } from './008_benchmark_faces';
import { migration009 } from './009_settings';
import { migration014 } from './014_dimension_unify';
import { migration015 } from './015_spots_sport';

// Minimal structural type to avoid a circular import with db.ts (which
// imports `migrations` from here). SqlDatabase satisfies this.
export type MigrationDb = {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, params?: (string | number | null)[]): Promise<T[]>;
  runAsync(sql: string, params?: (string | number | null)[]): Promise<void>;
};

export type Migration = {
  version: number;
  name: string;
  /** Plain-SQL migration — the default shape. */
  sql?: string;
  /**
   * Code migration — for the rare case where the right DDL depends on the
   * device's existing schema (added for 014, the dimension-merge unifier,
   * which must converge four different legacy shapes). Exactly one of
   * `sql`/`run` must be set.
   */
  run?: (db: MigrationDb) => Promise<void>;
};

export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration014,
  migration015,
];
