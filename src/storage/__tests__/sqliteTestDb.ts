/**
 * An in-memory SQLite implementation of the SqlDatabase port, backed by
 * better-sqlite3. Lets storage tests run real SQL (real migrations, real
 * queries) in Node — a genuine round-trip, not a mock.
 */
import Database from 'better-sqlite3';
import type { SqlDatabase, SqlParam } from '../db';

export function makeTestDb(): SqlDatabase {
  const db = new Database(':memory:');
  return {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, params: SqlParam[] = []) => {
      db.prepare(sql).run(...params);
    },
    getAllAsync: async <T>(sql: string, params: SqlParam[] = []) => {
      return db.prepare(sql).all(...params) as T[];
    },
    getFirstAsync: async <T>(sql: string, params: SqlParam[] = []) => {
      return (db.prepare(sql).get(...params) as T) ?? null;
    },
  };
}
