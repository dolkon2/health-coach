/**
 * useRestTimer — a between-sets rest countdown that auto-starts when the user
 * marks a set done, shows the remaining time in-app (RestTimer), and fires a local
 * notification when the rest elapses so they're alerted even with the phone down.
 *
 * Foreground feedback is the in-app banner; the scheduled notification covers the
 * backgrounded / phone-down case (the usual rest posture). All Notifications calls
 * are best-effort and never throw into the UI — a denied permission just means no
 * buzz, the on-screen countdown still runs.
 *
 * Pure countdown math lives in lib/restTimer.ts (and is unit-tested); this file is
 * the thin React + expo-notifications shell, verified by tsc.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { restRemainingSec, type RestTimerState } from '@/lib/restTimer';

export type RestTimerController = {
  /** Whole seconds left, or null when idle. The banner shows while > 0. */
  remainingSec: number | null;
  /** Begin (or restart) a rest of `durationSec`. */
  start: (durationSec: number) => void;
  /** Cancel the rest early (skip). */
  stop: () => void;
};

async function ensurePermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export function useRestTimer(): RestTimerController {
  const [state, setState] = useState<RestTimerState | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const notifId = useRef<string | null>(null);

  const cancelNotif = useCallback(() => {
    if (notifId.current) {
      Notifications.cancelScheduledNotificationAsync(notifId.current).catch(() => {});
      notifId.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cancelNotif();
    setState(null);
    setRemainingSec(null);
  }, [cancelNotif]);

  const start = useCallback(
    (durationSec: number) => {
      cancelNotif();
      const seconds = Math.max(1, Math.round(durationSec));
      setState({ startedAtMs: Date.now(), durationSec: seconds });
      setRemainingSec(seconds);
      ensurePermission()
        .then((granted) => {
          if (!granted) return undefined;
          return Notifications.scheduleNotificationAsync({
            content: { title: 'Rest complete', body: 'Ready for your next set.' },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds,
              repeats: false,
            },
          });
        })
        .then((id) => {
          if (typeof id === 'string') notifId.current = id;
        })
        .catch(() => {});
    },
    [cancelNotif]
  );

  // Tick the on-screen countdown; stop the interval (and forget the fired
  // notification) once it reaches zero.
  useEffect(() => {
    if (!state) return;
    const tick = () => {
      const rem = restRemainingSec(state, Date.now());
      setRemainingSec(rem);
      return rem;
    };
    if (tick() <= 0) {
      notifId.current = null;
      return;
    }
    const interval = setInterval(() => {
      if (tick() <= 0) {
        notifId.current = null;
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [state]);

  // Best-effort cleanup if the screen unmounts mid-rest.
  useEffect(() => cancelNotif, [cancelNotif]);

  return { remainingSec, start, stop };
}
