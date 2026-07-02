/**
 * Edit Benchmark — create or edit a benchmark via Structured entry (v0.4 faces).
 *
 * Reached from /benchmarks as a push: with `?benchmarkId=…` to edit, without to
 * create. Step 1 picks a tracked dimension and seeds the PRIMARY face (an
 * activity → a behavior rhythm, bodyweight → an outcome movement); step 2 fills
 * the natural target and offers the other face as an optional PAIRING — never
 * pushed, one tap to add, one to remove. The faces fall out of which fields you
 * filled — there is still no goal-type picker (benchmarks-spec.md, "The two
 * faces of every benchmark"). This is the deterministic v1 path: no parser, no LLM.
 *
 * The pure logic (form → Benchmark, validation, summary) lives in
 * lib/benchmarkForm.ts; this screen is the form shell around it.
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
  Scale,
  Activity as ActivityIcon,
} from 'lucide-react-native';
import { Screen, Text, Button, Card, Field, ChipSelect, type ChipOption } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import {
  emptyBenchmarkForm,
  buildBenchmarkFields,
  validateBenchmarkForm,
  formFromBenchmark,
  defaultTitle,
  type BenchmarkForm,
  type BenchmarkWindow,
  type TrendDirection,
} from '@/lib/benchmarkForm';
import { createBenchmark, getBenchmarkById, updateBenchmark } from '@/storage/benchmarks';
import { headlineActivities, moreActivities, activityById, type Activity } from '@/lib/activity';
import { uuidv7 } from '@/lib/id';
import type { Benchmark } from '@core/benchmark';

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

const WINDOWS: ChipOption<BenchmarkWindow>[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const DIRECTIONS: ChipOption<TrendDirection>[] = [
  { value: 'down', label: 'Lose' },
  { value: 'up', label: 'Gain' },
];

/** Chip sentinel for "any logged session" in the paired-behavior picker —
 *  maps to `pairedActivityId: null` (a bare sessionCount dimension). */
const ANY_SESSION = 'any';
const pairedActivityOptions: ChipOption<string>[] = [
  { value: ANY_SESSION, label: 'Any' },
  ...headlineActivities().map((a) => ({ value: a.id, label: a.label })),
];

