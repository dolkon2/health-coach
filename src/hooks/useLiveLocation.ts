/**
 * useLiveLocation — the Map tab's blue dot (map-tab.md REFRAME AMENDMENT,
 * base chrome on both My Map and Explore). A continuous foreground-only
 * watch, distinct from map.tsx's existing `useForegroundLocation` (a
 * one-shot pre-start probe for the GPS-readiness chip) and from
 * useGpsTracker (a recording-grade, high-accuracy, backgrounded track).
 *
 * expo-location is lazy-imported, same defensive posture as every other
 * location call in this app (useGpsTracker, useBackgroundRecorder,
 * useCragPin, map.tsx's own probe) — a dev build made before the native
 * module shipped degrades to an honest `null`, never a crash.
 *
 * Never requests permission itself — the existing GPS-readiness chip (My
 * Map's pre-start card) already owns that prompt/UX; this hook only checks
 * the CURRENT permission status and watches if it's already granted. No
 * permission yet simply means no dot, honestly, not a second competing
 * prompt.
 *
 * Active only while the Map tab is focused — the watch subscription is
 * torn down on blur/unmount (battery; a passive "where am I" dot has no
 * reason to keep the GPS radio hot off-screen).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { LngLat } from '@/components/mapLibre';

type LocationSubscription = { remove: () => void };

/** The slice of an expo-location fix the blue dot reads. */
export type LocationFix = { coords: { latitude: number; longitude: number } };

/** Maps one expo-location fix to the [lng, lat] tuple MapSurface expects.
 *  Pure and exported so it's unit-testable without the native module, same
 *  pattern as useCragPin's locationToCragPin. */
export function locationToLngLat(fix: LocationFix): LngLat {
  return [fix.coords.longitude, fix.coords.latitude];
}

export function useLiveLocation(): LngLat | null {
  const [coord, setCoord] = useState<LngLat | null>(null);
  const subRef = useRef<LocationSubscription | null>(null);

  const stop = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (subRef.current) return; // already watching
    let Location: typeof import('expo-location');
    try {
      Location = await import('expo-location');
    } catch {
      return; // no native module in this build — honestly absent, not an error
    }
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (fix) => {
          setCoord(locationToLngLat(fix));
        }
      );
    } catch {
      // Location Services off, or a mid-watch failure — the dot is simply
      // absent; the readiness chip elsewhere already explains why.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void start();
      return () => {
        stop();
        setCoord(null);
      };
    }, [start, stop])
  );

  // Belt-and-suspenders unmount cleanup (useFocusEffect's own cleanup
  // already covers blur, but a hard unmount without a prior blur — e.g. a
  // parent tree swap in tests — should never leak a live subscription).
  useEffect(() => stop, [stop]);

  return coord;
}
