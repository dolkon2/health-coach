/**
 * Map — the geometry tab (planning/rework/tabs/map-tab.md). M2: Record is
 * real — background GPS recording + the on-map save sheet. At MVP the tab IS
 * Record — no mode switch renders until Explore ships.
 *
 * The three Record states (map-tab §2):
 *   - Pre-start: full-bleed basemap + spots pins, sport-arm control, GPS
 *     readiness chip, Record button, quiet "Import a track" door.
 *   - Live: useBackgroundRecorder (task-based; survives lock/background,
 *     Android app-swipe too — ⚑1 answered `false`), stats strip (elapsed /
 *     distance / accuracy), live RoutePreview trace (SVG — no MapLibre work
 *     while recording), Stop and Discard. Navigating away doesn't stop
 *     anything; remounting re-attaches to the live recording.
 *   - Save: SaveRecordingSheet writes the ordinary session Observation with
 *     the silent conditions freeze; post-save returns HERE (pre-start) — the
 *     Profile-logbook deep-link stays deferred (Session 7 ⚑).
 *
 * Routing follows the LOGGING SURFACE, not the dimension (⚑6): only
 * gps/sky-surface sports record on the map; indoor climbing, pool swim and
 * friends keep M1's deep-link into log-session, and Body routes to Training.
 *
 * On launch with an orphaned recording (iOS swipe-kill, reboot, kill between
 * Stop and save) the recovery banner offers "finish the partial session" —
 * everything up to the kill is in the SQLite buffer.
 *
 * Home deep-link contract (map-tab.md §5): Record reads `element` /
 * `activity` / `routeId`. Home *sending* those (H6) is a later pass.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';
import type { Spot } from '@core/spot';
import {
  Text,
  Card,
  Button,
  MapSurface,
  ElementPickerSheet,
  RoutePreview,
  SaveRecordingSheet,
  type SaveRecordingTrack,
} from '@/components';
import { iconFor } from '@/components/activityIcons';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { listSpots } from '@/storage/spots';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useBackgroundRecorder, type BackgroundRecorder } from '@/hooks/useBackgroundRecorder';
import { elementOf, activityById, type Activity } from '@/lib/activity';
import { mostRecentActivityByElement } from '@/lib/mostRecentActivity';
import { recordsOnMap, recordingElementOf, pairTrackFormat } from '@/lib/recording/recordingSave';
import { parseGpx } from '@/lib/gpxImport';
import { parseIgc } from '@/lib/igcImport';
import { summarizeTrack } from '@/lib/gpsTrack';
import { metersToDisplay } from '@/lib/units';
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
  const [saveTrack, setSaveTrack] = useState<SaveRecordingTrack | null>(null);
  const [saveActivity, setSaveActivity] = useState<Activity | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const loc = useForegroundLocation();
  const recorder = useBackgroundRecorder();
  const { distanceUnit } = useSettings();

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
      // Re-probe for a live or orphaned recording every time the tab fronts —
      // the OS task may have kept recording while we were elsewhere.
      void recorder.attach();
    }, [reloadSpots, reloadSessions, loc.check, recorder.attach])
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
    // Body never reaches here (the arm control routes it to Training), but
    // guard anyway so a future arming path can't drop a Body session onto
    // the map.
    if (elementOf(armed) === 'body') {
      router.push('/training');
      return;
    }
    // Routing follows the logging surface (⚑6): a non-track sport (indoor
    // climb, pool swim, practice) keeps the proven log-session door.
    if (!recordsOnMap(armed)) {
      router.push({ pathname: '/log-session', params: { activity: armed.id } });
      return;
    }
    setJustSaved(false);
    void recorder.start({ activityId: armed.id, element: recordingElementOf(armed) });
  }

  // ─── "Import a track" door (map-tab §5 Ingestion — rides M2) ──────────────
  // The other half of "records a track or ingests one": a watch-exported GPX
  // or a vario's IGC lands in the SAME save sheet as a live recording. The
  // log-session importers stay put until this door is device-verified
  // (never-lose-access gate — retirement is a follow-up, not this build).
  async function onImportTrack() {
    if (importing) return;
    setImporting(true);
    setImportError(null);
    // Lazy-load like log-session's importGpxFile: an old dev build degrades
    // to an honest message instead of crashing the tab.
    let DocumentPicker: typeof import('expo-document-picker');
    let FileSystem: typeof import('expo-file-system');
    try {
      DocumentPicker = await import('expo-document-picker');
      FileSystem = await import('expo-file-system');
    } catch {
      setImporting(false);
      setImportError('File import needs an updated dev build of the app — rebuild to enable it.');
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || res.assets.length === 0) return;
      const asset = res.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri);
      // Extension decides; a missing extension falls back on shape (XML → GPX).
      const isIgc =
        /\.igc$/i.test(asset.name ?? '') ||
        (!/\.gpx$/i.test(asset.name ?? '') && !text.trimStart().startsWith('<'));
      const format = isIgc ? ('igc' as const) : ('gpx' as const);
      // The armed sport must be able to carry this format (GPX → Earth/Water,
      // IGC → Sky) — a mismatch is named plainly, nothing parsed further.
      const mismatch = pairTrackFormat(armed, format);
      if (mismatch) {
        setImportError(mismatch);
        return;
      }
      const parsed = isIgc ? parseIgc(text) : parseGpx(text);
      if (parsed.points.length < 2) {
        setImportError('That file has no usable track points.');
        return;
      }
      setSaveActivity(armed);
      setSaveTrack({
        points: parsed.points,
        origin: { kind: 'import', format, ...(asset.name ? { filename: asset.name } : {}) },
        recordingId: null, // no buffer behind a file
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.distanceM > 0 ? { distanceM: parsed.distanceM } : {}),
        ...(parsed.elevationGainM != null ? { elevationGainM: parsed.elevationGainM } : {}),
        ...(!isIgc && (parsed as ReturnType<typeof parseGpx>).elevationGainSource != null
          ? { elevationGainSource: (parsed as ReturnType<typeof parseGpx>).elevationGainSource }
          : {}),
        ...(parsed.durationMin != null ? { durationMin: parsed.durationMin } : {}),
        ...(parsed.startTime ? { startTime: parsed.startTime } : {}),
      });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Could not read that file as a track.');
    } finally {
      setImporting(false);
    }
  }

  /** Stop the live recording (or finish a recovered one) → save sheet. */
  async function onStopToSave(activityForSheet: Activity) {
    const result = await recorder.stop();
    if (result == null) return;
    setSaveActivity(activityForSheet);
    setSaveTrack({
      points: result.fixes,
      origin: { kind: 'record' },
      recordingId: result.recordingId,
    });
  }

  /** Recovery-banner "Finish": the task is long dead — stop() reads the
   *  buffer back (it falls through to the recoverable row's id). */
  async function onFinishRecovered() {
    const rec = recorder.recoverable;
    if (rec == null) return;
    const result = await recorder.stop();
    if (result == null) return;
    if (result.fixes.length < 2) {
      // Nothing usable survived (killed seconds in) — clear it honestly
      // rather than opening a sheet that can't save.
      await recorder.discard(result.recordingId);
      return;
    }
    setSaveActivity(activityById(rec.activityId) ?? armed);
    setSaveTrack({
      points: result.fixes,
      origin: { kind: 'record' },
      recordingId: result.recordingId,
    });
  }

  const ArmIcon = iconFor(armed.icon);
  const isRecording = recorder.status === 'tracking' || recorder.status === 'starting';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <MapSurface
        center={center}
        zoom={zoom}
        pins={pins}
        onPressPin={(spot) => router.push({ pathname: '/spot/[id]', params: { id: spot.id } })}
      />

      {/* Sport-arm control — floats below the header band, left side. Hidden
          while recording: the sport is part of the running recording (the
          save sheet is where a wrong arm gets corrected). */}
      {!isRecording ? (
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
      ) : null}

      {/* Bottom control cluster — GPS status + Record, or the live recording
          panel. No insets.bottom here: the tab bar already reserves the
          home-indicator safe area (src/components/Screen.tsx convention). */}
      <View
        style={{
          position: 'absolute',
          left: theme.spacing[6],
          right: theme.spacing[6],
          bottom: theme.spacing[4],
        }}
      >
        {isRecording ? (
          <LiveRecordingPanel
            recorder={recorder}
            armed={armed}
            distanceUnit={distanceUnit}
            onStop={() => void onStopToSave(armed)}
            onDiscard={() => {
              Alert.alert('Discard this recording?', 'The track will be deleted.', [
                { text: 'Keep recording', style: 'cancel' },
                {
                  text: 'Discard',
                  style: 'destructive',
                  onPress: () => void recorder.discard(),
                },
              ]);
            }}
          />
        ) : (
          <Card style={{ gap: theme.spacing[3] }}>
            {recorder.recoverable != null ? (
              <RecoveryBanner
                activityLabel={
                  activityById(recorder.recoverable.activityId)?.label ?? 'session'
                }
                onFinish={() => void onFinishRecovered()}
                onDiscard={() => {
                  Alert.alert(
                    'Discard the unfinished recording?',
                    'Everything captured before the app closed will be deleted.',
                    [
                      { text: 'Keep', style: 'cancel' },
                      {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => void recorder.discard(),
                      },
                    ]
                  );
                }}
              />
            ) : null}
            <GpsStatusLine loc={loc} />
            {recorder.status === 'error' && recorder.errorMessage ? (
              <Text variant="bodySm" color={theme.colors.negative}>
                {recorder.errorMessage}
              </Text>
            ) : null}
            {recorder.status === 'unavailable' ? (
              <Text variant="bodySm" color={theme.colors.textMuted}>
                {recorder.errorMessage}
              </Text>
            ) : null}
            {justSaved ? (
              <Text variant="label" color={theme.colors.positive}>
                Session saved.
              </Text>
            ) : null}
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
            <Button
              label={`Record ${armed.label}`}
              onPress={onRecord}
              disabled={recorder.recoverable != null}
            />
            {importError ? (
              <Text variant="bodySm" color={theme.colors.negative}>
                {importError}
              </Text>
            ) : null}
            {/* The quiet ingestion door — secondary to Record by design. */}
            <Pressable
              onPress={() => void onImportTrack()}
              accessibilityRole="button"
              accessibilityLabel="Import a track file"
              style={{ alignSelf: 'center', paddingVertical: theme.spacing[1] }}
            >
              <Text variant="label" color={theme.colors.textMuted}>
                {importing ? 'Reading file…' : 'Import a track (GPX · IGC)'}
              </Text>
            </Pressable>
          </Card>
        )}
      </View>

      <ElementPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        mostRecent={mostRecent}
        onPickActivity={onPickActivity}
        onPickBody={onPickBody}
      />

      <SaveRecordingSheet
        visible={saveTrack != null}
        activity={saveActivity ?? armed}
        track={saveTrack}
        onSaved={() => {
          setSaveTrack(null);
          setSaveActivity(null);
          setJustSaved(true);
          reloadSessions();
        }}
        onDiscarded={() => {
          setSaveTrack(null);
          setSaveActivity(null);
          void recorder.attach(); // row is gone; clears any recoverable state
        }}
        onClose={() => {
          // Backing out is NOT a discard: the stopped recording's buffer row
          // survives, so re-probe surfaces it as the recovery banner.
          setSaveTrack(null);
          setSaveActivity(null);
          void recorder.attach();
        }}
      />
    </View>
  );
}

