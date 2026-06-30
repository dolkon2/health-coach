/**
 * state.ts — persistent flags for the HealthKit adapter.
 *
 * Two booleans, persisted in the existing SQLite db (migration 005):
 *   - connected:    user has tapped "Connect Apple Health" at least once.
 *                   HealthKit deliberately won't tell us *what* was granted
 *                   (Apple privacy), so this flag tracks *intent* — once true,
 *                   we just attempt reads and surface whatever comes back.
 *   - backfillDone: the one-time trailing-90-day import has finished.
 *
 * Tests pass an injected `SqlDatabase`; the app falls through to the singleton.
 */
import { getDb, type SqlDatabase } from '@/storage/db';

const K_CONNECTED = 'connected';
const K_BACKFILL_DONE = 'backfillDone';

export type WearableConnectionState = {
  connected: boolean;
  backfillDone: boolean;
};

async function getFlag(key: string, db: SqlDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM wearable_state WHERE key = ?;',
    [key]
  );
  return row?.value === '1';
}

async function setFlag(key: string, value: boolean, db: SqlDatabase): Promise<void> {
  await db.runAsync(
    `INSERT INTO wearable_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value ? '1' : '0']
  );
}

export async function readState(db?: SqlDatabase): Promise<WearableConnectionState> {
  const d = db ?? (await getDb());
  return {
    connected: await getFlag(K_CONNECTED, d),
    backfillDone: await getFlag(K_BACKFILL_DONE, d),
  };
}

export async function setConnected(value: boolean, db?: SqlDatabase): Promise<void> {
  const d = db ?? (await getDb());
  await setFlag(K_CONNECTED, value, d);
}

export async function setBackfillDone(value: boolean, db?: SqlDatabase): Promise<void> {
  const d = db ?? (await getDb());
  await setFlag(K_BACKFILL_DONE, value, d);
}
