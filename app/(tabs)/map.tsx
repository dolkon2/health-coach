/**
 * Map — the geometry tab (planning/rework/tabs/map-tab.md). This is M1: the
 * Record *pre-start* surface. At MVP the tab IS Record — no mode switch renders
 * until Explore ships.
 *
 * What ships now:
 *   - Full-bleed basemap centered on the user, Pinned Spots as sport-icon pins.
 *   - A sport-arm control (pre-armed by the Home deep link, else last-used) —
 *     the deep link's choice is a default, not a lock; re-arm freely.
 *   - Foreground location permission states (rationale → prompt, denied/off) and
 *     a GPS-readiness chip.
 *   - A Record button.
 *
 * Scope decision (flagged in the dev-log): Record hands the armed sport to the
 * existing, proven `log-session` capture+save path rather than recording live on
 * the map and writing an Observation here. M2 owns background recording + the
 * on-map save sheet; building a save now would only be thrown away by M2, and
 * the deep-link reuses the shipped path with zero data-loss risk. It also
 * resolves the indoor-climbing/pool-swim ⚑ for free: a non-GPS armed sport just
 * opens its correct logger surface.
 *
 * Home deep-link contract (map-tab.md §5): Record reads `element` / `activity` /
 * `routeId`. Home *sending* those (H6) is a later pass; today Home still routes
 * Earth/Sky/Water to `log-session` directly, so nothing here is load-bearing yet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';
import type { Spot } from '@core/spot';
import { Text, Card, Button, MapSurface, ElementPickerSheet } from '@/components';
import { iconFor } from '@/components/activityIcons';
import { useTheme } from '@/theme';
import { listSpots } from '@/storage/spots';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { elementOf, type Activity } from '@/lib/activity';
import { mostRecentActivityByElement } from '@/lib/mostRecentActivity';
import {
  accuracyLevel,
  resolveArmedActivity,
  resolveMapCenter,
  spotsWithCoords,
} from '@/lib/mapRecord';
import type { LngLat } from '@/components/mapLibre';

/** Coerce a possibly-array search param to a single string. */
function paramStr(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ activity?: string; element?: string; routeId?: string }>();

  const [spots, setSpots] = useState<Spot[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [armOverride, setArmOverride] = useState<Activity | null>(null);
  const loc = useForegroundLocation();

  const { sessions, reload: reloadSessions } = useSessionHistory();

  const reloadSpots = useCallback(() => {
    listSpots()
      .then(setSpots)
      .catch(() => setSpots([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadSpots();
      reloadSessions();
      loc.check();
    }, [reloadSpots, reloadSessions, loc.check])
  );

  // The armed sport: the deep link / last-used suggestion, unless the user
  // re-armed via the picker (override wins). Always resolves to an activity.
  const suggested = useMemo(
    () =>
      resolveArmedActivity({
        activityParam: paramStr(params.activity),
        elementParam: paramStr(params.element),
        sessionsNewestFirst: sessions,
      }),
    [params.activity, params.element, sessions]
  );
  const armed = armOverride ?? suggested;

  // A fresh Home deep-link (new activity/element params) wins over a stale
  // manual re-arm from a previous visit — the Map tab stays mounted across
  // visits, so without this the override would silently swallow the deep link.
  useEffect(() => {
    setArmOverride(null);
  }, [params.activity, params.element]);

  const mostRecent = useMemo(() => mostRecentActivityByElement(sessions), [sessions]);
  const pins = useMemo(() => spotsWithCoords(spots), [spots]);
  const { center, zoom } = useMemo(
    () => resolveMapCenter({ userLoc: loc.userLoc, spots }),
    [loc.userLoc, spots]
  );

  function onPickActivity(activity: Activity) {
    setArmOverride(activity);
    setPickerVisible(false);
  }
  function onPickBody() {
    // Body isn't a GPS session — it's logged through Training (locked #6).
    setPickerVisible(false);
    router.push('/training');
  }

  function onRecord() {
    // Deep-link into the proven capture+save flow with the sport armed. Body
    // never reaches here (the arm control routes it to Training), but guard
    // anyway so a future arming path can't drop a Body session onto the map.
    if (elementOf(armed) === 'body') {
      router.push('/training');
      return;
    }
    router.push({ pathname: '/log-session', params: { activity: armed.id } });
  }

  const ArmIcon = iconFor(armed.icon);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <MapSurface
        center={center}
        zoom={zoom}
        pins={pins}
        onPressPin={(spot) => router.push({ pathname: '/spot/[id]', params: { id: spot.id } })}
      />

      {/* Sport-arm control — floats below the header band, left side. */}
      <Pressable
        onPress={() => setPickerVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Armed sport: ${armed.label}. Tap to change.`}
        style={{
          position: 'absolute',
          top: insets.top + 52,
          left: theme.spacing[6],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[2],
          paddingVertical: theme.spacing[2],
          paddingHorizontal: theme.spacing[3],
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.surfaceRaised,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <ArmIcon size={18} color={theme.colors.accent} strokeWidth={1.75} />
        <Text variant="label">{armed.label}</Text>
        <ChevronDown size={16} color={theme.colors.textMuted} strokeWidth={1.5} />
      </Pressable>

      {/* Bottom control cluster — GPS status + Record. No insets.bottom here:
          the tab bar already reserves the home-indicator safe area below the
          content (src/components/Screen.tsx convention). */}
      <View
        style={{
          position: 'absolute',
          left: theme.spacing[6],
          right: theme.spacing[6],
          bottom: theme.spacing[4],
        }}
      >
        <Card style={{ gap: theme.spacing[3] }}>
          <GpsStatusLine loc={loc} />
          {loc.status === 'undetermined' ? (
            <Button label="Enable location" variant="outline" onPress={loc.request} />
          ) : null}
          {loc.status === 'denied' || (loc.status === 'granted' && loc.fixFailed) ? (
            <Button
              label="Open Settings"
              variant="outline"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
          <Button label={`Record ${armed.label}`} onPress={onRecord} />
        </Card>
      </View>

      <ElementPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        mostRecent={mostRecent}
        onPickActivity={onPickActivity}
        onPickBody={onPickBody}
      />
    </View>
  );
}

/** The honest one-liner above the Record button describing GPS readiness. */
function GpsStatusLine({ loc }: { loc: ForegroundLocation }) {
  const theme = useTheme();
  if (loc.status === 'unavailable') {
    return (
      <Text variant="bodySm" color={theme.colors.textMuted}>
        Location needs an updated dev build of the app. You can still log a session by hand.
      </Text>
    );
  }
  if (loc.status === 'undetermined') {
    return (
      <Text variant="bodySm" color={theme.colors.textMuted}>
        The app can't see your location except during a session you start. Turn it on to record a
        track.
      </Text>
    );
  }
  if (loc.status === 'denied') {
    return (
      <Text variant="bodySm" color={theme.colors.textMuted}>
        Location is off, so there's no track to record — turn it on for the app in Settings, or log
        the session by hand.
      </Text>
    );
  }
  // granted but we couldn't get any fix — usually device Location Services off.
  // Say so honestly rather than spin "Locating…" forever.
  if (loc.fixFailed && loc.userLoc == null) {
    return (
      <Text variant="bodySm" color={theme.colors.textMuted}>
        Can't find your location — check that Location Services is on for your device.
      </Text>
    );
  }
  // granted (or still checking) — reflect the acquired-fix accuracy.
  const level = accuracyLevel(loc.accuracyM);
  if (level === 'good') {
    return (
      <Text variant="label" color={theme.colors.textSecondary}>
        GPS ready
      </Text>
    );
  }
  if (level === 'weak') {
    return (
      <Text variant="bodySm" color={theme.colors.caution}>
        Weak signal — points may scatter. Head outside for a clearer fix.
      </Text>
    );
  }
  return (
    <Text variant="label" color={theme.colors.textMuted}>
      Locating…
    </Text>
  );
}

// ─── Foreground location probe ───────────────────────────────────────────────
// Mirrors useGpsTracker's lazy-import posture: expo-location is loaded on demand
// so a dev build made before the native module degrades to an honest state
// rather than crashing the tab. This is the pre-start *probe* only (permission +
// a single fix for the readiness chip); the actual recording runs in
// log-session's GpsRecorderPanel (the M1 scope decision above).

type LocStatus = 'checking' | 'undetermined' | 'denied' | 'granted' | 'unavailable';

type ForegroundLocation = {
  status: LocStatus;
  userLoc: LngLat | null;
  accuracyM: number | null;
  /** Permission is granted but no fix could be obtained (Location Services off,
   *  cold-GPS timeout) — the screen offers Settings instead of spinning. */
  fixFailed: boolean;
  check: () => Promise<void>;
  request: () => Promise<void>;
};

function useForegroundLocation(): ForegroundLocation {
  const [status, setStatus] = useState<LocStatus>('checking');
  const [userLoc, setUserLoc] = useState<LngLat | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [fixFailed, setFixFailed] = useState(false);

  // The probe awaits native calls; guard every setState so a resolve that lands
  // after the screen unmounts is a no-op (the repo's cancelled-flag pattern).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadModule = useCallback(async () => {
    try {
      return await import('expo-location');
    } catch {
      return null;
    }
  }, []);

  const fetchFix = useCallback(async (Location: typeof import('expo-location')) => {
    try {
      // Only a RECENT cached fix counts as "where you are now" — an hours-old
      // last-known would read as a live "GPS ready" on a coordinate miles away.
      const recent = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
      // A cold GPS can hang without ever resolving OR throwing (Location
      // Services off, or no signal). Cap the wait so the chip flips to an
      // honest "can't locate" + Settings affordance instead of spinning forever.
      const pos =
        recent ??
        (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 15_000)),
        ]));
      if (!mountedRef.current) return;
      if (pos) {
        setUserLoc([pos.coords.longitude, pos.coords.latitude]);
        setAccuracyM(pos.coords.accuracy ?? null);
        setFixFailed(false);
      } else {
        setFixFailed(true);
      }
    } catch {
      // Granted but the fix errored — Location Services off, permission race.
      if (mountedRef.current) setFixFailed(true);
    }
  }, []);

  const applyPerm = useCallback(
    async (
      Location: typeof import('expo-location'),
      perm: { granted: boolean; canAskAgain: boolean }
    ) => {
      if (!mountedRef.current) return;
      if (perm.granted) {
        setStatus('granted');
        setFixFailed(false);
        await fetchFix(Location);
      } else {
        setStatus(perm.canAskAgain ? 'undetermined' : 'denied');
      }
    },
    [fetchFix]
  );

  const check = useCallback(async () => {
    const Location = await loadModule();
    if (!mountedRef.current) return;
    if (!Location) {
      setStatus('unavailable');
      return;
    }
    await applyPerm(Location, await Location.getForegroundPermissionsAsync());
  }, [loadModule, applyPerm]);

  const request = useCallback(async () => {
    const Location = await loadModule();
    if (!mountedRef.current) return;
    if (!Location) {
      setStatus('unavailable');
      return;
    }
    await applyPerm(Location, await Location.requestForegroundPermissionsAsync());
  }, [loadModule, applyPerm]);

  return { status, userLoc, accuracyM, fixFailed, check, request };
}