export default function EditBenchmarkScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const { benchmarkId } = useLocalSearchParams<{ benchmarkId?: string }>();
  const isEdit = typeof benchmarkId === 'string' && benchmarkId.length > 0;

  const [form, setForm] = useState<BenchmarkForm>(emptyBenchmarkForm);
  const [step, setStep] = useState<'dimension' | 'detail'>(isEdit ? 'detail' : 'dimension');
  const [original, setOriginal] = useState<Benchmark | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    getBenchmarkById(benchmarkId!)
      .then((b) => {
        if (cancelled || !b) return;
        setOriginal(b);
        setForm(formFromBenchmark(b, weightUnit));
      })
      .catch(() => {
        if (!cancelled) setError('Could not load benchmark.');
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, benchmarkId, weightUnit]);

  const update = (patch: Partial<BenchmarkForm>) => setForm((f) => ({ ...f, ...patch }));

  // Switching the step-1 pick drops any pairing — the paired face belongs to
  // the path it was added on.
  function pickActivity(a: Activity) {
    setForm((f) => ({ ...f, dimension: { kind: 'activity', activityId: a.id }, secondFace: false }));
    setStep('detail');
  }
  function pickBodyweight() {
    setForm((f) => ({ ...f, dimension: { kind: 'bodyweight' }, secondFace: false }));
    setStep('detail');
  }

  const validationError = validateBenchmarkForm(form);

  async function handleSave() {
    if (validationError || saving) return;
    if (isEdit && !original) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const fields = buildBenchmarkFields(form, weightUnit);
      if (isEdit && original) {
        await updateBenchmark(original.id, fields);
      } else {
        const now = new Date().toISOString();
        const b: Benchmark = {
          id: uuidv7(),
          createdAt: now,
          status: 'active',
          pinned: true, // new benchmarks surface on Today by default
          ...fields,
        };
        await createBenchmark(b);
      }
      router.back();
    } catch {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  }

  // Archiving sets something down — no ceremony (benchmarks-spec.md, "Archiving").
  async function setStatus(status: Benchmark['status']) {
    if (!original || saving) return;
    setSaving(true);
    try {
      await updateBenchmark(original.id, {
        status,
        resolvedAt: status === 'active' ? undefined : new Date().toISOString(),
      });
      router.back();
    } catch {
      setError('Could not update. Try again.');
      setSaving(false);
    }
  }

  // Pin controls which active benchmarks surface on Today — a light toggle,
  // flipped in place (unlike Archive, it doesn't change where you are).
  async function togglePin() {
    if (!original || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBenchmark(original.id, { pinned: !original.pinned });
      setOriginal(updated);
    } catch {
      setError('Could not update. Try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Step 1: pick a tracked dimension ──────────────────────────────────────

  if (step === 'dimension') {
    const headline = headlineActivities();
    const more = moreActivities();
    return (
      <Screen scroll>
        <Text variant="label" color={theme.colors.sandstone}>
          New benchmark
        </Text>
        <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
          What are you working toward?
        </Text>
        <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[3] }}>
          Pick something you already track. How you set it decides the rest — there's no goal-type menu.
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
            <PickTile key={a.id} label={a.label} Icon={ICONS[a.icon] ?? ActivityIcon} onPress={() => pickActivity(a)} />
          ))}
          <PickTile label="Bodyweight" Icon={Scale} onPress={pickBodyweight} />
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
              <PickTile key={a.id} label={a.label} Icon={ICONS[a.icon] ?? ActivityIcon} onPress={() => pickActivity(a)} />
            ))}
          </View>
        ) : null}

        <View style={{ height: theme.spacing[8] }} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  // ─── Step 2: fill the faces ────────────────────────────────────────────────

  const isActivityPath = form.dimension?.kind === 'activity';
  const headerLabel = isActivityPath
    ? form.dimension && form.dimension.kind === 'activity'
      ? activityLabelFor(form.dimension.activityId)
      : ''
    : 'Bodyweight';

  const behaviorCard = (
    <Card style={{ marginTop: theme.spacing[5], gap: theme.spacing[5] }}>
      <FaceHeader label="Behavior" sub="the part you control" />
      {!isActivityPath ? (
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Sessions that count</Text>
          <ChipSelect
            options={pairedActivityOptions}
            value={form.pairedActivityId ?? ANY_SESSION}
            onChange={(v) => update({ pairedActivityId: v === ANY_SESSION ? null : v })}
          />
        </View>
      ) : null}
      <Field
        label="How many times"
        value={form.count}
        onChangeText={(count) => update({ count })}
        placeholder="4"
        suffix="×"
        keyboardType="number-pad"
      />
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Per</Text>
        <ChipSelect options={WINDOWS} value={form.window} onChange={(window) => update({ window })} />
      </View>
      {!isActivityPath ? <RemoveFaceLink onPress={() => update({ secondFace: false })} /> : null}
    </Card>
  );

  const outcomeCard = (
    <Card style={{ marginTop: theme.spacing[5], gap: theme.spacing[5] }}>
      <FaceHeader label="Outcome" sub="the part you watch" />
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Which way?</Text>
        <ChipSelect
          options={DIRECTIONS}
          value={form.direction}
          onChange={(direction) => update({ direction })}
        />
      </View>
      <Field
        label={`Target weight (${weightUnit}, optional)`}
        value={form.target}
        onChangeText={(target) => update({ target })}
        placeholder="—"
        suffix={weightUnit}
        keyboardType="decimal-pad"
      />
      <Text variant="bodySm" color={theme.colors.textMuted}>
        Leave the target blank to just track the direction.
      </Text>
      {isActivityPath ? <RemoveFaceLink onPress={() => update({ secondFace: false })} /> : null}
    </Card>
  );

  return (
    <Screen scroll>
      {!isEdit ? (
        <Pressable onPress={() => setStep('dimension')} accessibilityRole="button">
          <Text variant="label" color={theme.colors.sandstone}>
            ‹ {headerLabel}
          </Text>
        </Pressable>
      ) : (
        <Text variant="label" color={theme.colors.sandstone}>
          {headerLabel}
        </Text>
      )}
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        {isEdit ? 'Edit benchmark' : 'New benchmark'}
      </Text>

      {/* Primary face first — the one the step-1 pick seeded — then the
          optional pairing. Never pushed: a quiet link, one tap to remove. */}
      {isActivityPath ? (
        <>
          {behaviorCard}
          {form.secondFace ? (
            outcomeCard
          ) : (
            <PairFaceLink
              label="＋ Pair an outcome"
              sub="a measured result to watch alongside the rhythm"
              onPress={() => update({ secondFace: true })}
            />
          )}
        </>
      ) : (
        <>
          {outcomeCard}
          {form.secondFace ? (
            behaviorCard
          ) : (
            <PairFaceLink
              label="＋ Pair a behavior"
              sub="a session rhythm to hold on the way — your path to it"
              onPress={() => update({ secondFace: true })}
            />
          )}
        </>
      )}

      <Card style={{ marginTop: theme.spacing[5] }}>
        <Field
          label="Name it (optional)"
          value={form.title}
          onChangeText={(title) => update({ title })}
          placeholder={defaultTitle(form, weightUnit) || 'Your goal, in your words'}
          keyboardType="default"
        />
      </Card>

      {validationError ? (
        <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[4] }}>
          {validationError}
        </Text>
      ) : null}
      {error ? (
        <Text variant="bodySm" color={theme.colors.negative} style={{ marginTop: theme.spacing[2] }}>
          {error}
        </Text>
      ) : null}

      <View style={{ height: theme.spacing[6] }} />
      <Button
        label={isEdit ? 'Save changes' : 'Save benchmark'}
        onPress={handleSave}
        disabled={validationError !== null || (isEdit && !original)}
        loading={saving}
      />
      <View style={{ height: theme.spacing[3] }} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />

      {isEdit && original ? (
        <>
          <View style={{ height: theme.spacing[8] }} />
          {original.status === 'active' ? (
            <>
              <Button
                label={original.pinned ? 'Unpin from Today' : 'Pin to Today'}
                variant="ghost"
                onPress={togglePin}
              />
              <Button label="Archive" variant="ghost" onPress={() => setStatus('abandoned')} />
            </>
          ) : (
            <Button label="Reactivate" variant="ghost" onPress={() => setStatus('active')} />
          )}
        </>
      ) : null}

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}

