/**
 * Settings-store round-trip tests (expenditure build, Pass B).
 *
 * Real SQL via better-sqlite3 in-memory — exercises migration 009, the JSON
 * key/value accessors, and the body-profile tenant. House rule: real DB,
 * never a mock. Proof: absent → null (the honest empty state), write → read
 * is identity, overwrite wins, corrupt JSON degrades to null rather than a
 * guess.
 */
import { describe, it, expect } from '@jest/globals';
import { runMigrations } from '../db';
import { makeTestDb } from './sqliteTestDb';
import {
  getSettingJson,
  setSettingJson,
  getBodyProfile,
  setBodyProfile,
} from '../settings';
import type { BodyProfile } from '@/lib/bodyProfile';

const PROFILE: BodyProfile = {
  heightCm: 180,
  birthYear: 1996,
  sex: 'male',
  bodyFatPct: 18.5,
  activityLevel: 'moderate',
};

describe('settings key/value store', () => {
  it('returns null for a key never written (absent, not defaulted)', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    expect(await getSettingJson('nope', db)).toBeNull();
    expect(await getBodyProfile(db)).toBeNull();
  });

  it('round-trips the body profile and overwrites in place', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await setBodyProfile(PROFILE, db);
    expect(await getBodyProfile(db)).toEqual(PROFILE);

    const updated: BodyProfile = { ...PROFILE, activityLevel: 'active' };
    delete (updated as { bodyFatPct?: number }).bodyFatPct;
    await setBodyProfile(updated, db);
    const back = await getBodyProfile(db);
    expect(back?.activityLevel).toBe('active');
    expect(back && 'bodyFatPct' in back).toBe(false); // shed field stays shed
  });

  it('degrades corrupt JSON to null instead of guessing', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await db.runAsync(`INSERT INTO settings (key, value) VALUES ('bodyProfile', 'not json');`);
    expect(await getBodyProfile(db)).toBeNull();
  });
});
