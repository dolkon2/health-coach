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

// ─── Workout-scope re-permission nudge (Water pass) ─────────────────────────
// reader.requestPermissions() gained four workout read scopes AFTER users may
// have already connected — and a connected user never re-runs connect(), so
// they'd never see the new permission sheet. useWearableSync re-requests ONCE
// when this key is absent, then stamps the request time here. A timestamp
// (not a boolean) so a future scope addition can compare against a cutoff.

const K_WORKOUT_PERMS_REQUESTED_AT = 'workoutPermsRequestedAt';

export async function getWorkoutPermsRequestedAt(db?: SqlDatabase): Promise<string | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<{ value: string }>(
    'SELECT value FROM wearable_state WHERE key = ?;',
    [K_WORKOUT_PERMS_REQUESTED_AT]
  );
  return row?.value ?? null;
}

export async function setWorkoutPermsRequestedAt(
  value: string,
  db?: SqlDatabase
): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT INTO wearable_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [K_WORKOUT_PERMS_REQUESTED_AT, value]
  );
}