/** The live Record state: red dot, elapsed / distance / GPS quality, the
 *  SVG trace (no MapLibre work while recording — battery), Stop, Discard. */
function LiveRecordingPanel({
  recorder,
  armed,
  distanceUnit,
  onStop,
  onDiscard,
}: {
  recorder: BackgroundRecorder;
  armed: Activity;
  distanceUnit: 'km' | 'mi';
  onStop: () => void;
  onDiscard: () => void;
}) {
  const theme = useTheme();

  // Wall-clock elapsed, ticked locally — fixes arrive in ~5 s deferred
  // batches in the background, so deriving elapsed from points would stutter.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const startedMs = recorder.startedAt ? Date.parse(recorder.startedAt) : null;
  const elapsedSec = startedMs != null ? Math.max(0, Math.floor((nowMs - startedMs) / 1000)) : 0;
  const h = Math.floor(elapsedSec / 3600);
  const m = Math.floor((elapsedSec % 3600) / 60);
  const s = elapsedSec % 60;
  const elapsed =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;

  const distanceM = useMemo(
    () => (recorder.points.length >= 2 ? summarizeTrack(recorder.points).distanceM : 0),
    [recorder.points]
  );
  const gpsLevel = accuracyLevel(recorder.lastAccuracyM);

  return (
    <Card style={{ gap: theme.spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: theme.colors.negative,
          }}
        />
        <Text variant="label">
          {recorder.status === 'starting' ? 'Starting…' : `Recording ${armed.label}`}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing[6] }}>
        <View>
          <Text variant="label" color={theme.colors.textMuted}>
            Time
          </Text>
          <Text variant="dataLg">{elapsed}</Text>
        </View>
        <View>
          <Text variant="label" color={theme.colors.textMuted}>
            Distance
          </Text>
          <Text variant="dataLg">
            {distanceM > 0
              ? `${Math.round(metersToDisplay(distanceM, distanceUnit) * 100) / 100} ${distanceUnit}`
              : '—'}
          </Text>
        </View>
        <View>
          <Text variant="label" color={theme.colors.textMuted}>
            GPS
          </Text>
          <Text
            variant="dataLg"
            color={gpsLevel === 'weak' ? theme.colors.caution : theme.colors.text}
          >
            {gpsLevel === 'unknown' ? '…' : gpsLevel === 'weak' ? 'weak' : 'good'}
          </Text>
        </View>
      </View>

      {recorder.points.length >= 2 ? (
        <RoutePreview path={recorder.points} height={84} />
      ) : (
        <Text variant="bodySm" color={theme.colors.textMuted}>
          Waiting for a GPS fix — recording continues with the screen off or the app closed.
        </Text>
      )}

      <Button label="Stop" onPress={onStop} />
      <Button label="Discard" variant="outline" onPress={onDiscard} />
    </Card>
  );
}

/** Launch-time orphan recovery (map-tab §3): the honest floor for an iOS
 *  swipe-kill or reboot — everything up to the kill is in the buffer. */
function RecoveryBanner({
  activityLabel,
  onFinish,
  onDiscard,
}: {
  activityLabel: string;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        gap: theme.spacing[2],
        paddingBottom: theme.spacing[2],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text variant="bodySm">
        You have an unfinished {activityLabel} recording from before the app closed.
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
        <Button label="Finish the partial session" onPress={onFinish} style={{ flex: 1 }} />
        <Button label="Discard" variant="outline" onPress={onDiscard} />
      </View>
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
