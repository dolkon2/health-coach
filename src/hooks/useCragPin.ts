/**
 * useCragPin — a one-shot device location fix for the climbing crag pin
 * (⚑ E-5, dev-log/dimension-earth-build.md, dimension/earth Pass E4).
 *
 * Unlike useGpsTracker (a continuous route recording), a crag pin needs
 * exactly one fix: where the user is standing when they log the session.
 * expo-location is loaded lazily, same reason as useGpsTracker and the GPX
 * picker — a dev build made before this pass carries no native location
 * module, so a static import would crash the whole log-session route on it.
 */
import { useCallback, useRef, useState } from 'react';
import type { LatLng } from '@core/geo';

export type CragPinStatus =
  | 'idle'
  | 'locating'
  | 'denied' // location permission refused — pin by hand instead (name-only, no coords)
  | 'unavailable' // native module missing — this dev build predates the feature
  | 'error';

export type CragPin = {
  status: CragPinStatus;
  errorMessage: string | null;
  /** Ask for permission and take a single fix. No-op if already locating. */
  capture: () => Promise<LatLng | null>;
};

/** The slice of an expo-location fix the pin mapping reads. */
export type LocationFix = { coords: { latitude: number; longitude: number } };

/** Maps one expo-location fix to a crag pin. Pure and exported so it's unit-testable without the native module. */
export function locationToCragPin(loc: LocationFix): LatLng {
  return { lat: loc.coords.latitude, lng: loc.coords.longitude };
}

export function useCragPin(): CragPin {
  const [status, setStatus] = useState<CragPinStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // A ref, not `status` state: state updates commit asynchronously, so a
  // second capture() fired before the first's setStatus('locating') has
  // committed could still read a stale 'idle' — a ref is set synchronously,
  // before any `await`, so the guard is race-free (same pattern as
  // useGpsTracker's subRef.current).
  const lockRef = useRef(false);

  const capture = useCallback(async () => {
    if (lockRef.current) return null; // already locating — the documented no-op
    lockRef.current = true;
    setErrorMessage(null);
    setStatus('locating');

    try {
      let Location: typeof import('expo-location');
      try {
        Location = await import('expo-location');
      } catch {
        setStatus('unavailable');
        setErrorMessage(
          'Crag pin needs an updated dev build of the app — rebuild to enable it.'
        );
        return null;
      }

      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          setStatus('denied');
          return null;
        }
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setStatus('idle');
        return locationToCragPin(fix);
      } catch (e) {
        setStatus('error');
        setErrorMessage(e instanceof Error ? e.message : 'Could not get your location.');
        return null;
      }
    } finally {
      lockRef.current = false;
    }
  }, []);

  return { status, errorMessage, capture };
}
