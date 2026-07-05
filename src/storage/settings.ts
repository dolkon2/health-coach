/**
 * settings.ts — the key/value settings store (migration 009).
 *
 * Values are JSON under stable string keys. Typed accessors per tenant live
 * here so callers never touch raw keys. First tenant: the body profile —
 * read by the baseline-TDEE surface, absent until the user sets it (the
 * honest empty state; nothing is defaulted into existence).
 *
 * Tests pass an injected `SqlDatabase`; the app falls through to the singleton.
 */
import { getDb, type SqlDatabase } from './db';
import type { BodyProfile } from '@/lib/bodyProfile';
import type { Settings } from '@/lib/appSettings';
import type { UserProtocol, UserProtocolsBlob } from '@/lib/protocols';

const K_BODY_PROFILE = 'bodyProfile';
const K_APP_SETTINGS = 'appSettings';
const K_USER_PROTOCOLS = 'userProtocols';

export async function getSettingJson<T>(key: string, db?: SqlDatabase): Promise<T | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?;',
    [key]
  );
  if (row == null) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null; // an unreadable value is honestly absent, never a guess
  }
}

export async function setSettingJson(key: string, value: unknown, db?: SqlDatabase): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, JSON.stringify(value)]
  );
}

/** Null until the user has set their body stats — the surface renders its
 *  honest empty state on null, never a fabricated default person. */
export async function getBodyProfile(db?: SqlDatabase): Promise<BodyProfile | null> {
  return getSettingJson<BodyProfile>(K_BODY_PROFILE, db);
}

export async function setBodyProfile(profile: BodyProfile, db?: SqlDatabase): Promise<void> {
  await setSettingJson(K_BODY_PROFILE, profile, db);
}

/** Null until the user has changed a setting — the hook renders DEFAULT_SETTINGS
 *  on null. The stored blob may be a subset of Settings (saved before a field
 *  existed), so it comes back as Partial and the hook merges over defaults. */
export async function getAppSettings(db?: SqlDatabase): Promise<Partial<Settings> | null> {
  return getSettingJson<Partial<Settings>>(K_APP_SETTINGS, db);
}

export async function setAppSettings(settings: Settings, db?: SqlDatabase): Promise<void> {
  await setSettingJson(K_APP_SETTINGS, settings, db);
}

/** The user's own recorded plans ("My plan" — lib/protocols.ts). Returns [] when
 *  none exist: having zero protocols is a fact, not a fabricated default, so
 *  this tenant honestly reads as an empty list rather than null. Archived
 *  protocols stay in the blob (archivedAt) — never deleted. */
export async function getUserProtocols(db?: SqlDatabase): Promise<UserProtocol[]> {
  const blob = await getSettingJson<UserProtocolsBlob>(K_USER_PROTOCOLS, db);
  return blob?.protocols ?? [];
}

export async function setUserProtocols(
  protocols: UserProtocol[],
  db?: SqlDatabase
): Promise<void> {
  await setSettingJson(K_USER_PROTOCOLS, { protocols }, db);
}
