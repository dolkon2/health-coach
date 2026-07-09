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
import type { HkExportRecord, HkExportsBlob } from '@/lib/healthkitExports';

const K_BODY_PROFILE = 'bodyProfile';
const K_APP_SETTINGS = 'appSettings';
const K_USER_PROTOCOLS = 'userProtocols';
const K_HK_EXPORTS = 'hkExports';

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

/** Per-observation HealthKit export bookkeeping (Body P8 — see
 *  lib/healthkitExports.ts for why this rides the settings blob instead of
 *  a dedicated table). {} when nothing has ever been exported. */
export async function getHkExports(db?: SqlDatabase): Promise<HkExportsBlob> {
  return (await getSettingJson<HkExportsBlob>(K_HK_EXPORTS, db)) ?? {};
}

// setHkExportRecord/deleteHkExportRecord are read-modify-write against one
// shared JSON blob, not a row-level upsert. Every mutating call site
// (log-session.tsx save/edit, training.tsx + (tabs)/index.tsx delete) fires
// fire-and-forget, so two of these can legitimately overlap (e.g. saving one
// session while deleting another) — without serialization, the second
// call's read would miss the first call's not-yet-written update, silently
// losing one side's bookkeeping. Chaining every mutation through this single
// promise queue forces them to apply one at a time, in call order, same
// process — cheap since this is local SQLite on one device, not a
// distributed lock.
let hkExportsQueue: Promise<unknown> = Promise.resolve();
function serializeHkExportsWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = hkExportsQueue.then(fn, fn);
  hkExportsQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function setHkExportRecord(
  observationId: string,
  record: HkExportRecord,
  db?: SqlDatabase
): Promise<void> {
  await serializeHkExportsWrite(async () => {
    const all = await getHkExports(db);
    await setSettingJson(K_HK_EXPORTS, { ...all, [observationId]: record }, db);
  });
}

export async function deleteHkExportRecord(observationId: string, db?: SqlDatabase): Promise<void> {
  await serializeHkExportsWrite(async () => {
    const all = await getHkExports(db);
    if (!(observationId in all)) return;
    const { [observationId]: _removed, ...rest } = all;
    await setSettingJson(K_HK_EXPORTS, rest, db);
  });
}
