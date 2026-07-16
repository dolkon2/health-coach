/**
 * Routes — the full route library (training-tab.md §3 C, reached from
 * Training's "Routes →" shelf header). Browse-only, sorted `updatedAt` desc.
 *
 * Creation: the ONLY door built this session is "Import GPX" (routes-spec
 * P2.5's builder-independent slot, per map-tab.md §5 Ingestion / training-
 * tab.md §3 C — mounted here, not gated on Map's builder pass). Two other
 * doors the specs name as eventually living here — "+ New Route → Map build
 * mode" (gated on map-tab M6, itself gated on Explore/Phase 4) and "save a
 * logged session as a route" (routes-spec P2.5's other promotion path, a
 * log-session.tsx affordance) — are NOT built this session; flagged in the
 * dev-log rather than silently expanding scope. Without at least one working
 * creation door the entity + shelf + follow this session builds would have
 * nothing to browse or follow, so GPX import ships to make the feature real.
 */
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, Text, Card, Button, Field, RouteCard, ElementPickerSheet } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { listRoutes, createRoute } from '@/storage/routes';
import { countSessionsByRoute } from '@/storage/observations';
import { parseGpx } from '@/lib/gpxImport';
import { pairTrackFormat } from '@/lib/recording/recordingSave';
import { uuidv7 } from '@/lib/id';
import type { Activity } from '@/lib/activity';
import type { Route, RoutePoint } from '@core/route';

type PendingImport = {
  points: RoutePoint[];
  name: string;
  // Never guessed — the file names no sport, so the user always picks one.
  activity: Activity | null;
};

export default function RoutesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { distanceUnit } = useSettings();
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [effortCounts, setEffortCounts] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const [list, counts] = await Promise.all([listRoutes(), countSessionsByRoute()]);
    setRoutes(list);
    setEffortCounts(Object.fromEntries(counts));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function onImportGpx() {
    if (importing) return;
    setImporting(true);
    setImportError(null);
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
      const parsed = parseGpx(text);
      if (parsed.points.length < 2) {
        setImportError('That file has no usable track points.');
        return;
      }
      // Strip timestamps at the door — a Route carries no "when" (core/route.ts).
      const points: RoutePoint[] = parsed.points.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        ...(p.eleM != null ? { eleM: p.eleM } : {}),
      }));
      const suggestedName =
        parsed.name ?? asset.name?.replace(/\.[^.]+$/, '') ?? 'Imported route';
      setPending({ points, name: suggestedName, activity: null });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Could not read that file as a track.');
    } finally {
      setImporting(false);
    }
  }

  function pickActivity(a: Activity) {
    setPickerVisible(false);
    // GPX is a gps-surface-only format (Earth/Water) — the same pairing
    // check recordingSave.ts uses everywhere else a GPX file meets an
    // activity. recordsOnMap() alone would also accept sky (paragliding
    // never carries a 'gpx' track anywhere else in the app).
    const mismatch = pairTrackFormat(a, 'gpx');
    if (mismatch) {
      setImportError(mismatch);
      return;
    }
    setImportError(null);
    setPending((p) => (p ? { ...p, activity: a } : p));
  }

  async function saveImport() {
    if (!pending || saving) return;
    if (!pending.activity) {
      setImportError('Pick which sport this route is for.');
      return;
    }
    if (!pending.name.trim()) {
      setImportError('Name this route.');
      return;
    }
    setSaving(true);
    setImportError(null);
    try {
      await createRoute({
        id: uuidv7(),
        name: pending.name.trim(),
        activityId: pending.activity.id,
        source: 'gpx',
        points: pending.points,
        visibility: 'private',
      });
      setPending(null);
      await reload();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Could not save that route.');
    } finally {
      setSaving(false);
    }
  }

  const sortedRoutes = useMemo(() => routes ?? [], [routes]);

  return (
    <Screen scroll>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="displayLg">Routes</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
          <Button
            label="+ New Route"
            variant="secondary"
            size="sm"
            onPress={() => router.push({ pathname: '/map', params: { build: '1' } })}
          />
          <Button
            label={importing ? 'Reading file…' : 'Import GPX'}
            variant="secondary"
            size="sm"
            disabled={importing}
            onPress={() => void onImportGpx()}
          />
        </View>
      </View>

      {pending ? (
        <Card style={{ marginTop: theme.spacing[5], gap: theme.spacing[3] }}>
          <Text variant="label" color={theme.colors.textSecondary}>
            Name this route
          </Text>
          <Field
            value={pending.name}
            onChangeText={(v) => setPending((p) => (p ? { ...p, name: v } : p))}
            keyboardType="default"
            placeholder="Route name"
          />
          <Button
            label={pending.activity?.label ?? 'Pick a sport'}
            variant="outline"
            onPress={() => setPickerVisible(true)}
          />
          {importError ? (
            <Text variant="bodySm" color={theme.colors.negative}>
              {importError}
            </Text>
          ) : null}
          <Button label={saving ? 'Saving…' : 'Save route'} onPress={() => void saveImport()} />
          <Button label="Cancel" variant="outline" onPress={() => setPending(null)} />
        </Card>
      ) : importError ? (
        <Text
          variant="bodySm"
          color={theme.colors.negative}
          style={{ marginTop: theme.spacing[3] }}
        >
          {importError}
        </Text>
      ) : null}

      <View style={{ marginTop: theme.spacing[5], gap: theme.spacing[3] }}>
        {routes === null ? null : sortedRoutes.length === 0 ? (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              Build a route on the Map, or import a GPX file, to add your first route.
            </Text>
          </Card>
        ) : (
          sortedRoutes.map((r) => (
            <RouteCard
              key={r.id}
              route={r}
              distanceUnit={distanceUnit}
              effortCount={effortCounts[r.id]}
              onPress={() => router.push({ pathname: '/route/[id]', params: { id: r.id } })}
            />
          ))
        )}
      </View>

      <ElementPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        mostRecent={{}}
        onPickActivity={pickActivity}
        onPickBody={() => {
          setPickerVisible(false);
          setImportError('A GPX track only makes sense for an Earth or Water sport.');
        }}
      />
    </Screen>
  );
}