function activityLabelFor(activityId: string): string {
  return activityById(activityId)?.label ?? activityId;
}

/** The face card's heading: which face this is, and which register it lives in
 *  (behavior: sovereign, you control it; outcome: observed, you watch it). */
function FaceHeader({ label, sub }: { label: string; sub: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: theme.spacing[3],
      }}
    >
      <Text variant="label" color={theme.colors.sandstone}>
        {label}
      </Text>
      <Text variant="bodySm" color={theme.colors.textMuted}>
        {sub}
      </Text>
    </View>
  );
}

/** The quiet offer to pair the other face — a link, never a nudge. */
function PairFaceLink({
  label,
  sub,
  onPress,
}: {
  label: string;
  sub: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ marginTop: theme.spacing[4], gap: theme.spacing[1] }}
    >
      <Text variant="label" color={theme.colors.sandstone}>
        {label}
      </Text>
      <Text variant="bodySm" color={theme.colors.textMuted}>
        {sub}
      </Text>
    </Pressable>
  );
}

function RemoveFaceLink({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Remove this face">
      <Text variant="label" color={theme.colors.textMuted}>
        Remove
      </Text>
    </Pressable>
  );
}

function PickTile({
  label,
  Icon,
  onPress,
}: {
  label: string;
  Icon: IconCmp;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Benchmark for ${label}`}
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
        {label}
      </Text>
    </Pressable>
  );
}
