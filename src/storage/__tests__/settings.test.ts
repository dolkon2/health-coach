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
  getUserProtocols,
  setUserProtocols,
} from '../settings';
import { activeProtocols, type UserProtocol } from '@/lib/protocols';
import type { BodyProfile } from '@/lib/bodyProfile';
import { DEFAULT_SETTINGS } from '@/lib/appSettings';

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

describe('user protocols tenant (Body P1b)', () => {
  const PROTO: UserProtocol = {
    id: 'proto-1',
    name: 'Knee routine from Sarah',
    createdAt: '2026-07-05T16:00:00Z',
    exercises: [
      { id: 'ex-1', name: 'clamshells 3x15 each side', targetPerWeek: 4 },
      { id: 'ex-2', name: 'step-downs 3x10', targetPerWeek: 3 },
    ],
  };

  it('reads [] when nothing is stored — zero protocols is a fact, not null', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    expect(await getUserProtocols(db)).toEqual([]);
  });

  it('round-trips protocols and keeps archived ones (archived, never deleted)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await setUserProtocols([PROTO], db);
    expect(await getUserProtocols(db)).toEqual([PROTO]);

    const archived: UserProtocol = { ...PROTO, archivedAt: '2026-08-01T00:00:00Z' };
    await setUserProtocols([archived], db);
    const back = await getUserProtocols(db);
    expect(back).toHaveLength(1); // still stored
    expect(back[0].archivedAt).toBe('2026-08-01T00:00:00Z');
    expect(activeProtocols(back)).toEqual([]); // but out of the daily list
  });
});
