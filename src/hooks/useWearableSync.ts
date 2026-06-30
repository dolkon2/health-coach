/**
 * useWearableSync — drives the HealthKit poll-on-open + first-connect backfill.
 *
 * Today's render uses this to decide whether to show the "Connect Apple Health"
 * CTA (when !connected) or the auto-imported steps/sleep cards (when connected).
 * The hook exposes `connect()` for the CTA's onPress and `syncNow()` for the
 * focus effect.
 *
 * Background sync is OUT OF SCOPE. Poll-on-open only — see
 * planning/wearable-ingestion-spec.md § "Background sync is the engagement knob".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getWearableSource } from '@/lib/healthkit';
import { runBackfill, runDailyPoll } from '@/lib/healthkit/ingest';
import { readState, setConnected as persistConnected } from '@/lib/healthkit/state';

const POLL_THROTTLE_MS = 60_000;

type WearableSync = {
  connected: boolean;
  syncing: boolean;
  lastError: Error | null;
  connect: () => Promise<void>;
  syncNow: () => Promise<void>;
};

export function useWearableSync(onChange?: () => void): WearableSync {
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const lastPollAt = useRef<number>(0);
  const syncLock = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Hydrate the connected flag once.
  useEffect(() => {
    let cancelled = false;
    readState()
      .then((s) => {
        if (!cancelled) setConnected(s.connected);
      })
      .catch((e) => {
        if (!cancelled) setLastError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    if (syncLock.current) return;
    syncLock.current = true;
    setSyncing(true);
    setLastError(null);
    try {
      const reader = getWearableSource();
      await reader.requestPermissions();
      await persistConnected(true);
      setConnected(true);
      const state = await readState();
      if (state.backfillDone) {
        await runDailyPoll(reader);
      } else {
        await runBackfill(reader);
      }
      lastPollAt.current = Date.now();
      onChangeRef.current?.();
    } catch (e) {
      setLastError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!connected) return;
    if (Date.now() - lastPollAt.current < POLL_THROTTLE_MS) return;
    if (syncLock.current) return;
    // Stamp the throttle and take the lock immediately, before any await, so
    // concurrent focus events (Today fires reload + trend + sync together)
    // don't race a second backfill into the same SQLite connection mid-write.
    lastPollAt.current = Date.now();
    syncLock.current = true;
    setSyncing(true);
    setLastError(null);
    try {
      const reader = getWearableSource();
      const state = await readState();
      if (!state.backfillDone) {
        await runBackfill(reader);
      } else {
        await runDailyPoll(reader);
      }
      onChangeRef.current?.();
    } catch (e) {
      // Reset the throttle so the next focus retries rather than waiting out
      // the full window after a transient failure.
      lastPollAt.current = 0;
      setLastError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, [connected]);

  return { connected, syncing, lastError, connect, syncNow };
}
