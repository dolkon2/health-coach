/**
 * useBodyProfile — the persisted body stats (settings store, migration 009).
 *
 * `profile` is null until the user sets it — the baseline-TDEE surface renders
 * its honest empty state on null; nothing defaults a person into existence.
 */
import { useCallback, useEffect, useState } from 'react';
import type { BodyProfile } from '@/lib/bodyProfile';
import { getBodyProfile, setBodyProfile } from '@/storage/settings';

type UseBodyProfile = {
  profile: BodyProfile | null;
  loading: boolean;
  error: Error | null;
  save: (profile: BodyProfile) => Promise<void>;
  reload: () => void;
};

export function useBodyProfile(): UseBodyProfile {
  const [profile, setProfile] = useState<BodyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    getBodyProfile()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  const save = useCallback(async (p: BodyProfile) => {
    await setBodyProfile(p);
    setProfile(p);
  }, []);

  return { profile, loading, error, save, reload };
}
