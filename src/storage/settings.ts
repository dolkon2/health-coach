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

const K_BODY_PROFILE = 'bodyProfile';

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
