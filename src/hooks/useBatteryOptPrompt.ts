/**
 * useBatteryOptPrompt — the one-time Android battery-optimization ask
 * (map-tab.md ⚑2, answered YES by Dylan 2026-07-11; gps-recording-expo §8).
 *
 * OEM battery killers (the dontkillmyapp.com problem) can starve even a
 * foreground-service recording on aggressive Androids. The fix the OS offers
 * is an optimization exemption — but asking for it unprompted would be
 * engagement theater. The pull-not-push framing: this fires ONLY while the
 * user's own long recording is running (data said something: you record long
 * sessions, your phone may cut them short), once, ever. Declining is final —
 * the flag persists on the first showing, not on acceptance.
 *
 * Deep-links to the OS battery-optimization SETTINGS list (no permission
 * needed, Play-policy-clean) rather than the direct exemption request intent,
 * which needs REQUEST_IGNORE_BATTERY_OPTIMIZATIONS and Play review.
 *
 * iOS has no equivalent (and no equivalent problem class) — no-op there.
 */
import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { getSettingJson, setSettingJson } from '@/storage/settings';

/** "Long recording" threshold — a tunable judgment call (~20 min), not a
 *  spec'd number (flagged in the M2 dev log). */
export const BATTERY_PROMPT_AFTER_SEC = 20 * 60;

const K_SHOWN = 'batteryOptPromptShown';
const CHECK_MS = 30_000;

export function useBatteryOptPrompt(isTracking: boolean, startedAt: string | null): void {
  // Once per mount, independent of the persisted flag — even a failed
  // settings read can't re-fire the alert within one recording.
  const firedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isTracking || startedAt == null) return;
    const startMs = Date.parse(startedAt);
    if (!Number.isFinite(startMs)) return;
    let cancelled = false;

    const check = async () => {
      if (cancelled || firedRef.current) return;
      if (Date.now() - startMs < BATTERY_PROMPT_AFTER_SEC * 1000) return;
      firedRef.current = true;
      try {
        if (await getSettingJson<boolean>(K_SHOWN)) return;
        // Persist BEFORE showing: one ask, ever, whatever the answer.
        await setSettingJson(K_SHOWN, true);
      } catch {
        return; // can't read the flag → don't risk a repeat prompt
      }
      if (cancelled) return;
      Alert.alert(
        'Keep long recordings alive',
        'Some phones stop background apps to save battery, which can cut a long recording short. ' +
          'Excluding this app from battery optimization keeps GPS running until you stop the session.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Open battery settings',
            onPress: () => {
              Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(
                () => {}
              );
            },
          },
        ]
      );
    };

    void check();
    const t = setInterval(() => void check(), CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isTracking, startedAt]);
}
