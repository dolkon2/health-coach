/**
 * useSettings — persisted app settings (settings store, key 'appSettings').
 *
 * A tiny module-level store, not a per-hook load: expo-router keeps the tabs
 * mounted, so a unit changed on the Settings screen has to re-render every
 * mounted caller. One shared snapshot + useSyncExternalStore does that without
 * a context provider to thread through the tree.
 *
 * Until the stored blob loads — and forever if nothing was ever saved — the
 * snapshot is DEFAULT_SETTINGS, the same values the pre-persistence stub
 * returned, so every existing `useSettings()` caller keeps working unchanged.
 * Persistence lives in the settings table (migration 009); the JSON accessors
 * follow the body-profile tenant (see storage/settings.ts).
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, withDefaults, type Settings } from '@/lib/appSettings';
import { getAppSettings, setAppSettings } from '@/storage/settings';

export type { Settings };

let snapshot: Settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();
let hydrated = false; // a stored read (or a user write) has settled the snapshot
let hydrating = false;

function emit(): void {
  for (const listener of listeners) listener();
}

// Load once, on the first subscriber. A user write before this settles flips
// `hydrated`, so the late read never clobbers a change the user just made.
function ensureHydrated(): void {
  if (hydrated || hydrating) return;
  hydrating = true;
  getAppSettings()
    .then((stored) => {
      if (!hydrated && stored != null) {
        snapshot = withDefaults(stored);
        emit();
      }
    })
    .catch(() => {
      // an unreadable store behaves as never-saved: defaults, never a crash
    })
    .finally(() => {
      hydrated = true;
      hydrating = false;
    });
}

function subscribe(listener: () => void): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current settings — same signature as the old stub; callers unchanged. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/**
 * Persist a partial change (e.g. `{ weightUnit: 'kg' }`). The snapshot updates
 * synchronously so the UI reflects it at once; the returned promise settles
 * when the write lands. The full blob is written — a partial stored value
 * merges back over the defaults on the next read (withDefaults).
 */
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  snapshot = { ...snapshot, ...patch };
  hydrated = true; // the user's write is the source of truth now
  emit();
  await setAppSettings(snapshot);
}

/** Hook form of {@link updateSettings}, for symmetry with useSettings(). */
export function useUpdateSettings(): (patch: Partial<Settings>) => Promise<void> {
  return updateSettings;
}
