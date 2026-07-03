/**
 * The ordered migration registry. Append new migrations here with the next
 * version number — never edit a shipped migration (data-model.md: "Migrations
 * matter from day one… don't hand-edit").
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

export type Migration = {
  version: number;
  name: string;
  sql: string;
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
];
