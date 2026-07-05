/**
 * useGpsTracker — a foreground GPS recorder for the live-capture path
 * (gps-mapping-spec.md rung 2). Wraps expo-location's watchPositionAsync into a
 * start/stop tracker that accumulates the GeoPoint[] the GPS logging surface
 * already understands (the exact shape a GPX import produces).
 *
 * expo-location is loaded lazily, exactly like the GPX picker (app/log-session):
 * a dev build made before this pass carries no native location module, so a
 * static import would crash the whole log-session route. Loaded on start(), an
 * old build degrades to an honest message instead (status: 'unavailable').
 *
 * Pass 1 is foreground-only: iOS suspends JS when the app backgrounds or the
 * screen locks, so fixes pause until it returns. We keep the screen awake while
 * recording (best-effort) to avoid the most common gap; true background tracking
 * is Pass 2 (it needs a background-location entitlement and battery care).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocationSubscription } from 'expo-location';
import type { GeoPoint } from '@core/observation';

export type TrackerStatus =
  | 'idle' // not recording
  | 'starting' // permission + first fix pending
  | 'tracking' // actively recording
  | 'denied' // location permission refused (honest floor: log by hand instead)
  | 'unavailable' // native module missing — this dev build predates the feature
  | 'error';

export type GpsTracker = {
  status: TrackerStatus;
  points: GeoPoint[];
  errorMessage: string | null;
  /** Ask for permission and begin recording. No-op if already tracking. */
  start: () => Promise<void>;
  /** Stop recording and hand back the fixes captured (the authoritative list). */
  stop: () => GeoPoint[];
  /** Throw away the current recording and return to idle. */
  reset: () => void;
};

/** The slice of an expo-location fix the GeoPoint mapping reads. */
export type LocationFix = {
  coords: { latitude: number; longitude: number; altitude: number | null };
  timestamp: number; // ms epoch
};

/**
 * Maps one expo-location fix to a GeoPoint. Pure and exported so the mapping is
 * unit-testable without the native module. Altitude present → eleM + an
 * 'gps' eleSource label (⚑ E-9: phone fixes are GPS-derived); altitude absent →
 * BOTH keys omitted — a source label without a reading would fabricate one,
 * and 'none' is never written at capture time.
 */
export function locationToGeoPoint(loc: LocationFix): GeoPoint {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    tsSec: Math.floor(loc.timestamp / 1000),
    ...(loc.coords.altitude != null
      ? { eleM: loc.coords.altitude, eleSource: 'gps' as const }
      : {}),
  };
}

export function useGpsTracker(): GpsTracker {
  const [status, setStatus] = useState<TrackerStatus>('idle');
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The fixes live in a ref so stop() can return the latest list synchronously
  // (setState is async); the `points` state just mirrors it for rendering.
  const pointsRef = useRef<GeoPoint[]>([]);
  const subRef = useRef<LocationSubscription | null>(null);
  const releaseWakeRef = useRef<(() => void) | null>(null);

  const teardown = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    releaseWakeRef.current?.();
    releaseWakeRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (subRef.current) return; // already tracking
    setErrorMessage(null);
    setStatus('starting');

    let Location: typeof import('expo-location');
    try {
      Location = await import('expo-location');
    } catch {
      setStatus('unavailable');
      setErrorMessage(
        'GPS recording needs an updated dev build of the app — rebuild to enable it.'
      );
      return;
    }

    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setStatus('denied');
        return;
      }

      pointsRef.current = [];
      setPoints([]);

      // Keep the screen awake while recording — best-effort; degrade silently if
      // the module isn't in this build.
      try {
        const KeepAwake = await import('expo-keep-awake');
        await KeepAwake.activateKeepAwakeAsync('gps-tracker');
        releaseWakeRef.current = () => {
          void KeepAwake.deactivateKeepAwake('gps-tracker');
        };
      } catch {
        /* no keep-awake in this build; recording still works */
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000, // a fix at most every ~2 s …
          distanceInterval: 5, // … or every 5 m, whichever comes first
        },
        (loc) => {
          pointsRef.current = [...pointsRef.current, locationToGeoPoint(loc)];
          setPoints(pointsRef.current);
        }
      );
      subRef.current = sub;
      setStatus('tracking');
    } catch (e) {
      teardown();
      setStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Could not start GPS recording.');
    }
  }, [teardown]);

  const stop = useCallback((): GeoPoint[] => {
    teardown();
    setStatus('idle');
    return pointsRef.current;
  }, [teardown]);

  const reset = useCallback(() => {
    teardown();
    pointsRef.current = [];
    setPoints([]);
    setErrorMessage(null);
    setStatus('idle');
  }, [teardown]);

  // Remove the subscription (and release the wake lock) if the screen unmounts
  // mid-recording.
  useEffect(() => teardown, [teardown]);

  return { status, points, errorMessage, start, stop, reset };
}
