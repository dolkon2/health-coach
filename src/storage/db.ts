/**
 * db.ts — SQLite initialization + versioned migrations.
 *
 * The rest of the storage layer talks to a small `SqlDatabase` port, not to
 * expo-sqlite directly. The app backs it with expo-sqlite; tests back it with
 * an in-memory SQLite. This keeps storage testable and keeps the engine fully
 * decoupled — the engine never touches SQLite (constitution: architecture).
 */
import { migrations } from './migrations';

export type SqlParam = string | number | null;

/** The minimal SQLite surface the storage layer needs. */
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>; // one or more statements (DDL / migrations)
  runAsync(sql: string, params?: SqlParam[]): Promise<void>; // a single write
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
}

/**
 * Creates the migrations bookkeeping table, then applies any migrations whose
 * version hasn't been recorded yet, in order. Safe to run on every launch.
 */
export async function runMigrations(db: SqlDatabase): Promise<void> {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS migrations (
       version INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       appliedAt TEXT NOT NULL
     );`
  );

  const appliedRows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM migrations;'
  );
  const applied = new Set(appliedRows.map((r) => r.version));

  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    await db.execAsync(m.sql);
    await db.runAsync(
      'INSERT INTO migrations (version, name, appliedAt) VALUES (?, ?, ?);',
      [m.version, m.name, new Date().toISOString()]
    );
  }
}

// ─── App-side singleton (expo-sqlite) ───────────────────────────────────────
// expo-sqlite is imported dynamically inside getDb so that merely importing the
// storage layer (e.g. from a Node test) never loads the native module.

let dbPromise: Promise<SqlDatabase> | null = null;

export function getDb(): Promise<SqlDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQLite = await import('expo-sqlite');
      const raw = await SQLite.openDatabaseAsync('healthcoach.db');
      // WAL lets readers and the writer coexist (the Today screen reads while a
      // wearable backfill writes); busy_timeout makes any remaining contention
      // wait rather than throw SQLITE_BUSY ("database is locked").
      await raw.execAsync('PRAGMA journal_mode = WAL;');
      await raw.execAsync('PRAGMA busy_timeout = 5000;');
      const db: SqlDatabase = {
        execAsync: (sql) => raw.execAsync(sql),
        runAsync: async (sql, params = []) => {
          await raw.runAsync(sql, params);
        },
        getAllAsync: (sql, params = []) => raw.getAllAsync(sql, params),
        getFirstAsync: (sql, params = []) => raw.getFirstAsync(sql, params),
      };
      await runMigrations(db);
      return db;
    })();
  }
  return dbPromise;
}
