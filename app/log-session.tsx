/**
 * Log Session — a modal from Today. Pass 4: the real logger.
 *
 * Step 1 picks a modality (surface tiles). Step 2 is modality-dependent: a gym
 * set logger with a *required* movement-pattern tag per exercise, a lighter
 * duration/distance/HR form for endurance, or a style + sends form for climbing.
 * All modalities share a duration, perceived-effort and notes footer.
 *
 * On save the form maps to a tier-1, fidelity-0.95 manual session Observation
 * (lib/session.ts builds it) and Today re-fetches on focus to show it. The
 * movement-pattern requirement is enforced by the same builder the test drives,
 * so an untagged set can't reach storage.
 */
import { useEffect, useState } from 'react';
import { View, Pressable, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen, Text, Button, Card, Field, ChipSelect, type ChipOption } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { useExercisePatternMemory } from '@/hooks/useExercisePatternMemory';
import {
  createObservation,
  getObservationById,
  updateObservation,
} from '@/storage/observations';
import { deviceTz } from '@/lib/date';
import { uuidv7 } from '@/lib/id';
import {
  emptySessionForm,
  emptyExerciseDraft,
  emptySetDraft,
  validateSessionForm,
  buildSessionObservation,
  sessionFormFromObservation,
  isEndurance,
  type SessionForm,
  type SessionModality,
  type ExerciseDraft,
  type SetDraft,
  type ClimbStyle,
} from '@/lib/session';
import type { EnergySystem, MovementPattern, ObservationOf } from '@core/observation';

const MODALITIES: { value: SessionModality; label: string }[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'run', label: 'Run' },
  { value: 'ride', label: 'Ride' },
  { value: 'climb', label: 'Climb' },
  { value: 'paddle', label: 'Paddle' },
  { value: 'hike', label: 'Hike' },
  { value: 'other', label: 'Other' },
];

const PATTERNS: ChipOption<MovementPattern>[] = [
  { value: 'upper-push', label: 'Upper push' },
  { value: 'upper-pull', label: 'Upper pull' },
  { value: 'hip-hinge', label: 'Hip hinge' },
  { value: 'quad-dom', label: 'Quad dom' },
  { value: 'core', label: 'Core' },
  { value: 'carry', label: 'Carry' },
  { value: 'rotation', label: 'Rotation' },
  { value: 'unilateral-leg', label: 'Unilat leg' },
  { value: 'isolation', label: 'Isolation' },
  { value: 'other', label: 'Other' },
];

const ENERGY_SYSTEMS: ChipOption<EnergySystem>[] = [
  { value: 'aerobic', label: 'Aerobic' },
  { value: 'glycolytic', label: 'Glycolytic' },
  { value: 'mixed', label: 'Mixed' },
];

const CLIMB_STYLES: ChipOption<ClimbStyle>[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'boulder', label: 'Boulder' },
  { value: 'sport', label: 'Sport' },
  { value: 'top-rope', label: 'Top rope' },
  { value: 'trad', label: 'Trad' },
];

const EFFORT: ChipOption<number>[] = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

