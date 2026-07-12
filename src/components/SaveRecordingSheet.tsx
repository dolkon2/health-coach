/**
 * SaveRecordingSheet — Map Record's save state (map-tab.md §2/§3).
 *
 * Stop (or the Import door, or the recovery banner) hands a finished track
 * here; the sheet confirms the activity, takes optional notes, and writes an
 * ordinary session Observation through the exact same builders log-session
 * uses (recordingSave.ts → buildSessionObservation → createObservation).
 * A Map-saved session is indistinguishable from any other.
 *
 * Honesty posture:
 *  - Closing the sheet (scrim/back) is NOT a discard: a live recording's
 *    buffer row survives, so the recovery banner re-offers it — data is only
 *    ever deleted by the explicit, confirmed Discard.
 *  - The silent conditions freeze fires on open (fire-and-forget, never
 *    awaited, never blocks the save — freeze.ts's own contract); a save that
 *    lands first simply carries no conditions.
 *  - An untimed imported track ASKS for a duration rather than fabricating
 *    one (the only extra field, shown only when needed).
 *  - Post-save the user stays on the Map (pre-start) — the Profile-logbook
 *    deep-link stays deferred (Session 7 ⚑).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import type { GeoPoint } from '@core/observation';
import type { ConditionsSnapshot } from '@core/conditions';
import { Text } from './Text';
import { Button } from './Button';
import { Field } from './Field';
import { RoutePreview } from './RoutePreview';
import { ElementPickerSheet } from './ElementPickerSheet';
import { iconFor } from './activityIcons';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { uuidv7 } from '@/lib/id';
import { deviceTz, formatDurationClock } from '@/lib/date';
import { metersToDisplay } from '@/lib/units';
import { summarizeTrack } from '@/lib/gpsTrack';
import { buildSessionObservation, numStr } from '@/lib/session';
import { createObservation } from '@/storage/observations';
import { writeSessionToHealthKit } from '@/lib/healthkit/writer';
import { freezeEarthConditions } from '@/lib/conditions/freeze';
import { clearRecording } from '@/storage/recordingBuffer';
import type { Activity } from '@/lib/activity';
import {
  recordingSessionForm,
  recordsOnMap,
  pairTrackFormat,
  needsDurationAsk,
  type TrackOrigin,
} from '@/lib/recording/recordingSave';

export type SaveRecordingTrack = {
  points: GeoPoint[];
  origin: TrackOrigin;
  /** The buffer row behind a live/recovered recording — cleared on save or
   *  discard, kept on plain close. Null for a file import (no buffer). */
  recordingId: string | null;
  /** Parser extras for imports (a live recording derives all of these). */
  name?: string;
  distanceM?: number;
  elevationGainM?: number;
  elevationGainSource?: 'gps';
  durationMin?: number;
  startTime?: string;
};

type SaveRecordingSheetProps = {
  visible: boolean;
  /** The armed activity — confirmable (not locked) inside the sheet. */
  activity: Activity;
  track: SaveRecordingTrack | null;
  /** Observation written (+ buffer cleared). Parent returns to pre-start. */
  onSaved: () => void;
  /** Confirmed discard (+ buffer cleared). */
  onDiscarded: () => void;
  /** Backed out — buffer kept; a live recording stays recoverable. */
  onClose: () => void;
};

