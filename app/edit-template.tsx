/**
 * Edit Template — create or edit a saved training shape (Phase 6 Pass 1).
 *
 * Reached from /templates as a push: with `?templateId=…` to edit, without to
 * create. On create, step 1 picks an activity (identity → surface); step 2 is
 * the surface-specific shape editor plus shared fields (name, optional day,
 * active toggle). On edit, the activity is fixed and the screen opens straight
 * into step 2.
 *
 * This screen owns its own form state — independent of log-session's
 * SessionForm. Templates record *intent*, not actuals: target sets/reps/weight
 * for gym; target distance for GPS; target duration + style for practice. No
 * timestamps, no perceived effort, no live rest timer.
 *
 * The library ships empty (constitution). Saved shapes survive across launches
 * via the session_templates SQLite table (migration 002).
 */
import { useEffect, useState, type ComponentType } from 'react';
import { View, Pressable, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Dumbbell,
  Footprints,
  Bike,
  Mountain,
  Waves,
  Wind,
  Snowflake,
  Flower2,
  Activity as ActivityIcon,
} from 'lucide-react-native';
import { Screen, Text, Button, Card, Field, ChipSelect } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import {
  ENERGY_SYSTEMS,
  CLIMB_STYLES,
  SWIM_MODES,
  SWIM_STROKES,
  DAYS_OF_WEEK,
  PATTERNS,
} from '@/lib/sessionFormOptions';
import {
  createTemplate,
  getTemplateById,
  updateTemplate,
} from '@/storage/sessionTemplates';
import { uuidv7 } from '@/lib/id';
import {
  displayToKg,
  displayToMeters,
  kgToDisplay,
  metersToDisplay,
} from '@/lib/units';
import {
  activityById,
  headlineActivities,
  moreActivities,
  type Activity,
} from '@/lib/activity';
import type {
  ClimbingTemplateShape,
  GpsTemplateShape,
  GymTemplateExercise,
  GymTemplateSet,
  GymTemplateShape,
  PracticeTemplateShape,
  SessionTemplate,
  SwimTemplateShape,
  TemplateShape,
  TemplateSurface,
} from '@core/sessionTemplate';
import type { ClimbStyle, SwimMode } from '@/lib/session';
import type { EnergySystem, MovementPattern, SwimStroke } from '@core/observation';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const ICONS: Record<string, IconCmp> = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  bike: Bike,
  mountain: Mountain,
  waves: Waves,
  wind: Wind,
  snowflake: Snowflake,
  flower: Flower2,
};

// ─── Form state ─────────────────────────────────────────────────────────────
// Numeric fields are strings (raw TextInput values); parsed at save time.

type SetRow = {
  id: string;
  targetReps: string;
  targetWeight: string; // user-display units (kg or lb)
};

type ExerciseRow = {
  id: string;
  name: string;
  movementPattern: MovementPattern | null;
  sets: SetRow[];
  restBetweenSets: string; // MM:SS or raw seconds — empty = global default
};

function emptySetRow(id: string): SetRow {
  return { id, targetReps: '', targetWeight: '' };
}

/**
 * Parse a rest-duration input. Accepts "M:SS" / "MM:SS" (the canonical UI
 * shape), and bare integers ("120") fall back to seconds for users typing
 * fast. Anything unparseable returns null — the storage layer omits the
 * field, and runtime falls back to the global rest-timer setting.
 */
