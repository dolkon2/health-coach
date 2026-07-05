/**
 * Log Session — a modal from Today and the Training tab.
 *
 * Step 1 picks an *activity* (identity tiles — Today's quick-log path); the
 * Training tab deep-links straight to step 2 with an activity already chosen. Step
 * 2 is *surface*-dependent, resolved from the activity via the registry
 * (lib/activity.ts): a gym set logger with a required movement-pattern tag per
 * exercise, a GPS distance/HR form, a climbing style + sends form, or a "coming
 * next" stub for the swim/practice surfaces (Passes 5–6). All share a duration,
 * effort and notes footer.
 *
 * On save the form maps to a tier-1 manual session Observation (lib/session.ts
 * builds it) whose fidelity follows the surface (gym 0.95, manual GPS 0.5), and
 * Today re-fetches on focus to show it. The movement-pattern requirement is
 * enforced by the same builder the test drives, so an untagged set can't reach
 * storage.
 */
import { useEffect, useState } from 'react';
import { View, Pressable, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  Card,
  Field,
  ChipSelect,
  RestTimer,
  GymExerciseEditor,
  RemoveButton,
  Checkbox,
  RoutePreview,
  RouteMap,
  ElevationProfile,
  Splits,
  GpsRecorderPanel,
} from '@/components';
import {
  ENERGY_SYSTEMS,
  CLIMB_STYLES,
  SWIM_MODES,
  SWIM_STROKES,
  EFFORT,
} from '@/lib/sessionFormOptions';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { useExercisePatternMemory } from '@/hooks/useExercisePatternMemory';
import { useRestTimer } from '@/hooks/useRestTimer';
import {
  createObservation,
  getObservationById,
  updateObservation,
} from '@/storage/observations';
import { deviceTz } from '@/lib/date';
import { uuidv7 } from '@/lib/id';
import { parseGpx } from '@/lib/gpxImport';
import type { TrackSummary } from '@/lib/gpsTrack';
import { metersToDisplay } from '@/lib/units';
import {
  applyElevationGainEdit,
  enduranceWithRoute,
  emptySessionForm,
  emptyExerciseDraft,
  emptySetDraft,
  validateSessionForm,
  buildSessionObservation,
  sessionFormFromObservation,
  pruneGearIdsForCategories,
  resolveSurface,
  type SessionForm,
  type ExerciseDraft,
  type SetDraft,
  type ClimbStyle,
  type SwimMode,
} from '@/lib/session';
import { activityById, headlineActivities, moreActivities, type Activity } from '@/lib/activity';
import { listGear, type GearRecord } from '@/storage/gear';
import type { ElevationGainSource, MovementPattern, ObservationOf } from '@core/observation';

// Descriptive captions for elevation-gain provenance (E2). Rendered only when a
// source is known — pre-E2 sessions carry none and show nothing.
const ELEVATION_SOURCE_LABELS: Record<ElevationGainSource, string> = {
  gps: 'GPS',
  barometric: 'barometric',
  dem: 'terrain model',
  manual: 'entered by hand',
};

/**
 * A fresh form pre-set to an `activity` — used when the screen opens via a
 * deep-link that already chose one (the Training tab's activity picker, or the
 * quick-log picker). The identity drives the surface; `modality` stays null and is
 * resolved from the activity. Seeds the gym surface with one empty exercise and the
 * GPS surface with the activity's default energy system, so the detail step has
 * something to fill.
 */
function seededFormForActivity(a: Activity): SessionForm {
  const base = emptySessionForm();
  return {
    ...base,
    activity: a.id,
    modality: null,
    gym:
      a.surface === 'gym'
        ? { exercises: [emptyExerciseDraft(uuidv7(), uuidv7())] }
        : base.gym,
    endurance: a.defaultEnergySystem
      ? { ...base.endurance, energySystem: a.defaultEnergySystem }
      : base.endurance,
  };
}