export function SaveRecordingSheet({
  visible,
  activity: armedActivity,
  track,
  onSaved,
  onDiscarded,
  onClose,
}: SaveRecordingSheetProps) {
  const theme = useTheme();
  const { weightUnit, distanceUnit } = useSettings();

  const [activity, setActivity] = useState<Activity>(armedActivity);
  const [notes, setNotes] = useState('');
  const [durationText, setDurationText] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [conditions, setConditions] = useState<ConditionsSnapshot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The track this sheet instance is currently editing — a late freeze
  // resolution from a PREVIOUS track (sheet closed and reopened while the
  // fetch was in flight) must never land on this one (review finding: the
  // component stays mounted across opens, so promise identity is the guard).
  const trackRef = useRef(track);
  trackRef.current = track;

  // Fresh sheet per track: reset all draft state when it opens, and fire the
  // silent conditions freeze at the track's start point/time — never awaited,
  // the module never throws or hangs a save by contract.
  useEffect(() => {
    if (!visible || track == null) return;
    setActivity(armedActivity);
    setNotes('');
    setDurationText('');
    setConditions(null);
    setSaving(false);
    setError(null);
    const first = track.points[0];
    if (first) {
      const trackAtFire = track;
      freezeEarthConditions({
        lat: first.lat,
        lng: first.lng,
        atIso:
          track.startTime ??
          (first.tsSec > 0 ? new Date(first.tsSec * 1000).toISOString() : new Date().toISOString()),
        include: { weather: true },
      })
        .then((snapshot) => {
          // Only the track this freeze was fetched FOR may wear it.
          if (snapshot.weather && trackRef.current === trackAtFire) setConditions(snapshot);
        })
        .catch(() => {}); // belt and braces — freeze never throws
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, track]);

  const summary = useMemo(
    () => (track && track.points.length >= 2 ? summarizeTrack(track.points) : null),
    [track]
  );

  // An untimed imported track has no derivable duration — ask, never
  // fabricate. Same predicate the form builder uses (single source).
  const needsDuration =
    track != null &&
    needsDurationAsk({ durationMin: track.durationMin, durationSec: summary?.durationSec ?? 0 });

  const pickActivity = useCallback(
    (a: Activity) => {
      setPickerVisible(false);
      if (!recordsOnMap(a)) {
        setError(`${a.label} logs through its own surface — pick a GPS sport, or use Log Session.`);
        return;
      }
      if (track?.origin.kind === 'import') {
        const mismatch = pairTrackFormat(a, track.origin.format);
        if (mismatch) {
          setError(mismatch);
          return;
        }
      }
      setError(null);
      setActivity(a);
    },
    [track]
  );

  const save = useCallback(async () => {
    if (track == null || saving) return;
    setSaving(true);
    setError(null);
    try {
      const typedDuration = durationText.trim() === '' ? null : Number(durationText);
      if (typedDuration != null && (!Number.isFinite(typedDuration) || typedDuration <= 0)) {
        throw new Error('Duration is minutes — a number above zero.');
      }
      const { form } = recordingSessionForm({
        activity,
        points: track.points,
        origin: track.origin,
        notes,
        name: track.name,
        conditions,
        distanceUnit,
        distanceM: track.distanceM,
        elevationGainM: track.elevationGainM,
        elevationGainSource: track.elevationGainSource,
        durationMin: typedDuration ?? track.durationMin,
        startTime: track.startTime,
      });
      const obs = buildSessionObservation(form, {
        id: uuidv7(),
        now: new Date().toISOString(),
        tz: deviceTz(),
        weightUnit,
        distanceUnit,
      });
      await createObservation(obs);
      // Same fire-and-forget HealthKit export as log-session — never blocks.
      void writeSessionToHealthKit(obs).catch(() => {});
      if (track.recordingId) {
        // The Observation is saved — never block the user on the buffer
        // clear. But a silently surviving row becomes a recovery banner
        // offering to save the SAME track again (duplicate risk, review
        // finding), so retry once and at least say so in the log.
        try {
          await clearRecording(track.recordingId);
        } catch {
          await clearRecording(track.recordingId).catch((e) => {
            console.warn(
              '[recording] saved, but the buffer row would not clear — the recovery banner may re-offer this track:',
              e instanceof Error ? e.message : e
            );
          });
        }
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  }, [
    track,
    saving,
    durationText,
    activity,
    notes,
    conditions,
    distanceUnit,
    weightUnit,
    onSaved,
  ]);

  const discard = useCallback(() => {
    if (track == null) return;
    Alert.alert(
      'Discard this track?',
      track.origin.kind === 'record'
        ? 'The recording will be deleted. This cannot be undone.'
        : 'Nothing has been saved from this file.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (track.recordingId) {
                await clearRecording(track.recordingId).catch(() => {});
              }
              onDiscarded();
            })();
          },
        },
      ]
    );
  }, [track, onDiscarded]);

  if (track == null) return null;
  const Icon = iconFor(activity.icon);
  const distanceStr =
    summary && summary.distanceM > 0
      ? `${numStr(metersToDisplay(track.distanceM ?? summary.distanceM, distanceUnit), 2)} ${distanceUnit}`
      : null;
  const durationStr =
    summary && summary.durationSec > 0 ? formatDurationClock(summary.durationSec) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
        accessibilityLabel="Close without discarding"
      />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          padding: theme.spacing[5],
          maxHeight: '85%',
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ gap: theme.spacing[4] }}>
            <Text variant="label" color={theme.colors.textSecondary}>
              {track.origin.kind === 'record' ? 'Save session' : 'Save imported track'}
            </Text>

            {/* Activity confirm — the armed sport, changeable before save. */}
            <Pressable
              onPress={() => setPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Activity: ${activity.label}. Tap to change.`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing[3],
                padding: theme.spacing[3],
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Icon size={20} color={theme.colors.accent} strokeWidth={1.75} />
              <Text variant="body" style={{ flex: 1 }}>
                {activity.label}
              </Text>
              <Text variant="label" color={theme.colors.textMuted}>
                Change
              </Text>
            </Pressable>

            {/* The track itself — preview + honest measured stats. */}
            {track.points.length >= 2 ? <RoutePreview path={track.points} height={96} /> : null}
            <View style={{ flexDirection: 'row', gap: theme.spacing[5] }}>
              {durationStr ? (
                <Stat label="Time" value={durationStr} />
              ) : null}
              {distanceStr ? <Stat label="Distance" value={distanceStr} /> : null}
              <Stat label="Points" value={String(summary?.pointCount ?? track.points.length)} />
            </View>

            {needsDuration ? (
              <Field
                label="Duration (minutes)"
                value={durationText}
                onChangeText={setDurationText}
                placeholder="This track carries no timestamps"
                keyboardType="numeric"
              />
            ) : null}

            <Field
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              keyboardType="default"
              placeholder={track.name ?? 'Optional'}
            />

            {error ? (
              <Text variant="bodySm" color={theme.colors.negative}>
                {error}
              </Text>
            ) : null}

            <Button label={saving ? 'Saving…' : 'Save session'} onPress={() => void save()} />
            <Button label="Discard" variant="outline" onPress={discard} />
          </View>
        </ScrollView>
      </View>

      <ElementPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        mostRecent={{}}
        onPickActivity={pickActivity}
        onPickBody={() => {
          setPickerVisible(false);
          setError('Body sessions log through Training — they never ride a map track.');
        }}
      />
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View>
      <Text variant="label" color={theme.colors.textMuted}>
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}
