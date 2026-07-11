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
  getAppSettings,
  setAppSettings,
} from '../settings';
import type { BodyProfile } from '@/lib/bodyProfile';
import { DEFAULT_SETTINGS } from '@/lib/appSettings';

const PROFILE: BodyProfile = {
  heightCm: 180,
  birthYear: 1996,
  sex: 'male',
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
    await setBodyProfile(updated, db);
    const back = await getBodyProfile(db);
    expect(back?.activityLevel).toBe('active');
  });

  it('degrades corrupt JSON to null instead of guessing', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await db.runAsync(`INSERT INTO settings (key, value) VALUES ('bodyProfile', 'not json');`);
    expect(await getBodyProfile(db)).toBeNull();
  });
});

describe('app settings tenant', () => {
  it('returns null until a setting is changed (defaults live in the hook, not storage)', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    expect(await getAppSettings(db)).toBeNull();
  });

  it('round-trips the full blob and overwrites in place', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await setAppSettings(DEFAULT_SETTINGS, db);
    expect(await getAppSettings(db)).toEqual(DEFAULT_SETTINGS);

    const next = { ...DEFAULT_SETTINGS, weightUnit: 'kg', distanceUnit: 'mi' } as const;
    await setAppSettings(next, db);
    expect(await getAppSettings(db)).toEqual(next);
  });

  it('reads a partial blob back as-is — the hook merges defaults, storage does not', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    // A blob saved before a field existed: only weightUnit present.
    await db.runAsync(`INSERT INTO settings (key, value) VALUES ('appSettings', ?);`, [
      JSON.stringify({ weightUnit: 'kg' }),
    ]);
    expect(await getAppSettings(db)).toEqual({ weightUnit: 'kg' });
  });
});
