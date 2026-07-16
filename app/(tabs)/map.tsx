/**
 * Map — the geometry tab. The REFRAME AMENDMENT (map-tab.md, 2026-07-15,
 * authoritative over the rest of that doc) splits this into two live modes:
 *
 *   - My Map (the landing): your established world — pinned spots, saved
 *     routes, your own E/S/W traces, as togglable layers — with Record
 *     living inside it, front-and-center. Long-hold → "pin a spot here."
 *   - Explore: a fixed center crosshair reticle (pan the map under it,
 *     Windy-style) with "View forecast" (a PointForecastSheet for that
 *     coordinate, nothing saved) and "Pin this location". Blank canvas —
 *     no spots/routes layer, no layer toggle row (Dylan, 2026-07-16).
 *
 * The mode switcher (SegmentedControl, base chrome) is structurally absent
 * — not just hidden — while a recording is live: Record now lives inside My
 * Map, so `isRecording` forces `mode` back to `'myMap'` the instant it goes
 * true, and the switcher itself only renders when `!isRecording`.
 *
 * Base chrome shared by both modes: a location-search bar (MapTiler
 * geocoding, Nominatim fallback) that recenters the camera, and a live blue
 * dot (a deliberate one-off exception to the monochrome+4-element palette —
 * see MapSurface.tsx's header comment).
 *
 * The three Record states below (now nested under My Map, map-tab §2):
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
import { ChevronDown, Crosshair, Search, X } from 'lucide-react-native';
import type { Spot } from '@core/spot';
import type { Route } from '@core/route';
import {
  Text,
  Card,
  Button,
  Field,
  MapSurface,
  ElementPickerSheet,
  RoutePreview,
  SaveRecordingSheet,
  SegmentedControl,
  PointForecastSheet,
  RouteBuilderOverlay,
  chipStyle,
  type SaveRecordingTrack,
  type MapSurfaceRef,
  type RouteLayerRoute,
  type TraceLayerTrace,
} from '@/components';
import { iconFor } from '@/components/activityIcons';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { listSpots } from '@/storage/spots';
import { getRoute, listRoutes } from '@/storage/routes';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useBackgroundRecorder, type BackgroundRecorder } from '@/hooks/useBackgroundRecorder';
import { useBatteryOptPrompt } from '@/hooks/useBatteryOptPrompt';
import { useLiveLocation } from '@/hooks/useLiveLocation';
import { useRouteBuilder } from '@/hooks/useRouteBuilder';
import { routingModeForActivity } from '@/lib/routeSnap';
import { elementOf, activityById, type Activity } from '@/lib/activity';
import { mostRecentActivityByElement } from '@/lib/mostRecentActivity';
import { recordsOnMap, recordingElementOf, pairTrackFormat } from '@/lib/recording/recordingSave';
import { parseGpx } from '@/lib/gpxImport';
import { parseIgc } from '@/lib/igcImport';
import { formatDurationClock } from '@/lib/date';
import { numStr } from '@/lib/session';
import { metersToDisplay } from '@/lib/units';
import {
  accuracyLevel,
  resolveArmedActivity,
  resolveMapCenter,
  spotsWithCoords,
} from '@/lib/mapRecord';
import { sessionTracks } from '@/lib/mapTraces';
import { routesForLayer } from '@/lib/mapRoutes';
import { geocode, type GeocodeResult } from '@/lib/geocode';
import type { LngLat } from '@/components/mapLibre';

type MapMode = 'myMap' | 'explore';
type MapLayerKey = 'spots' | 'routes' | 'traces';

/** Coerce a possibly-array search param to a single string. */
function paramStr(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    activity?: string;
    element?: string;
    routeId?: string;
    build?: string;
  }>();

  // My Map is the landing (REFRAME AMENDMENT). Structurally forced back to
  // 'myMap' below the instant a recording starts or a fresh Home deep-link
  // arrives — Explore's render branch is never reachable in either case.
  const [mode, setMode] = useState<MapMode>('myMap');
  // My Map's layer toggle row — Spots/Routes on by default, traces off (a
  // year of E/S/W tracks everywhere you've moved is a heavy default visual;
  // Dylan, 2026-07-16).
  const [visibleLayers, setVisibleLayers] = useState<Record<MapLayerKey, boolean>>({
    spots: true,
    routes: true,
    traces: false,
  });
  const [routes, setRoutes] = useState<Route[]>([]);
  const mapSurfaceRef = useRef<MapSurfaceRef>(null);
  // Explore's "View forecast" — the crosshair's coordinate at the moment it
  // was tapped, read once via getCenter() (no continuous region tracking).
  // null = sheet closed.
  const [forecastCoord, setForecastCoord] = useState<LngLat | null>(null);

  // Location search — base chrome, both modes. Submit-triggered (Nominatim's
  // usage policy asks for no autocomplete-on-keystroke), recenters the
  // camera declaratively via MapSurface's `flyTo` prop.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Distinguishes "haven't searched this query yet" from "searched, zero
  // hits" — typing after a search invalidates the stale result set.
  const [searched, setSearched] = useState(false);
  const [flyTo, setFlyTo] = useState<{ center: LngLat; zoom?: number; requestId: number } | null>(
    null
  );
  // Monotonic — see MapSurface's flyTo prop comment: keying its recenter
  // effect on the coordinate alone would silently no-op a repeat request to
  // the identical spot.
  const flyToRequestIdRef = useRef(0);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  // The element/activity picker sheet is shared: 'arm' re-arms Record's sport,
  // 'builder' chooses the route builder's sport. Routed in onPickActivity.
  const [pickerPurpose, setPickerPurpose] = useState<'arm' | 'builder'>('arm');
  const [armOverride, setArmOverride] = useState<Activity | null>(null);
  // Route builder (Explore-2 takeover): active flag lives here; the build state
  // itself is in useRouteBuilder (declared once `armed` resolves, below).
  const [builderActive, setBuilderActive] = useState(false);
  // One object, one lifecycle: the track being saved and the activity it
  // was recorded under always move together (review: two lockstep states
  // invite a mismatched pair).
  const [saveDraft, setSaveDraft] = useState<{
    track: SaveRecordingTrack;
    activity: Activity;
  } | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // The route Record was deep-linked to follow (routes-spec M4) — seeded
  // from the routeId param, live-reactive to the sport-arm control (a re-arm
  // away from the route's sport un-follows it — see activeFollowRoute).
  const [followRoute, setFollowRoute] = useState<Route | null>(null);
  // The route actually pinned to the recording that's currently live —
  // captured once, in onRecord(), from activeFollowRoute at the moment
  // Record was tapped. Deliberately NOT re-read live from followRoute at
  // stop time: a re-arm or a stale routeId param after Record was pressed
  // must not retroactively relabel a recording already in flight (review
  // finding — a live followRoute read at stop time could tag the WRONG
  // route onto a session, not just lose the tag). Kept in React state, not
  // the recorder (the recording_sessions buffer table, migration 017, has
  // no routeId column and is shipped — never hand-edit a shipped migration
  // — so a kill-and-recover through the orphan banner loses the follow
  // context entirely rather than risk mislabeling; ⚑ flagged in the
  // dev-log, not reinterpreted: acceptable for this S-sized pass).
  const [pinnedFollowRoute, setPinnedFollowRoute] = useState<Route | null>(null);
  const loc = useForegroundLocation();
  // The blue dot — base chrome, both modes (map-tab.md REFRAME AMENDMENT).
  // Distinct from `loc` above: this is a continuous watch, not a one-shot
  // pre-start probe, and it never itself prompts for permission.
  const liveLoc = useLiveLocation();
  const recorder = useBackgroundRecorder();
  const { distanceUnit } = useSettings();

  const { sessions, reload: reloadSessions } = useSessionHistory();

  // One-time Android battery-optimization ask, fired only when THIS
  // recording has run long (⚑2 answered yes — data-said-something timing).
  useBatteryOptPrompt(recorder.status === 'tracking', recorder.startedAt);

  // The save confirmation is transient — it dismisses itself rather than
  // lingering as a stale claim the next time the tab fronts.
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 4000);
    return () => clearTimeout(t);
  }, [justSaved]);

  const reloadSpots = useCallback(() => {
    listSpots()
      .then(setSpots)
      .catch(() => setSpots([]));
  }, []);

  // My Map's saved-routes layer — every route, unfiltered by activity (the
  // element-tint filter happens at render time, see mapRoutes below).
  const reloadRoutes = useCallback(() => {
    listRoutes()
      .then(setRoutes)
      .catch(() => setRoutes([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadSpots();
      reloadRoutes();
      reloadSessions();
      loc.check();
      // Re-probe for a live or orphaned recording every time the tab fronts —
      // the OS task may have kept recording while we were elsewhere.
      void recorder.attach();
    }, [reloadSpots, reloadRoutes, reloadSessions, loc.check, recorder.attach])
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

  // The route builder's state machine (Explore-2). Seeded with the armed sport
  // as a sensible default; reset() re-seeds it whenever the builder opens.
  const builder = useRouteBuilder(armed.id);
  // The sport's *natural* snap mode (what the snap toggle turns back on).
  const builderNaturalMode = routingModeForActivity(builder.activityId);
  const builderActivity = activityById(builder.activityId);
  const builderDistanceLabel =
    builder.distanceM > 0
      ? `${numStr(metersToDisplay(builder.distanceM, distanceUnit), 2)} ${distanceUnit}`
      : '';

  // A fresh Home deep-link (new activity/element params) wins over a stale
  // manual re-arm from a previous visit — the Map tab stays mounted across
  // visits, so without this the override would silently swallow the deep link.
  // Record now lives inside My Map, so the same deep-link forces mode back
  // there too — the only sane behavior once Explore stopped being a separate
  // screen (not explicitly specced, but the only reading consistent with the
  // reframe; flagged in the dev-log, not reinterpreted).
  useEffect(() => {
    setArmOverride(null);
    setMode('myMap');
  }, [params.activity, params.element]);

  // Load (or clear) the followed route whenever the routeId param changes —
  // a route detail's "Start session on this route" deep link, or navigating
  // back to a plain Map tab with no route.
  useEffect(() => {
    const id = paramStr(params.routeId);
    if (!id) {
      setFollowRoute(null);
      return;
    }
    let cancelled = false;
    getRoute(id)
      .then((r) => {
        if (!cancelled) setFollowRoute(r);
      })
      .catch(() => {
        if (!cancelled) setFollowRoute(null);
      });
    return () => {
      cancelled = true;
    };
  }, [params.routeId]);

  const isRecording = recorder.status === 'tracking' || recorder.status === 'starting';
  // Recording OR an unresolved orphan from a prior kill (recorder.attach()
  // sets `recoverable` independently of `status` — an app relaunch after an
  // iOS swipe-kill mid-recording is neither 'tracking' nor 'starting', but
  // still has something that needs Finish/Discard). Both cases must keep
  // the user on My Map: the RecoveryBanner is the ONLY affordance for an
  // orphaned recording, and it renders exclusively in My Map's bottom
  // cluster (review finding — Explore was previously reachable with a
  // recoverable orphan still sitting unresolved, silently hiding the
  // banner with no other way to find it).
  const mapLocked = isRecording || recorder.recoverable != null;

  // Structural, not visual: the instant recording is locked, Explore's
  // render branch becomes unreachable — this isn't just what hides the
  // switcher below (`!mapLocked`), it's what guarantees the locked view is
  // ALWAYS what's on screen, even if mode was somehow 'explore' a tick
  // earlier (defensive — today only the deep-link effect above and the
  // switcher itself can change mode, and neither fires while locked).
  useEffect(() => {
    if (mapLocked) setMode('myMap');
  }, [mapLocked]);

  // Training's "+ New Route" deep-link (build=1) opens the builder takeover on
  // Explore. Clear the param so re-fronting the tab doesn't re-open it.
  useEffect(() => {
    if (paramStr(params.build) !== '1') return;
    openBuilder();
    router.setParams({ build: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.build]);

  // The builder is an Explore-only takeover: leaving Explore, or the map
  // locking for a recording, exits it (discarding the in-progress route).
  useEffect(() => {
    if (builderActive && (mode !== 'explore' || mapLocked)) {
      closeBuilder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mapLocked, builderActive]);

  // The route Record would arm right now IF you pressed Record — absent
  // when the loaded route is for a different sport than the current arm
  // (re-arming away from a route un-follows it, honestly, both in this
  // preview and in what onRecord() will actually pin).
  const activeFollowRoute =
    followRoute && followRoute.activityId === armed.id ? followRoute : null;
  // What the guide line / "Following X" text should show right now: the
  // live preview before Record is pressed, the pinned route once it is.
  const displayFollowRoute = isRecording ? pinnedFollowRoute : activeFollowRoute;

  const mostRecent = useMemo(() => mostRecentActivityByElement(sessions), [sessions]);
  const pins = useMemo(() => spotsWithCoords(spots), [spots]);
  // Stable handler so the (memoized) native map isn't reconciled every time
  // the 2.5 s recording poll re-renders this screen (review finding).
  const onPressPin = useCallback(
    (spot: Spot) => router.push({ pathname: '/spot/[id]', params: { id: spot.id } }),
    [router]
  );
  const onPressRoute = useCallback(
    (routeId: string) => router.push({ pathname: '/route/[id]', params: { id: routeId } }),
    [router]
  );
  const { center, zoom } = useMemo(
    () => resolveMapCenter({ userLoc: loc.userLoc, spots }),
    [loc.userLoc, spots]
  );

  // My Map's three layers (map-tab.md REFRAME AMENDMENT). Explore is a blank
  // crosshair canvas — no pins/routes/traces layer, no toggle row (Dylan,
  // 2026-07-16) — so every one of these is empty outside 'myMap', not just
  // visually absent from the toggle row. All three are useMemo'd (not just
  // the filtering — the `[]` empty case too) so MapSurface's React.memo
  // isn't defeated by a fresh array reference on every render (review
  // finding — this is exactly the native-bridge-churn cost the file's own
  // memo comment warns about; `pins` used to be passed straight through
  // before My Map's layer toggle needed to sometimes hide it).
  const mapPins = useMemo(
    () => (mode === 'myMap' && visibleLayers.spots ? pins : []),
    [mode, visibleLayers.spots, pins]
  );
  const mapRoutes = useMemo<RouteLayerRoute[]>(
    () => (mode === 'myMap' && visibleLayers.routes ? routesForLayer(routes) : []),
    [mode, visibleLayers.routes, routes]
  );
  const mapTraces = useMemo<TraceLayerTrace[]>(
    () => (mode === 'myMap' && visibleLayers.traces ? sessionTracks(sessions) : []),
    [mode, visibleLayers.traces, sessions]
  );

  // The one place a coordinate becomes a new-spot.tsx push — My Map's
  // long-hold, Explore's "Pin this location", and PointForecastSheet's own
  // pin button all funnel through this rather than each rebuilding the
  // param shape (review finding: three near-identical copies had already
  // drifted apart in argument order).
  const pushNewSpotAt = useCallback(
    (coord: LngLat) => {
      router.push({
        pathname: '/new-spot',
        params: { lat: String(coord[1]), lng: String(coord[0]) },
      });
    },
    [router]
  );

  // My Map's creation door (REFRAME AMENDMENT): long-hold anywhere on the
  // map → new-spot.tsx with the held coordinate prefilled. Wired only when
  // `mode === 'myMap' && !isRecording` below — not internally guarded here —
  // so a live recording or Explore never even receives the handler.
  const onLongPressMyMap = pushNewSpotAt;

  async function onSearchSubmit() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      setSearchResults(await geocode(q));
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }
  function onChangeSearchQuery(text: string) {
    setSearchQuery(text);
    setSearched(false);
  }
  function onPickSearchResult(result: GeocodeResult) {
    flyToRequestIdRef.current += 1;
    setFlyTo({ center: [result.lng, result.lat], zoom: 12, requestId: flyToRequestIdRef.current });
    setSearchResults([]);
    setSearchQuery('');
    setSearched(false);
    setSearchOpen(false);
  }

  // Explore's two crosshair actions — both read "wherever the reticle
  // points" on demand via getCenter(), never a continuously-tracked region
  // (map-tab.md REFRAME AMENDMENT: "the crosshair IS the placement model").
  async function onExploreViewForecast() {
    const coord = await mapSurfaceRef.current?.getCenter();
    if (coord) setForecastCoord(coord);
  }
  async function onExplorePinLocation() {
    const coord = await mapSurfaceRef.current?.getCenter();
    if (coord) pushNewSpotAt(coord);
  }

  // ─── Route builder (Explore-2 takeover state) ─────────────────────────────
  // Door 2 (Explore's "Build a route") and door 1 (Training's "+ New Route"
  // deep-link, build=1) both land here. Opens on Explore with a sensible sport;
  // the overlay lets the user change it.
  function openBuilder(activityId?: string) {
    const startId = activityId ?? (recordsOnMap(armed) ? armed.id : 'hike');
    builder.reset(startId);
    setBuilderActive(true);
    setMode('explore');
  }
  // "Drop point" reads wherever the crosshair points — the same placement model
  // as Explore's "Pin this location" (getCenter → {lat,lng}; getCenter is [lng,lat]).
  async function onBuilderDropWaypoint() {
    const coord = await mapSurfaceRef.current?.getCenter();
    if (coord) void builder.addWaypoint({ lat: coord[1], lng: coord[0] });
  }
  // Single teardown for every exit path (Cancel, save, leaving Explore).
  function closeBuilder() {
    setBuilderActive(false);
    builder.clear();
  }
  const exitBuilder = closeBuilder;
  async function onSaveBuilderRoute(name: string) {
    const saved = await builder.save(name);
    if (!saved) return;
    reloadRoutes(); // surface it on My Map's routes layer
    closeBuilder();
    Alert.alert('Route saved', `“${saved.name}” is on your map.`);
  }
  function onToggleBuilderFreeline(freeline: boolean) {
    void builder.setMode(freeline ? 'freeline' : builderNaturalMode);
  }
  function onChangeBuilderSport() {
    setPickerPurpose('builder');
    setPickerVisible(true);
  }

  function onPickActivity(activity: Activity) {
    if (pickerPurpose === 'builder') {
      void builder.setActivity(activity.id);
      setPickerVisible(false);
      setPickerPurpose('arm');
      return;
    }
    setArmOverride(activity);
    setPickerVisible(false);
  }
  function onPickBody() {
    if (pickerPurpose === 'builder') {
      // Body sports have no routes — ignore the pick, keep the builder open.
      setPickerVisible(false);
      setPickerPurpose('arm');
      return;
    }
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
    // Pin the route this recording is following (if any) NOW, at the moment
    // it actually starts — never read live at stop time (see pinnedFollowRoute).
    setPinnedFollowRoute(activeFollowRoute);
    void recorder.start({ activityId: armed.id, element: recordingElementOf(armed) });
  }

  // ─── "Import a track" door (map-tab §5 Ingestion — rides M2) ──────────────
  // The other half of "records a track or ingests one": a watch-exported GPX
  // or a vario's IGC lands in the SAME save sheet as a live recording. The
  // log-session importers stay put until this door is device-verified
  // (never-lose-access gate — retirement is a follow-up, not this build).
  async function onImportTrack() {
    // A pending recovery owns the pre-start card — resolve it before
    // opening a second save flow over it (Record is gated the same way).
    if (importing || recorder.recoverable != null) return;
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
      setSaveDraft({
        activity: armed,
        track: {
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
        },
      });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Could not read that file as a track.');
    } finally {
      setImporting(false);
    }
  }

  /** Stop (live or recovered) → save sheet. The sheet gets the activity the
   *  recording was STARTED under (off the buffer row), never the current
   *  `armed` — a Home deep-link landing mid-recording must not relabel a
   *  session already in progress (review finding).
   *
   *  `fromRecovery` (review finding): a recovered orphan predates this
   *  screen instance's own onRecord() call — it was never paired with
   *  pinnedFollowRoute, so whatever route happens to be loaded now (from an
   *  unrelated later deep-link) must NOT be attributed to it. Recovered
   *  recordings always save routeless; only a live Stop can tag a route. */
  async function onStopToSave(opts: { fromRecovery?: boolean } = {}) {
    const result = await recorder.stop();
    if (result == null) return;
    if (result.points.length < 2) {
      // Nothing usable survived (stopped seconds in, or an orphan killed
      // early) — clear it honestly rather than opening a sheet that can't
      // save.
      await recorder.discard(result.recordingId);
      return;
    }
    setSaveDraft({
      activity: activityById(result.activityId) ?? armed,
      track: {
        points: result.points,
        origin: { kind: 'record' },
        recordingId: result.recordingId,
        ...(!opts.fromRecovery && pinnedFollowRoute ? { routeId: pinnedFollowRoute.id } : {}),
      },
    });
  }

  const ArmIcon = iconFor(armed.icon);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <MapSurface
        ref={mapSurfaceRef}
        center={center}
        zoom={zoom}
        pins={mapPins}
        onPressPin={onPressPin}
        guidePath={displayFollowRoute?.points}
        routes={mapRoutes}
        onPressRoute={onPressRoute}
        traces={mapTraces}
        onLongPress={mode === 'myMap' && !isRecording ? onLongPressMyMap : undefined}
        flyTo={flyTo}
        liveLoc={liveLoc}
        draftRoute={builderActive ? builder.routePoints : undefined}
        draftWaypoints={builderActive ? builder.waypoints : undefined}
      />

      {/* Mode switcher — base chrome, structurally absent (not hidden) while
          recording is locked (live, or an orphan awaiting Finish/Discard):
          Record lives inside My Map now, so there is nothing to switch away
          to until whatever's live or unresolved is dealt with. */}
      {!mapLocked && !builderActive ? (
        <View style={{ position: 'absolute', top: insets.top + theme.spacing[3], left: theme.spacing[6], right: theme.spacing[6] }}>
          <SegmentedControl
            options={[
              { value: 'myMap', label: 'My Map' },
              { value: 'explore', label: 'Explore' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </View>
      ) : null}

      {/* Location search — base chrome, both modes (map-tab.md REFRAME
          AMENDMENT). A quiet icon door until tapped, then a submit-triggered
          field + results list; recenters via MapSurface's declarative
          `flyTo` prop on a result tap. */}
      {!isRecording && !searchOpen && !builderActive ? (
        <Pressable
          onPress={() => setSearchOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Search for a place"
          style={{
            position: 'absolute',
            top: insets.top + theme.spacing[3] + 52,
            right: theme.spacing[6],
            width: 40,
            height: 40,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceRaised,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Search size={18} color={theme.colors.accent} strokeWidth={1.75} />
        </Pressable>
      ) : null}

      {!isRecording && searchOpen && !builderActive ? (
        <Card
          style={{
            position: 'absolute',
            top: insets.top + theme.spacing[3] + 52,
            left: theme.spacing[6],
            right: theme.spacing[6],
            gap: theme.spacing[2],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] }}>
            <Field
              value={searchQuery}
              onChangeText={onChangeSearchQuery}
              placeholder="Search a place"
              keyboardType="default"
              style={{ flex: 1 }}
            />
            <Pressable
              onPress={() => {
                setSearchOpen(false);
                setSearchResults([]);
                setSearchQuery('');
                setSearched(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close search"
              hitSlop={8}
              style={{ padding: theme.spacing[2] }}
            >
              <X size={18} color={theme.colors.textMuted} strokeWidth={1.75} />
            </Pressable>
          </View>
          <Button
            label={searching ? 'Searching…' : 'Search'}
            onPress={() => void onSearchSubmit()}
            disabled={searching || searchQuery.trim().length === 0}
          />
          {searchResults.map((result, i) => (
            <Pressable
              key={`${result.lat}-${result.lng}-${i}`}
              onPress={() => onPickSearchResult(result)}
              accessibilityRole="button"
              style={{ paddingVertical: theme.spacing[2] }}
            >
              <Text variant="bodySm">{result.label}</Text>
            </Pressable>
          ))}
          {searched && !searching && searchResults.length === 0 ? (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              No results found.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* My Map's layer toggle row — Spots/Routes/My traces. Explore has no
          layers to toggle (blank crosshair canvas, Dylan 2026-07-16). */}
      {mode === 'myMap' && !isRecording ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + theme.spacing[3] + 52,
            left: theme.spacing[6],
            flexDirection: 'row',
            gap: theme.spacing[2],
          }}
        >
          {(
            [
              { key: 'spots', label: 'Spots' },
              { key: 'routes', label: 'Routes' },
              { key: 'traces', label: 'My traces' },
            ] as const
          ).map((layer) => {
            const on = visibleLayers[layer.key];
            return (
              <Pressable
                key={layer.key}
                onPress={() => setVisibleLayers((prev) => ({ ...prev, [layer.key]: !prev[layer.key] }))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${layer.label} layer, ${on ? 'on' : 'off'}`}
                style={chipStyle(theme, on)}
              >
                <Text variant="label" color={on ? theme.colors.surface : theme.colors.text}>
                  {layer.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Sport-arm control — floats below the header band, left side. Hidden
          while recording: the sport is part of the running recording (the
          save sheet is where a wrong arm gets corrected). My Map only —
          Explore has no arm to set, nothing records from there. */}
      {mode === 'myMap' && !isRecording ? (
        <Pressable
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Armed sport: ${armed.label}. Tap to change.`}
          style={{
            position: 'absolute',
            top: insets.top + theme.spacing[3] + 100,
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
          home-indicator safe area (src/components/Screen.tsx convention).
          My Map only — Record lives inside it now. */}
      {mode === 'myMap' ? (
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
              guidePath={pinnedFollowRoute?.points}
              followName={pinnedFollowRoute?.name}
              onStop={() => void onStopToSave()}
              onDiscard={() => {
                Alert.alert('Discard this recording?', 'The track will be deleted.', [
                  { text: 'Keep recording', style: 'cancel' },
                  {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: () => {
                      setPinnedFollowRoute(null);
                      void recorder.discard();
                    },
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
                  onFinish={() => void onStopToSave({ fromRecovery: true })}
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
              {recorder.status === 'denied' ? (
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  Location was declined, so there's no track to record — turn it on for the app in
                  Settings, or log the session by hand from Home.
                </Text>
              ) : null}
              {justSaved ? (
                <Text variant="label" color={theme.colors.positive}>
                  Session saved.
                </Text>
              ) : null}
              {activeFollowRoute ? (
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  Following {activeFollowRoute.name}
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
      ) : null}

      {/* Explore — a fixed center crosshair reticle over a blank canvas (no
          spots/routes/traces layer, Dylan 2026-07-16): pan the map under it,
          Windy-style — this IS the placement model, no tap-gesture spike.
          `pointerEvents="none"` on the glyph itself so it never eats the
          map's own pan/zoom gestures. The crosshair is shared by both Explore's
          browse actions and the Explore-2 route-builder takeover — "Drop point"
          reads it the same way "Pin this location" does. */}
      {mode === 'explore' ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Crosshair size={32} color={theme.colors.accent} strokeWidth={1.5} />
          </View>

          {builderActive && builderActivity ? (
            <RouteBuilderOverlay
              sportLabel={builderActivity.label}
              sportIcon={builderActivity.icon}
              isFreeline={builder.mode === 'freeline'}
              freelineForced={builderNaturalMode === 'freeline'}
              snapLabel={builderNaturalMode === 'river' ? 'Snap to river' : 'Snap to trails'}
              waypointCount={builder.waypointCount}
              distanceLabel={builderDistanceLabel}
              honestyLabel={builder.honestyLabel}
              canSave={builder.canSave}
              pending={builder.pending}
              onDropWaypoint={() => void onBuilderDropWaypoint()}
              onUndo={builder.undo}
              onClear={builder.clear}
              onToggleFreeline={onToggleBuilderFreeline}
              onChangeSport={onChangeBuilderSport}
              onSave={(name) => void onSaveBuilderRoute(name)}
              onExit={exitBuilder}
              topInset={insets.top}
              bottomInset={insets.bottom}
            />
          ) : (
            <View
              style={{
                position: 'absolute',
                left: theme.spacing[6],
                right: theme.spacing[6],
                bottom: theme.spacing[4],
                gap: theme.spacing[3],
              }}
            >
              <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                <Button
                  label="View forecast"
                  onPress={() => void onExploreViewForecast()}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Pin this location"
                  variant="outline"
                  onPress={() => void onExplorePinLocation()}
                  style={{ flex: 1 }}
                />
              </View>
              <Button label="Build a route" variant="outline" onPress={() => openBuilder()} />
            </View>
          )}
        </>
      ) : null}

      <PointForecastSheet
        visible={forecastCoord != null}
        coord={forecastCoord}
        onClose={() => setForecastCoord(null)}
        onPin={(coord) => {
          setForecastCoord(null);
          pushNewSpotAt(coord);
        }}
      />

      <ElementPickerSheet
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          setPickerPurpose('arm');
        }}
        mostRecent={mostRecent}
        onPickActivity={onPickActivity}
        onPickBody={onPickBody}
      />

      <SaveRecordingSheet
        visible={saveDraft != null}
        activity={saveDraft?.activity ?? armed}
        track={saveDraft?.track ?? null}
        onSaved={() => {
          setSaveDraft(null);
          setJustSaved(true);
          setPinnedFollowRoute(null);
          reloadSessions();
          void recorder.attach(); // re-probe: a failed buffer clear surfaces NOW, not later
        }}
        onDiscarded={() => {
          setSaveDraft(null);
          setPinnedFollowRoute(null);
          void recorder.attach(); // row is gone; clears any recoverable state
        }}
        onClose={() => {
          // Backing out is NOT a discard: the stopped recording's buffer row
          // survives, so re-probe surfaces it as the recovery banner. The
          // pin clears anyway — if it re-surfaces via the recovery banner,
          // onStopToSave's fromRecovery path never tags a route regardless.
          setSaveDraft(null);
          setPinnedFollowRoute(null);
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
  guidePath,
  followName,
  onStop,
  onDiscard,
}: {
  recorder: BackgroundRecorder;
  armed: Activity;
  distanceUnit: 'km' | 'mi';
  guidePath?: Route['points'];
  followName?: string;
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
  const startedMs = recorder.startedAt ? Date.parse(recorder.startedAt) : NaN;
  // NaN-guarded (a corrupt startedAt must not render "NaN:NaN" forever).
  const elapsed = formatDurationClock(
    Number.isFinite(startedMs) ? Math.max(0, (nowMs - startedMs) / 1000) : 0
  );
  // Distance accumulates incrementally in the hook — the panel never
  // re-walks a multi-hour track (review finding); GPS quality is gate-aware
  // (only the drop counter can honestly say "weak" — stored accuracies
  // never exceed the gate).
  const distanceM = recorder.distanceM;
  const gpsLevel = recorder.gpsQuality;

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

      {followName ? (
        <Text variant="bodySm" color={theme.colors.textMuted}>
          Following {followName}
        </Text>
      ) : null}

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
            {distanceM > 0 ? `${numStr(metersToDisplay(distanceM, distanceUnit), 2)} ${distanceUnit}` : '—'}
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
        <RoutePreview path={recorder.points} guidePath={guidePath} height={84} />
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