export default function LogSessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit, distanceUnit } = useSettings();
  const patternMemory = useExercisePatternMemory();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = typeof editId === 'string' && editId.length > 0;

  const [form, setForm] = useState<SessionForm>(emptySessionForm);
  // Edit-mode skips the modality picker — the session already has one.
  const [step, setStep] = useState<'modality' | 'detail'>(isEdit ? 'detail' : 'modality');
  const [original, setOriginal] = useState<ObservationOf<'session'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const update = (patch: Partial<SessionForm>) => setForm((f) => ({ ...f, ...patch }));

  function pickModality(modality: SessionModality) {
    setForm((f) => ({
      ...f,
      modality,
      // Seed the gym logger with one empty exercise so there's something to fill.
      gym: modality === 'gym' && f.gym.exercises.length === 0
        ? { exercises: [emptyExerciseDraft(uuidv7(), uuidv7())] }
        : f.gym,
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
      router.back();
    } catch {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (step === 'modality') {
    return (
      <Screen scroll>
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
          {MODALITIES.map((m) => (
            <Pressable
              key={m.value}
              onPress={() => pickModality(m.value)}
              accessibilityRole="button"
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
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: theme.spacing[8] }} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const modality = form.modality as SessionModality;

  return (
    <Screen scroll>
      <Pressable onPress={() => setStep('modality')} accessibilityRole="button">
        <Text variant="label" color={theme.colors.sandstone}>
          ‹ {MODALITIES.find((m) => m.value === modality)?.label}
        </Text>
      </Pressable>
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        {isEdit ? `Edit ${modality}` : `Log ${modality}`}
      </Text>

      {/* Modality-dependent body */}
      {modality === 'gym' ? (
        <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
          {form.gym.exercises.map((ex) => (
            <ExerciseEditor
              key={ex.id}
              exercise={ex}
              onName={(name) => setExerciseName(ex.id, name)}
              onPattern={(p) => setExercisePattern(ex.id, p)}
              onSet={(setId, fn) => mutateSet(ex.id, setId, fn)}
              onAddSet={() => addSet(ex.id)}
              onRemoveSet={(setId) => removeSet(ex.id, setId)}
              onRemove={() => removeExercise(ex.id)}
            />
          ))}
          <Button label="+ Add exercise" variant="secondary" onPress={addExercise} />
        </View>
      ) : null}

      {isEndurance(modality) ? (
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
        </Card>
      ) : null}

      {modality === 'climb' ? (
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

      {/* Shared footer: duration, effort, notes */}
      <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[5] }}>
        <Field
          label="Duration"
          value={form.durationMin}
          onChangeText={(durationMin) => update({ durationMin })}
          placeholder="0"
          suffix="min"
          keyboardType="number-pad"
        />
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Perceived effort (1–10, optional)</Text>
          <ChipSelect
            options={EFFORT}
            value={form.perceivedEffort}
            onChange={(perceivedEffort) => update({ perceivedEffort })}
          />
        </View>
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
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function ExerciseEditor({
  exercise,
  onName,
  onPattern,
  onSet,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  exercise: ExerciseDraft;
  onName: (name: string) => void;
  onPattern: (p: MovementPattern) => void;
  onSet: (setId: string, fn: (s: SetDraft) => SetDraft) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const canRemoveSet = exercise.sets.length > 1; // always keep one row so the table isn't empty
  return (
    <Card raised style={{ gap: theme.spacing[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[3] }}>
        <Field
          label="Exercise"
          value={exercise.name}
          onChangeText={onName}
          placeholder="e.g. barbell back squat"
          keyboardType="default"
          style={{ flex: 1 }}
        />
        <RemoveButton label="Remove exercise" onPress={onRemove} />
      </View>
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Movement pattern (required)</Text>
        <ChipSelect options={PATTERNS} value={exercise.movementPattern} onChange={onPattern} />
      </View>

      {/* Sets table — trailing column reserved for the per-row remove control */}
      <View style={{ gap: theme.spacing[2] }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
          <Text variant="label" style={{ flex: 1 }}>
            Weight
          </Text>
          <Text variant="label" style={{ width: 56 }}>
            Reps
          </Text>
          <Text variant="label" style={{ width: 48 }}>
            RIR
          </Text>
          <Text variant="label" style={{ width: 44 }}>
            Warm
          </Text>
          <View style={{ width: 24 }} />
        </View>
        {exercise.sets.map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', gap: theme.spacing[3], alignItems: 'flex-end' }}>
            <Field
              value={s.weight}
              onChangeText={(weight) => onSet(s.id, (prev) => ({ ...prev, weight }))}
              placeholder="0"
              style={{ flex: 1 }}
            />
            <Field
              value={s.reps}
              onChangeText={(reps) => onSet(s.id, (prev) => ({ ...prev, reps }))}
              placeholder="0"
              keyboardType="number-pad"
              style={{ width: 56 }}
            />
            <Field
              value={s.rir}
              onChangeText={(rir) => onSet(s.id, (prev) => ({ ...prev, rir }))}
              placeholder="—"
              keyboardType="number-pad"
              style={{ width: 48 }}
            />
            <View style={{ width: 44, alignItems: 'center', paddingBottom: theme.spacing[2] }}>
              <Checkbox
                checked={s.isWarmup}
                onToggle={() => onSet(s.id, (prev) => ({ ...prev, isWarmup: !prev.isWarmup }))}
              />
            </View>
            <View style={{ width: 24, alignItems: 'center', paddingBottom: theme.spacing[2] }}>
              {canRemoveSet ? (
                <RemoveButton label="Remove set" onPress={() => onRemoveSet(s.id)} />
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <Button label="+ Add set" variant="ghost" size="sm" onPress={onAddSet} />
    </Card>
  );
}

function RemoveButton({ onPress, label }: { onPress: () => void; label?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Remove'}
      hitSlop={8}
      style={{ paddingHorizontal: theme.spacing[1], paddingBottom: theme.spacing[2] }}
    >
      <Text variant="dataSm" color={theme.colors.textMuted}>
        ✕
      </Text>
    </Pressable>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: theme.radius.sm,
          borderWidth: 1.5,
          borderColor: checked ? theme.colors.sandstone : theme.colors.borderStrong,
          backgroundColor: checked ? theme.colors.sandstone : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Text variant="dataSm" color={theme.colors.bg}>
            ✓
          </Text>
        ) : null}
      </View>
      {label ? <Text variant="label">{label}</Text> : null}
    </Pressable>
  );
}