function parseRestSec(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (t.includes(':')) {
    const [mm, ss] = t.split(':');
    const m = parseInt(mm, 10);
    const s = parseInt(ss, 10);
    if (!Number.isFinite(m) || !Number.isFinite(s) || s < 0 || s >= 60) return null;
    return m * 60 + s;
  }
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function formatRestSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type TemplateForm = {
  name: string;
  activity: string | null; // null until step 1 picks one
  surface: TemplateSurface | null;
  dayAssignment: number | null;
  isActive: boolean;
  // Surface-specific buckets — only the one matching `surface` is consumed.
  gym: { exercises: ExerciseRow[] };
  gps: { targetDistance: string; energySystem: EnergySystem; notes: string };
  practice: { targetDurationMin: string; style: string; notes: string };
  climbing: {
    style: ClimbStyle;
    targetGradeRange: string;
    targetSends: string;
    notes: string;
  };
  swim: {
    mode: SwimMode;
    poolLengthM: string;
    targetLaps: string;
    targetDistance: string;
    stroke: SwimStroke;
    energySystem: EnergySystem;
    notes: string;
  };
};

function emptyExerciseRow(id: string, setId: string): ExerciseRow {
  return {
    id,
    name: '',
    movementPattern: null,
    sets: [emptySetRow(setId)],
    restBetweenSets: '',
  };
}

function emptyTemplateForm(): TemplateForm {
  return {
    name: '',
    activity: null,
    surface: null,
    dayAssignment: null,
    isActive: true,
    gym: { exercises: [] },
    gps: { targetDistance: '', energySystem: 'aerobic', notes: '' },
    practice: { targetDurationMin: '', style: '', notes: '' },
    climbing: { style: 'gym', targetGradeRange: '', targetSends: '', notes: '' },
    swim: {
      mode: 'pool',
      poolLengthM: '',
      targetLaps: '',
      targetDistance: '',
      stroke: 'freestyle',
      energySystem: 'aerobic',
      notes: '',
    },
  };
}

// ─── Load existing template into the form ───────────────────────────────────

function formFromTemplate(
  t: SessionTemplate,
  weightUnit: 'kg' | 'lb',
  distanceUnit: 'km' | 'mi'
): TemplateForm {
  const base = emptyTemplateForm();
  const common = {
    name: t.name,
    activity: t.activity,
    surface: t.surface,
    dayAssignment: t.dayAssignment ?? null,
    isActive: t.isActive,
  };
  switch (t.shape.surface) {
    case 'gym': {
      const s = t.shape as GymTemplateShape;
      return {
        ...base,
        ...common,
        gym: {
          exercises: s.exercises.map((e) => ({
            id: e.id,
            name: e.name,
            movementPattern: e.movementPattern,
            restBetweenSets:
              e.restBetweenSetsSec != null ? formatRestSec(e.restBetweenSetsSec) : '',
            sets: e.sets.map((set) => ({
              id: set.id,
              targetReps: set.targetReps ?? '',
              targetWeight:
                set.targetWeightKg != null
                  ? formatWeightForInput(set.targetWeightKg, weightUnit)
                  : '',
            })),
          })),
        },
      };
    }
    case 'gps': {
      const s = t.shape as GpsTemplateShape;
      return {
        ...base,
        ...common,
        gps: {
          targetDistance:
            s.targetDistanceM != null
              ? formatDistanceForInput(s.targetDistanceM, distanceUnit)
              : '',
          energySystem: s.energySystem,
          notes: s.notes ?? '',
        },
      };
    }
    case 'practice': {
      const s = t.shape as PracticeTemplateShape;
      return {
        ...base,
        ...common,
        practice: {
          targetDurationMin: s.targetDurationMin != null ? String(s.targetDurationMin) : '',
          style: s.style ?? '',
          notes: s.notes ?? '',
        },
      };
    }
    case 'climbing': {
      const s = t.shape as ClimbingTemplateShape;
      return {
        ...base,
        ...common,
        climbing: {
          style: s.style,
          targetGradeRange: s.targetGradeRange ?? '',
          targetSends: s.targetSends != null ? String(s.targetSends) : '',
          notes: s.notes ?? '',
        },
      };
    }
    case 'swim': {
      const s = t.shape as SwimTemplateShape;
      return {
        ...base,
        ...common,
        swim: {
          mode: s.mode,
          poolLengthM: s.poolLengthM != null ? String(s.poolLengthM) : '',
          targetLaps: s.targetLaps != null ? String(s.targetLaps) : '',
          targetDistance: s.targetDistanceM != null ? String(s.targetDistanceM) : '',
          stroke: s.stroke ?? 'freestyle',
          energySystem: s.energySystem,
          notes: s.notes ?? '',
        },
      };
    }
  }
}

function formatWeightForInput(kg: number, unit: 'kg' | 'lb'): string {
  const v = kgToDisplay(kg, unit);
  return (Math.round(v * 10) / 10).toString();
}

function formatDistanceForInput(m: number, unit: 'km' | 'mi'): string {
  const v = metersToDisplay(m, unit);
  return (Math.round(v * 100) / 100).toString();
}

function parseKgFromInput(text: string, unit: 'kg' | 'lb'): number | null {
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return null;
  return displayToKg(n, unit);
}

function parseMetersFromInput(text: string, unit: 'km' | 'mi'): number | null {
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return null;
  return Math.round(displayToMeters(n, unit));
}

// ─── Build a typed TemplateShape from the form's string fields ─────────────

function buildShape(
  form: TemplateForm,
  weightUnit: 'kg' | 'lb',
  distanceUnit: 'km' | 'mi'
): TemplateShape {
  switch (form.surface) {
    case 'gym':
      return {
        surface: 'gym',
        exercises: form.gym.exercises.map<GymTemplateExercise>((e) => {
          const rest = parseRestSec(e.restBetweenSets);
          return {
            id: e.id,
            name: e.name.trim(),
            movementPattern: (e.movementPattern ?? 'other') as MovementPattern,
            sets: e.sets.map<GymTemplateSet>((s) => {
              const weightKg = parseKgFromInput(s.targetWeight, weightUnit);
              return {
                id: s.id,
                ...(s.targetReps.trim() ? { targetReps: s.targetReps.trim() } : {}),
                ...(weightKg != null ? { targetWeightKg: weightKg } : {}),
              };
            }),
            ...(rest != null ? { restBetweenSetsSec: rest } : {}),
          };
        }),
      };
    case 'gps': {
      const m = parseMetersFromInput(form.gps.targetDistance, distanceUnit);
      return {
        surface: 'gps',
        ...(m != null ? { targetDistanceM: m } : {}),
        energySystem: form.gps.energySystem,
        ...(form.gps.notes.trim() ? { notes: form.gps.notes.trim() } : {}),
      };
    }
    case 'practice': {
      const dur = parseInt(form.practice.targetDurationMin, 10);
      return {
        surface: 'practice',
        ...(Number.isFinite(dur) ? { targetDurationMin: dur } : {}),
        ...(form.practice.style.trim() ? { style: form.practice.style.trim() } : {}),
        ...(form.practice.notes.trim() ? { notes: form.practice.notes.trim() } : {}),
      };
    }
    case 'climbing': {
      const sends = parseInt(form.climbing.targetSends, 10);
      return {
        surface: 'climbing',
        style: form.climbing.style,
        ...(form.climbing.targetGradeRange.trim()
          ? { targetGradeRange: form.climbing.targetGradeRange.trim() }
          : {}),
        ...(Number.isFinite(sends) ? { targetSends: sends } : {}),
        ...(form.climbing.notes.trim() ? { notes: form.climbing.notes.trim() } : {}),
      };
    }
    case 'swim': {
      const pool = parseInt(form.swim.poolLengthM, 10);
      const laps = parseInt(form.swim.targetLaps, 10);
      const dist = parseInt(form.swim.targetDistance, 10);
      return {
        surface: 'swim',
        mode: form.swim.mode,
        ...(Number.isFinite(pool) ? { poolLengthM: pool } : {}),
        ...(Number.isFinite(laps) ? { targetLaps: laps } : {}),
        ...(Number.isFinite(dist) ? { targetDistanceM: dist } : {}),
        stroke: form.swim.stroke,
        energySystem: form.swim.energySystem,
        ...(form.swim.notes.trim() ? { notes: form.swim.notes.trim() } : {}),
      };
    }
    case null:
      throw new Error('buildShape: surface not chosen');
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validate(form: TemplateForm): string | null {
  if (!form.surface || !form.activity) return 'Pick an activity to start.';
  if (!form.name.trim()) return 'Give it a name.';
  if (form.surface === 'gym') {
    if (form.gym.exercises.length === 0) return 'Add at least one exercise.';
    for (let i = 0; i < form.gym.exercises.length; i++) {
      const ex = form.gym.exercises[i];
      const label = ex.name.trim() ? `"${ex.name.trim()}"` : `Exercise ${i + 1}`;
      if (!ex.name.trim()) return `Exercise ${i + 1} needs a name.`;
      if (!ex.movementPattern) return `${label} needs a movement pattern.`;
      if (ex.sets.length === 0) return `${label} needs at least one set.`;
    }
  }
  return null;
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function EditTemplateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit, distanceUnit, restTimerSec } = useSettings();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const isEdit = typeof templateId === 'string' && templateId.length > 0;

  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm);
  const [step, setStep] = useState<'activity' | 'detail'>(
    isEdit ? 'detail' : 'activity'
  );
  const [original, setOriginal] = useState<SessionTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    getTemplateById(templateId!)
      .then((t) => {
        if (cancelled || !t) return;
        setOriginal(t);
        setForm(formFromTemplate(t, weightUnit, distanceUnit));
      })
      .catch(() => {
        if (!cancelled) setError('Could not load template.');
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, templateId, weightUnit, distanceUnit]);

  const update = (patch: Partial<TemplateForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  function pickActivity(a: Activity) {
    setForm((f) => ({
      ...f,
      activity: a.id,
      surface: a.surface,
      // Seed the gym editor with one blank exercise so there's something to fill.
      gym:
        a.surface === 'gym' && f.gym.exercises.length === 0
          ? { exercises: [emptyExerciseRow(uuidv7(), uuidv7())] }
          : f.gym,
      gps: a.defaultEnergySystem
        ? { ...f.gps, energySystem: a.defaultEnergySystem }
        : f.gps,
    }));
    setStep('detail');
  }

  const validationError = validate(form);

  async function handleSave() {
    if (validationError || saving) return;
    if (isEdit && !original) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const shape = buildShape(form, weightUnit, distanceUnit);
      if (isEdit && original) {
        await updateTemplate(original.id, {
          name: form.name.trim(),
          surface: form.surface!,
          activity: form.activity!,
          shape,
          ...(form.dayAssignment != null
            ? { dayAssignment: form.dayAssignment }
            : { dayAssignment: undefined }),
          isActive: form.isActive,
          updatedAt: now,
        });
      } else {
        const t: SessionTemplate = {
          id: uuidv7(),
          name: form.name.trim(),
          surface: form.surface!,
          activity: form.activity!,
          shape,
          ...(form.dayAssignment != null
            ? { dayAssignment: form.dayAssignment }
            : {}),
          isActive: form.isActive,
          createdAt: now,
          updatedAt: now,
        };
        await createTemplate(t);
      }
      router.back();
    } catch {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (step === 'activity') {
    const headline = headlineActivities();
    const more = moreActivities();
    return (
      <Screen scroll>
        <Text variant="label" color={theme.colors.sandstone}>
          New template
        </Text>
        <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
          What kind of thing?
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
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const activityLabel = form.activity
    ? activityById(form.activity)?.label ?? form.activity
    : '';

  return (
    <Screen scroll>
      {!isEdit ? (
        <Pressable onPress={() => setStep('activity')} accessibilityRole="button">
          <Text variant="label" color={theme.colors.sandstone}>
            ‹ {activityLabel}
          </Text>
        </Pressable>
      ) : (
        <Text variant="label" color={theme.colors.sandstone}>
          {activityLabel}
        </Text>
      )}
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        {isEdit ? 'Edit template' : 'New template'}
      </Text>

      <Card style={{ marginTop: theme.spacing[6] }}>
        <Field
          label="Name"
          value={form.name}
          onChangeText={(name) => update({ name })}
          placeholder="e.g. Push Day, Park run, Vinyasa"
          keyboardType="default"
          autoFocus={!isEdit}
        />
      </Card>

      {/* Surface-specific body */}
      {form.surface === 'gym' ? (
        <GymTemplateBody
          form={form}
          weightUnit={weightUnit}
          defaultRestSec={restTimerSec}
          onChange={(gym) => update({ gym })}
        />
      ) : null}
      {form.surface === 'gps' ? (
        <GpsTemplateBody
          form={form}
          distanceUnit={distanceUnit}
          onChange={(gps) => update({ gps })}
        />
      ) : null}
      {form.surface === 'practice' ? (
        <PracticeTemplateBody form={form} onChange={(practice) => update({ practice })} />
      ) : null}
      {form.surface === 'climbing' ? (
        <ClimbingTemplateBody form={form} onChange={(climbing) => update({ climbing })} />
      ) : null}
      {form.surface === 'swim' ? (
        <SwimTemplateBody form={form} onChange={(swim) => update({ swim })} />
      ) : null}

      {/* Shared footer: day assignment + active toggle */}
      <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[5] }}>
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Assigned day (optional)</Text>
          <Text variant="bodySm" color={theme.colors.textMuted}>
            Pass 4 will auto-populate active templates onto their assigned day each week.
          </Text>
          <ChipSelect
            options={DAYS_OF_WEEK}
            value={form.dayAssignment}
            onChange={(dayAssignment) =>
              update({ dayAssignment: dayAssignment === form.dayAssignment ? null : dayAssignment })
            }
          />
        </View>
        <Pressable
          onPress={() => update({ isActive: !form.isActive })}
          accessibilityRole="switch"
          accessibilityState={{ checked: form.isActive }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: theme.radius.sm,
              borderWidth: 1.5,
              borderColor: form.isActive ? theme.colors.sandstone : theme.colors.borderStrong,
              backgroundColor: form.isActive ? theme.colors.sandstone : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {form.isActive ? (
              <Text variant="dataSm" color={theme.colors.bg}>
                ✓
              </Text>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">Active</Text>
            <Text variant="bodySm" color={theme.colors.textMuted}>
              Active templates auto-populate (Pass 4). Inactive stays here for reference.
            </Text>
          </View>
        </Pressable>
      </Card>

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
        label={isEdit ? 'Save changes' : 'Save template'}
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

// ─── Surface-specific body components ───────────────────────────────────────

function GymTemplateBody({
  form,
  weightUnit,
  defaultRestSec,
  onChange,
}: {
  form: TemplateForm;
  weightUnit: 'kg' | 'lb';
  defaultRestSec: number;
  onChange: (gym: TemplateForm['gym']) => void;
}) {
  const theme = useTheme();

  function mutateEx(id: string, fn: (e: ExerciseRow) => ExerciseRow) {
    onChange({ exercises: form.gym.exercises.map((e) => (e.id === id ? fn(e) : e)) });
  }
  function addEx() {
    onChange({
      exercises: [...form.gym.exercises, emptyExerciseRow(uuidv7(), uuidv7())],
    });
  }
  function removeEx(id: string) {
    onChange({ exercises: form.gym.exercises.filter((e) => e.id !== id) });
  }
  function mutateSet(exId: string, setId: string, fn: (s: SetRow) => SetRow) {
    mutateEx(exId, (e) => ({
      ...e,
      sets: e.sets.map((s) => (s.id === setId ? fn(s) : s)),
    }));
  }
  function addSet(exId: string) {
    mutateEx(exId, (e) => {
      // Default the new set's targets to the last set's — quality-of-life
      // convenience for ramping or repeating identical sets. User can edit
      // independently.
      const last = e.sets[e.sets.length - 1];
      const seed: SetRow = last
        ? {
            id: uuidv7(),
            targetReps: last.targetReps,
            targetWeight: last.targetWeight,
          }
        : emptySetRow(uuidv7());
      return { ...e, sets: [...e.sets, seed] };
    });
  }
  function removeSet(exId: string, setId: string) {
    mutateEx(exId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== setId) }));
  }

  return (
    <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
      {form.gym.exercises.map((ex, exIdx) => {
        const canRemoveSet = ex.sets.length > 1;
        return (
          <Card key={ex.id} raised style={{ gap: theme.spacing[4] }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[3] }}
            >
              <Field
                label={`Exercise ${exIdx + 1}`}
                value={ex.name}
                onChangeText={(name) => mutateEx(ex.id, (e) => ({ ...e, name }))}
                placeholder="e.g. barbell bench"
                keyboardType="default"
                style={{ flex: 1 }}
              />
              <Pressable
                onPress={() => removeEx(ex.id)}
                accessibilityRole="button"
                accessibilityLabel="Remove exercise"
                hitSlop={8}
                style={{
                  paddingHorizontal: theme.spacing[1],
                  paddingBottom: theme.spacing[2],
                }}
              >
                <Text variant="dataSm" color={theme.colors.textMuted}>
                  ✕
                </Text>
              </Pressable>
            </View>
            <View style={{ gap: theme.spacing[2] }}>
              <Text variant="label">Movement pattern (required)</Text>
              <ChipSelect
                options={PATTERNS}
                value={ex.movementPattern}
                onChange={(p) => mutateEx(ex.id, (e) => ({ ...e, movementPattern: p }))}
              />
            </View>

            {/* Rest between sets — one value applied to every gap in this exercise. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[3] }}>
              <Field
                label="Rest between sets"
                value={ex.restBetweenSets}
                onChangeText={(restBetweenSets) =>
                  mutateEx(ex.id, (e) => ({ ...e, restBetweenSets }))
                }
                placeholder={formatRestSec(defaultRestSec)}
                keyboardType="default"
                style={{ flex: 1 }}
              />
              <Text
                variant="bodySm"
                color={theme.colors.textMuted}
                style={{ paddingBottom: theme.spacing[2] }}
              >
                m:ss
              </Text>
            </View>

            {/* Sets table — weight + reps per set; rest is rendered as a divider between rows */}
            <View style={{ gap: theme.spacing[1] }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
                <Text variant="label" style={{ width: 24 }}>
                  #
                </Text>
                <Text variant="label" style={{ flex: 1.4 }}>
                  Weight
                </Text>
                <Text variant="label" style={{ flex: 1.2 }}>
                  Reps
                </Text>
                <View style={{ width: 24 }} />
              </View>
              {ex.sets.map((s, setIdx) => (
                <View key={s.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: theme.spacing[2],
                      alignItems: 'flex-end',
                    }}
                  >
                    <View style={{ width: 24, paddingBottom: theme.spacing[2] }}>
                      <Text variant="dataSm" color={theme.colors.textMuted}>
                        {setIdx + 1}
                      </Text>
                    </View>
                    <Field
                      value={s.targetWeight}
                      onChangeText={(targetWeight) =>
                        mutateSet(ex.id, s.id, (prev) => ({ ...prev, targetWeight }))
                      }
                      placeholder="—"
                      suffix={weightUnit}
                      style={{ flex: 1.4 }}
                    />
                    <Field
                      value={s.targetReps}
                      onChangeText={(targetReps) =>
                        mutateSet(ex.id, s.id, (prev) => ({ ...prev, targetReps }))
                      }
                      placeholder="5-8"
                      keyboardType="default"
                      style={{ flex: 1.2 }}
                    />
                    <View
                      style={{
                        width: 24,
                        alignItems: 'center',
                        paddingBottom: theme.spacing[2],
                      }}
                    >
                      {canRemoveSet ? (
                        <Pressable
                          onPress={() => removeSet(ex.id, s.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove set ${setIdx + 1}`}
                          hitSlop={8}
                        >
                          <Text variant="dataSm" color={theme.colors.textMuted}>
                            ✕
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {/* Horizontal rest divider — appears between consecutive sets only */}
                  {setIdx < ex.sets.length - 1 ? (
                    <RestDivider
                      restText={ex.restBetweenSets}
                      defaultRestSec={defaultRestSec}
                    />
                  ) : null}
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => addSet(ex.id)}
              accessibilityRole="button"
              accessibilityLabel="Add set"
              hitSlop={8}
              style={{ alignSelf: 'flex-start', paddingVertical: theme.spacing[1] }}
            >
              <Text variant="label" color={theme.colors.sandstone}>
                + Add set
              </Text>
            </Pressable>
          </Card>
        );
      })}
      <Button label="+ Add exercise" variant="secondary" onPress={addEx} />
    </View>
  );
}

/**
 * The horizontal "rest 2:00" divider that sits between each pair of set rows.
 * Falls back to the global default when the user hasn't set a per-exercise
 * value, so the visual stays informative even with the field blank.
 */
function RestDivider({
  restText,
  defaultRestSec,
}: {
  restText: string;
  defaultRestSec: number;
}) {
  const theme = useTheme();
  const parsed = parseRestSec(restText);
  const sec = parsed != null ? parsed : defaultRestSec;
  const isDefault = parsed == null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingLeft: 24 + theme.spacing[2], // align with the weight column
        paddingVertical: theme.spacing[1],
      }}
    >
      <View
        style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }}
      />
      <Text variant="dataSm" color={theme.colors.textMuted}>
        rest {formatRestSec(sec)}
        {isDefault ? ' (default)' : ''}
      </Text>
      <View
        style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }}
      />
    </View>
  );
}

function GpsTemplateBody({
  form,
  distanceUnit,
  onChange,
}: {
  form: TemplateForm;
  distanceUnit: 'km' | 'mi';
  onChange: (gps: TemplateForm['gps']) => void;
}) {
  const theme = useTheme();
  return (
    <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[4] }}>
      <Field
        label={`Target distance (${distanceUnit}, optional)`}
        value={form.gps.targetDistance}
        onChangeText={(targetDistance) => onChange({ ...form.gps, targetDistance })}
        placeholder="—"
        suffix={distanceUnit}
      />
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Energy system</Text>
        <ChipSelect
          options={ENERGY_SYSTEMS}
          value={form.gps.energySystem}
          onChange={(energySystem) => onChange({ ...form.gps, energySystem })}
        />
      </View>
      <Field
        label="Notes (optional)"
        value={form.gps.notes}
        onChangeText={(notes) => onChange({ ...form.gps, notes })}
        placeholder="—"
        keyboardType="default"
      />
    </Card>
  );
}

function PracticeTemplateBody({
  form,
  onChange,
}: {
  form: TemplateForm;
  onChange: (practice: TemplateForm['practice']) => void;
}) {
  const theme = useTheme();
  return (
    <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[4] }}>
      <Field
        label="Target duration (min, optional)"
        value={form.practice.targetDurationMin}
        onChangeText={(targetDurationMin) =>
          onChange({ ...form.practice, targetDurationMin })
        }
        placeholder="60"
        suffix="min"
        keyboardType="number-pad"
      />
      <Field
        label="Style (optional)"
        value={form.practice.style}
        onChangeText={(style) => onChange({ ...form.practice, style })}
        placeholder="e.g. vinyasa, hatha, mobility"
        keyboardType="default"
      />
      <Field
        label="Notes (optional)"
        value={form.practice.notes}
        onChangeText={(notes) => onChange({ ...form.practice, notes })}
        placeholder="—"
        keyboardType="default"
      />
    </Card>
  );
}

function ClimbingTemplateBody({
  form,
  onChange,
}: {
  form: TemplateForm;
  onChange: (climbing: TemplateForm['climbing']) => void;
}) {
  const theme = useTheme();
  return (
    <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[4] }}>
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Style</Text>
        <ChipSelect
          options={CLIMB_STYLES}
          value={form.climbing.style}
          onChange={(style) => onChange({ ...form.climbing, style })}
        />
      </View>
      <Field
        label="Target grade range (optional)"
        value={form.climbing.targetGradeRange}
        onChangeText={(targetGradeRange) =>
          onChange({ ...form.climbing, targetGradeRange })
        }
        placeholder="V3-V5 / 5.10a-5.11b"
        keyboardType="default"
      />
      <Field
        label="Target sends (optional)"
        value={form.climbing.targetSends}
        onChangeText={(targetSends) => onChange({ ...form.climbing, targetSends })}
        placeholder="—"
        keyboardType="number-pad"
      />
      <Field
        label="Notes (optional)"
        value={form.climbing.notes}
        onChangeText={(notes) => onChange({ ...form.climbing, notes })}
        placeholder="—"
        keyboardType="default"
      />
    </Card>
  );
}

function SwimTemplateBody({
  form,
  onChange,
}: {
  form: TemplateForm;
  onChange: (swim: TemplateForm['swim']) => void;
}) {
  const theme = useTheme();
  return (
    <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[4] }}>
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Where</Text>
        <ChipSelect
          options={SWIM_MODES}
          value={form.swim.mode}
          onChange={(mode) => onChange({ ...form.swim, mode })}
        />
      </View>
      {form.swim.mode === 'pool' ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
          <Field
            label="Pool length"
            value={form.swim.poolLengthM}
            onChangeText={(poolLengthM) => onChange({ ...form.swim, poolLengthM })}
            placeholder="25"
            suffix="m"
            keyboardType="number-pad"
            style={{ flex: 1 }}
          />
          <Field
            label="Target laps"
            value={form.swim.targetLaps}
            onChangeText={(targetLaps) => onChange({ ...form.swim, targetLaps })}
            placeholder="—"
            keyboardType="number-pad"
            style={{ flex: 1 }}
          />
        </View>
      ) : (
        <Field
          label="Target distance (m)"
          value={form.swim.targetDistance}
          onChangeText={(targetDistance) => onChange({ ...form.swim, targetDistance })}
          placeholder="—"
          suffix="m"
          keyboardType="number-pad"
        />
      )}
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Stroke</Text>
        <ChipSelect
          options={SWIM_STROKES}
          value={form.swim.stroke}
          onChange={(stroke) => onChange({ ...form.swim, stroke })}
        />
      </View>
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Energy system</Text>
        <ChipSelect
          options={ENERGY_SYSTEMS}
          value={form.swim.energySystem}
          onChange={(energySystem) => onChange({ ...form.swim, energySystem })}
        />
      </View>
      <Field
        label="Notes (optional)"
        value={form.swim.notes}
        onChangeText={(notes) => onChange({ ...form.swim, notes })}
        placeholder="—"
        keyboardType="default"
      />
    </Card>
  );
}

function ActivityPickTile({
  activity,
  onPress,
}: {
  activity: Activity;
  onPress: () => void;
}) {
  const theme = useTheme();
  const Icon = ICONS[activity.icon] ?? ActivityIcon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Template for ${activity.label}`}
      style={{
        width: '30%',
        aspectRatio: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[2],
      }}
    >
      <Icon size={24} color={theme.colors.sandstone} strokeWidth={1.5} />
      <Text variant="label" color={theme.colors.text}>
        {activity.label}
      </Text>
    </Pressable>
  );
}