export default function LogSessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit, distanceUnit, restTimerSec, defaultPoolLengthM } = useSettings();
  const patternMemory = useExercisePatternMemory();
  const restTimer = useRestTimer();
  const { editId, activity: activityParam } = useLocalSearchParams<{
    editId?: string;
    activity?: string;
  }>();
  const isEdit = typeof editId === 'string' && editId.length > 0;
  // A deep-link from the Training tab pre-selects an activity, skipping step 1.
  // Every registry activity has a surface (gym/gps/climbing render; swim/practice
  // show a "coming next" stub), so a known id always resolves.
  const presetActivity =
    !isEdit && typeof activityParam === 'string' ? activityById(activityParam) : undefined;

  const [form, setForm] = useState<SessionForm>(() =>
    presetActivity ? seededFormForActivity(presetActivity) : emptySessionForm()
  );
  // Edit-mode or a preset skips the activity picker — the identity is already known.
  const [step, setStep] = useState<'activity' | 'detail'>(
    isEdit || presetActivity ? 'detail' : 'activity'
  );
  const [original, setOriginal] = useState<ObservationOf<'session'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false); // long tail in the activity picker
  // Active quiver for the gear chip row (E1). Empty until loaded — and when the
  // user owns no gear the row never renders (zero-clutter default), so a load
  // failure just means no chips, never an error state.
  const [gearOptions, setGearOptions] = useState<GearRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    listGear()
      .then((g) => {
        if (!cancelled) setGearOptions(g);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Dismissal that survives a missing back-stack (e.g. when the screen was
  // deep-linked or opened with no parent route) — fall back to the Today tab
  // instead of dispatching a GO_BACK action no navigator can handle.
  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Prefill from the existing session when editing.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    getObservationById(editId!)
      .then((obs) => {
        if (cancelled || !obs || obs.kind !== 'session') return;
        const s = obs as ObservationOf<'session'>;
        setOriginal(s);
        setForm(
          sessionFormFromObservation(s, { weightUnit, distanceUnit }, () => uuidv7())
        );
      })
      .catch(() => {
        if (!cancelled) setError('Could not load session.');
      });
    return () => {
      cancelled = true;
    };
  }, [editId, isEdit, weightUnit, distanceUnit]);

  // Prefill the pool length from the remembered default when entering the swim
  // surface — only when empty, so it never overwrites an entered or loaded value.
  useEffect(() => {
    if (resolveSurface(form) !== 'swim') return;
    setForm((f) =>
      f.swim.poolLengthM === ''
        ? { ...f, swim: { ...f.swim, poolLengthM: String(defaultPoolLengthM) } }
        : f
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.activity, form.modality, defaultPoolLengthM]);

  const update = (patch: Partial<SessionForm>) => setForm((f) => ({ ...f, ...patch }));

  function pickActivity(a: Activity) {
    setForm((f) => ({
      ...f,
      activity: a.id,
      modality: null,
      // A gear tag survives an activity switch only if the new activity's chip
      // row can still show it — a tag outside a.gearCategories would be
      // invisible yet still saved, silently accruing this session to another
      // sport's gear (E1, ⚑ E-4).
      gearIds: pruneGearIdsForCategories(f.gearIds, gearOptions, a.gearCategories),
      // Seed the gym logger with one empty exercise so there's something to fill.
      gym: a.surface === 'gym' && f.gym.exercises.length === 0
        ? { exercises: [emptyExerciseDraft(uuidv7(), uuidv7())] }
        : f.gym,
      endurance: a.defaultEnergySystem
        ? { ...f.endurance, energySystem: a.defaultEnergySystem }
        : f.endurance,
    }));
    setStep('detail');
  }

  // ─── Gym set-logger mutations (immutable updates) ──────────────────────────

  function mutateExercise(id: string, fn: (ex: ExerciseDraft) => ExerciseDraft) {
    setForm((f) => ({
      ...f,
      gym: { exercises: f.gym.exercises.map((ex) => (ex.id === id ? fn(ex) : ex)) },
    }));
  }

  function setExerciseName(id: string, name: string) {
    mutateExercise(id, (ex) => {
      // Default the pattern from memory only while it's still untagged — never
      // overwrite a choice the user already made.
      const remembered = ex.movementPattern === null ? patternMemory.suggest(name) : null;
      return { ...ex, name, movementPattern: ex.movementPattern ?? remembered };
    });
  }

  function setExercisePattern(id: string, movementPattern: MovementPattern) {
    mutateExercise(id, (ex) => ({ ...ex, movementPattern }));
  }

  function mutateSet(exId: string, setId: string, fn: (s: SetDraft) => SetDraft) {
    mutateExercise(exId, (ex) => ({
      ...ex,
      sets: ex.sets.map((s) => (s.id === setId ? fn(s) : s)),
    }));
  }

  function addSet(exId: string) {
    mutateExercise(exId, (ex) => ({ ...ex, sets: [...ex.sets, emptySetDraft(uuidv7())] }));
  }

  function removeSet(exId: string, setId: string) {
    mutateExercise(exId, (ex) => ({ ...ex, sets: ex.sets.filter((s) => s.id !== setId) }));
  }

  // Marking a set done stamps the moment it finished; the session's duration is
  // derived from the spread of these (deriveSessionDuration). Finishing a set also
  // auto-starts the rest timer; tapping again clears the stamp and cancels the rest.
  function completeSet(exId: string, setId: string) {
    const set = form.gym.exercises
      .find((e) => e.id === exId)
      ?.sets.find((s) => s.id === setId);
    const becomingDone = set ? !set.completedAt : false;
    mutateSet(exId, setId, (s) => ({
      ...s,
      completedAt: s.completedAt ? undefined : new Date().toISOString(),
    }));
    if (becomingDone) restTimer.start(restTimerSec);
    else restTimer.stop();
  }

  function addExercise() {
    setForm((f) => ({
      ...f,
      gym: { exercises: [...f.gym.exercises, emptyExerciseDraft(uuidv7(), uuidv7())] },
    }));
  }

  function removeExercise(exId: string) {
    setForm((f) => ({
      ...f,
      gym: { exercises: f.gym.exercises.filter((ex) => ex.id !== exId) },
    }));
  }

  // ─── Climbing sends ────────────────────────────────────────────────────────

  function addSend() {
    setForm((f) => ({
      ...f,
      climb: {
        ...f.climb,
        sends: [...f.climb.sends, { id: uuidv7(), grade: '', attempts: '', sent: false }],
      },
    }));
  }

  function mutateSend(id: string, patch: Partial<{ grade: string; attempts: string; sent: boolean }>) {
    setForm((f) => ({
      ...f,
      climb: {
        ...f.climb,
        sends: f.climb.sends.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      },
    }));
  }

  function removeSend(id: string) {
    setForm((f) => ({
      ...f,
      climb: { ...f.climb, sends: f.climb.sends.filter((s) => s.id !== id) },
    }));
  }

  // ─── GPX import (Layer 2: gate-free route enrichment) ─────────────────────
  // Pick a .gpx exported from Garmin Connect / Slopes / Gaia / AllTrails, parse
  // it client-side, and prefill the form: distance/duration/elevation land in
  // the same editable fields (the user can still correct them); the geometry +
  // provenance ride on the form and are written by buildSessionObservation.

  async function importGpxFile() {
    if (importing) return;
    setImporting(true);
    setError(null);
    // Lazy-load the picker: dev clients built before this pass don't carry the
    // ExpoDocumentPicker native module, and a static import would break this
    // whole route on them. Loaded here, an old build degrades to a message
    // instead (same app, honest capability line).
    let DocumentPicker: typeof import('expo-document-picker');
    let FileSystem: typeof import('expo-file-system');
    try {
      DocumentPicker = await import('expo-document-picker');
      FileSystem = await import('expo-file-system');
    } catch {
      setImporting(false);
      setError('File import needs an updated dev build of the app — rebuild to enable it.');
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || res.assets.length === 0) return;
      const asset = res.assets[0];
      const xml = await FileSystem.readAsStringAsync(asset.uri);
      const gpx = parseGpx(xml);
      setForm((f) => ({
        ...f,
        durationMin:
          gpx.durationMin != null ? String(Math.max(1, Math.round(gpx.durationMin))) : f.durationMin,
        // Rebuilt via enduranceWithRoute (never spread) so a prior route's
        // gain/source/captureMeta can't linger on this file's geometry. The
        // gain's label comes from the parser itself: 'gps' only for a recorded
        // <trk>; a planned <rte>'s gain carries no source (⚑ E-9 — the device
        // is unknowable from a file; understate, never overstate).
        endurance: enduranceWithRoute(
          f.endurance,
          {
            gpsPath: gpx.points,
            ...(gpx.distanceM > 0
              ? {
                  distance: String(
                    Math.round(metersToDisplay(gpx.distanceM, distanceUnit) * 100) / 100
                  ),
                }
              : {}),
            ...(gpx.elevationGainM != null ? { elevationGainM: gpx.elevationGainM } : {}),
            ...(gpx.elevationGainSource != null
              ? { elevationGainSource: gpx.elevationGainSource }
              : {}),
          },
          {
            importMeta: {
              format: 'gpx' as const,
              ...(asset.name ? { filename: asset.name } : {}),
              ...(gpx.startTime ? { startTime: gpx.startTime } : {}),
            },
          }
        ),
        ...(gpx.name && f.notes.trim() === '' ? { notes: gpx.name } : {}),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file as GPX.');
    } finally {
      setImporting(false);
    }
  }

  // ─── Live GPS capture (Layer 1 / rung 2: in-app phone tracking) ────────────
  // The recorder hands back the same GeoPoint[] a GPX import does; we prefill the
  // editable distance/duration and attach the geometry + capture provenance, so
  // buildSessionObservation writes a manual-source session at live-phone fidelity
  // (0.7), dated to the recording's start. enduranceWithRoute rebuilds (never
  // spreads) so a prior file import's provenance can't linger on a fresh recording.
  function applyCapturedRoute(summary: TrackSummary) {
    setForm((f) => ({
      ...f,
      durationMin:
        summary.durationSec >= 60
          ? String(Math.max(1, Math.round(summary.durationSec / 60)))
          : f.durationMin,
      endurance: enduranceWithRoute(
        f.endurance,
        {
          gpsPath: summary.points,
          ...(summary.distanceM > 0
            ? {
                distance: String(
                  Math.round(metersToDisplay(summary.distanceM, distanceUnit) * 100) / 100
                ),
              }
            : {}),
          // Gain computed from the phone's GPS-elevation fixes → 'gps' (⚑ E-9).
          ...(summary.elevationGainM != null
            ? { elevationGainM: summary.elevationGainM, elevationGainSource: 'gps' as const }
            : {}),
        },
        { captureMeta: { startTime: summary.startTime ?? new Date().toISOString() } }
      ),
    }));
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  const validationError = validateSessionForm(form);

  async function handleSave() {
    if (validationError || saving) return;
    if (isEdit && !original) return; // edit clicked before prefill resolved
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      if (isEdit && original) {
        // Preserve id, occurredAt, tz, source, fidelity — the edit only
        // rebuilds the user-facing payload + notes.
        const built = buildSessionObservation(form, {
          id: original.id,
          now: original.occurredAt,
          tz: original.tz,
          weightUnit,
          distanceUnit,
        });
        await updateObservation({
          ...built,
          source: original.source,
          fidelity: original.fidelity,
        });
      } else {
        const obs = buildSessionObservation(form, {
          id: uuidv7(),
          now: new Date().toISOString(),
          tz: deviceTz(),
          weightUnit,
          distanceUnit,
        });
        await createObservation(obs);
      }
      dismiss();
    } catch {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  // Explicit dismiss affordance in the header — the modal swipe-down can be
  // missed, and the in-form "‹ activity" link only steps back to the picker,
  // not out of the modal.
  const headerScreen = (
    <Stack.Screen
      options={{
        title: isEdit ? 'Edit session' : 'Log session',
        headerLeft: () => (
          <Pressable onPress={dismiss} accessibilityRole="button" hitSlop={12}>
            <Text variant="body" color={theme.colors.sandstone}>Cancel</Text>
          </Pressable>
        ),
      }}
    />
  );

  if (step === 'activity') {
    const headline = headlineActivities();
    const more = moreActivities();
    return (
      <Screen scroll>
        {headerScreen}
        <Text variant="label" color={theme.colors.sandstone}>
          Log session
        </Text>
        <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
          What did you do?
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing[3],
            marginTop: theme.spacing[8],
          }}
        >
          {headline.map((a) => (
            <ActivityPickTile key={a.id} activity={a} onPress={() => pickActivity(a)} />
          ))}
        </View>
        <Pressable
          onPress={() => setShowMore((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showMore ? 'Show fewer activities' : 'Show more activities'}
          style={{ marginTop: theme.spacing[4] }}
        >
          <Text variant="label" color={theme.colors.textMuted}>
            {showMore ? 'Less ▲' : 'More ▼'}
          </Text>
        </Pressable>
        {showMore ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing[3],
              marginTop: theme.spacing[3],
            }}
          >
            {more.map((a) => (
              <ActivityPickTile key={a.id} activity={a} onPress={() => pickActivity(a)} />
            ))}
          </View>
        ) : null}
        <View style={{ height: theme.spacing[8] }} />
        <Button label="Cancel" variant="ghost" onPress={dismiss} />
      </Screen>
    );
  }

  const surface = resolveSurface(form);
  const label = form.activity ? activityById(form.activity)?.label ?? form.activity : form.modality ?? 'session';
  // Gear chips (E1): only when the picked activity declares gear categories AND
  // matching active gear exists — a gearless user never sees the row.
  const gearCats = form.activity ? activityById(form.activity)?.gearCategories : undefined;
  const gearChoices = gearCats
    ? gearOptions.filter((g) => gearCats.includes(g.category))
    : [];
  const poolTotalM =
    form.swim.mode === 'pool'
      ? (Number(form.swim.poolLengthM) || 0) * (Number(form.swim.laps) || 0)
      : 0;

  return (
    <Screen scroll>
      {headerScreen}
      {/* Change-activity control — only for a new log; editing is bound to one
          session, so switching activity there would be meaningless. Styled as an
          obvious pill so it doesn't read as a title (the old "‹ Gym" label did). */}
      {!isEdit ? (
        <Pressable
          onPress={() => setStep('activity')}
          accessibilityRole="button"
          accessibilityLabel="Change activity"
          hitSlop={8}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing[1],
            paddingVertical: theme.spacing[2],
            paddingHorizontal: theme.spacing[3],
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Text variant="label" color={theme.colors.sandstone}>
            ‹ Change activity
          </Text>
        </Pressable>
      ) : (
        <Text variant="label" color={theme.colors.sandstone}>
          {label}
        </Text>
      )}
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        {isEdit ? `Edit ${label}` : `Log ${label}`}
      </Text>

      {/* Surface-dependent body */}
      {surface === 'gym' ? (
        <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
          {form.gym.exercises.map((ex) => (
            <GymExerciseEditor
              key={ex.id}
              exercise={ex}
              onName={(name) => setExerciseName(ex.id, name)}
              onPattern={(p) => setExercisePattern(ex.id, p)}
              onSet={(setId, fn) => mutateSet(ex.id, setId, fn)}
              onCompleteSet={(setId) => completeSet(ex.id, setId)}
              onAddSet={() => addSet(ex.id)}
              onRemoveSet={(setId) => removeSet(ex.id, setId)}
              onRemove={() => removeExercise(ex.id)}
            />
          ))}
          <Button label="+ Add exercise" variant="secondary" onPress={addExercise} />
          {restTimer.remainingSec != null && restTimer.remainingSec > 0 ? (
            <RestTimer remainingSec={restTimer.remainingSec} onSkip={restTimer.stop} />
          ) : null}
        </View>
      ) : null}

      {surface === 'gps' ? (
        <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[4] }}>
          <Field
            label={`Distance (${distanceUnit}, optional)`}
            value={form.endurance.distance}
            onChangeText={(distance) =>
              update({ endurance: { ...form.endurance, distance } })
            }
            placeholder="—"
            suffix={distanceUnit}
          />
          <Field
            label="Avg HR (optional)"
            value={form.endurance.avgHr}
            onChangeText={(avgHr) => update({ endurance: { ...form.endurance, avgHr } })}
            placeholder="—"
            suffix="bpm"
            keyboardType="number-pad"
          />
          <Field
            label="Elevation gain (m, optional)"
            value={
              form.endurance.elevationGainM != null
                ? String(form.endurance.elevationGainM)
                : ''
            }
            onChangeText={(text) =>
              // Pure reducer (lib/session): a typed value is the user's number →
              // source 'manual', even over a route prefill; cleared → both absent.
              update({ endurance: applyElevationGainEdit(form.endurance, text) })
            }
            placeholder="—"
            suffix="m"
            keyboardType="number-pad"
          />
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Energy system</Text>
            <ChipSelect
              options={ENERGY_SYSTEMS}
              value={form.endurance.energySystem}
              onChange={(energySystem) =>
                update({ endurance: { ...form.endurance, energySystem } })
              }
            />
          </View>
          {form.endurance.gpsPath && form.endurance.gpsPath.length >= 2 ? (
            <View style={{ gap: theme.spacing[2] }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text variant="label">Route attached</Text>
                <RemoveButton
                  label="Remove route"
                  onPress={() =>
                    update({
                      endurance: {
                        distance: form.endurance.distance,
                        avgHr: form.endurance.avgHr,
                        energySystem: form.endurance.energySystem,
                      },
                    })
                  }
                />
              </View>
              <RoutePreview path={form.endurance.gpsPath} />
              <Text variant="dataSm" color={theme.colors.textSecondary}>
                {[
                  form.endurance.importMeta?.filename,
                  `${form.endurance.gpsPath.length} points`,
                  form.endurance.elevationGainM != null
                    ? `${form.endurance.elevationGainM} m gain`
                    : null,
                  // Provenance caption (E2) — only when the source is known.
                  form.endurance.elevationGainM != null &&
                  form.endurance.elevationGainSource != null
                    ? `elevation: ${ELEVATION_SOURCE_LABELS[form.endurance.elevationGainSource]}`
                    : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
              {/* Full display stack — map over tiles, then the derived charts.
                  Each is self-absenting: RouteMap degrades to the SVG trace with
                  no MapTiler key, ElevationProfile hides with no altitude, Splits
                  hide when the track is untimed (gps-mapping-spec.md). */}
              <RouteMap path={form.endurance.gpsPath} />
              <ElevationProfile points={form.endurance.gpsPath} />
              <Splits points={form.endurance.gpsPath} unit={distanceUnit} />
            </View>
          ) : (
            <View style={{ gap: theme.spacing[3] }}>
              <GpsRecorderPanel onCapture={applyCapturedRoute} />
              <Button
                label={importing ? 'Reading file…' : 'Import GPX file'}
                variant="ghost"
                onPress={importGpxFile}
                disabled={importing}
              />
            </View>
          )}
        </Card>
      ) : null}

      {surface === 'climbing' ? (
        <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[4] }}>
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Style</Text>
            <ChipSelect
              options={CLIMB_STYLES}
              value={form.climb.style}
              onChange={(style) => update({ climb: { ...form.climb, style } })}
            />
          </View>
          {form.climb.sends.map((s) => (
            <View
              key={s.id}
              style={{ flexDirection: 'row', gap: theme.spacing[3], alignItems: 'flex-end' }}
            >
              <Field
                label="Grade"
                value={s.grade}
                onChangeText={(grade) => mutateSend(s.id, { grade })}
                placeholder="V4 / 6a"
                keyboardType="default"
                style={{ flex: 1 }}
              />
              <Field
                label="Attempts"
                value={s.attempts}
                onChangeText={(attempts) => mutateSend(s.id, { attempts })}
                placeholder="1"
                keyboardType="number-pad"
                style={{ width: 80 }}
              />
              <Checkbox
                label="Sent"
                checked={s.sent}
                onToggle={() => mutateSend(s.id, { sent: !s.sent })}
              />
              <RemoveButton label="Remove send" onPress={() => removeSend(s.id)} />
            </View>
          ))}
          <Button label="+ Add send" variant="secondary" onPress={addSend} />
        </Card>
      ) : null}

      {surface === 'swim' ? (
        <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[4] }}>
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Where</Text>
            <ChipSelect
              options={SWIM_MODES}
              value={form.swim.mode}
              onChange={(mode) => update({ swim: { ...form.swim, mode } })}
            />
          </View>
          {form.swim.mode === 'pool' ? (
            <>
              <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                <Field
                  label="Pool length"
                  value={form.swim.poolLengthM}
                  onChangeText={(poolLengthM) => update({ swim: { ...form.swim, poolLengthM } })}
                  placeholder="25"
                  suffix="m"
                  keyboardType="number-pad"
                  style={{ flex: 1 }}
                />
                <Field
                  label="Laps"
                  value={form.swim.laps}
                  onChangeText={(laps) => update({ swim: { ...form.swim, laps } })}
                  placeholder="0"
                  keyboardType="number-pad"
                  style={{ flex: 1 }}
                />
              </View>
              {poolTotalM > 0 ? (
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  Total: {poolTotalM} m
                </Text>
              ) : null}
            </>
          ) : (
            <Field
              label={`Distance (${distanceUnit})`}
              value={form.swim.distance}
              onChangeText={(distance) => update({ swim: { ...form.swim, distance } })}
              placeholder="—"
              suffix={distanceUnit}
            />
          )}
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Stroke</Text>
            <ChipSelect
              options={SWIM_STROKES}
              value={form.swim.stroke}
              onChange={(stroke) => update({ swim: { ...form.swim, stroke } })}
            />
          </View>
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Energy system</Text>
            <ChipSelect
              options={ENERGY_SYSTEMS}
              value={form.swim.energySystem}
              onChange={(energySystem) => update({ swim: { ...form.swim, energySystem } })}
            />
          </View>
        </Card>
      ) : null}

      {surface === 'practice' ? (
        <Card style={{ marginTop: theme.spacing[6] }}>
          <Field
            label="Style (optional)"
            value={form.practice.style}
            onChangeText={(style) => update({ practice: { style } })}
            placeholder="e.g. vinyasa, hatha, mobility"
            keyboardType="default"
          />
        </Card>
      ) : null}

      {/* Shared footer: duration (non-gym), effort, notes */}
      <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[5] }}>
        {surface === 'gym' ? (
          <Text variant="bodySm" color={theme.colors.textMuted}>
            Duration is timed from your sets — tap ✓ on each as you finish it. Logged after
            the fact? That's fine; the time just stays blank rather than guessed.
          </Text>
        ) : (
          <Field
            label="Duration"
            value={form.durationMin}
            onChangeText={(durationMin) => update({ durationMin })}
            placeholder="0"
            suffix="min"
            keyboardType="number-pad"
          />
        )}
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Perceived effort (1–10, optional)</Text>
          <ChipSelect
            options={EFFORT}
            value={form.perceivedEffort}
            onChange={(perceivedEffort) => update({ perceivedEffort })}
          />
        </View>
        {gearChoices.length > 0 ? (
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Gear (optional)</Text>
            {/* Multi-select — ChipSelect is single-choice, so these are plain
                pressables in the same chip clothes. Tapping toggles membership
                in form.gearIds; mileage is derived from these tags on read. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
              {gearChoices.map((g) => {
                const selected = form.gearIds.includes(g.id);
                return (
                  <Pressable
                    key={g.id}
                    onPress={() =>
                      update({
                        gearIds: selected
                          ? form.gearIds.filter((id) => id !== g.id)
                          : [...form.gearIds, g.id],
                      })
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      paddingVertical: theme.spacing[2],
                      paddingHorizontal: theme.spacing[3],
                      borderRadius: theme.radius.full,
                      backgroundColor: selected
                        ? theme.colors.sandstone
                        : theme.colors.surfaceRaised,
                      borderWidth: 1,
                      borderColor: selected ? theme.colors.sandstone : theme.colors.border,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      variant="label"
                      color={selected ? theme.colors.bg : theme.colors.textSecondary}
                    >
                      {g.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <Field
          label="Notes (optional)"
          value={form.notes}
          onChangeText={(notes) => update({ notes })}
          placeholder="—"
          keyboardType="default"
        />
      </Card>

      {/* Honest, specific reason the form can't save yet. */}
      {validationError ? (
        <Text
          variant="bodySm"
          color={theme.colors.textMuted}
          style={{ marginTop: theme.spacing[4] }}
        >
          {validationError}
        </Text>
      ) : null}
      {error ? (
        <Text
          variant="bodySm"
          color={theme.colors.negative}
          style={{ marginTop: theme.spacing[2] }}
        >
          {error}
        </Text>
      ) : null}

      <View style={{ height: theme.spacing[6] }} />
      <Button
        label={isEdit ? 'Save changes' : 'Save session'}
        onPress={handleSave}
        disabled={validationError !== null || (isEdit && !original)}
        loading={saving}
      />
      <View style={{ height: theme.spacing[3] }} />
      <Button label="Cancel" variant="ghost" onPress={dismiss} />
      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

/** A text tile in the step-1 activity picker (Today's quick-log path). */
function ActivityPickTile({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Log ${activity.label}`}
      style={{
        width: '30%',
        aspectRatio: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="label" color={theme.colors.text}>
        {activity.label}
      </Text>
    </Pressable>
  );
}

