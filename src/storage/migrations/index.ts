/**
 * The ordered migration registry. Append new migrations here with the next
 * version number — never edit a shipped migration (data-model.md: "Migrations
 * matter from day one… don't hand-edit").
 */
import { migration001 } from './001_initial';

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const migrations: Migration[] = [migration001];
