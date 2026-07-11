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
  Flame,
  Drumstick,
  ClipboardCheck,
  ScanLine,
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
  isNutritionDimension,
  type BenchmarkDimension,
  type BenchmarkForm,
  type BenchmarkWindow,
  type FidelityMinTier,
  type IntakeOp,
  type OutcomePairDim,
  type TrendDirection,
} from '@/lib/benchmarkForm';
import { suggestCalorieCeiling, suggestProteinGrams } from '@/lib/benchmarkSuggest';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useBodyProfile } from '@/hooks/useBodyProfile';
import { useExpenditure } from '@/hooks/useExpenditure';
import { metricsFrom } from '@/lib/bodyProfile';
import { estimateBaselineTdee } from '@core/baselineTdee';
import { createBenchmark, getBenchmarkById, updateBenchmark } from '@/storage/benchmarks';
import { headlineActivities, moreActivities, activityById, type Activity } from '@/lib/activity';
import { uuidv7 } from '@/lib/id';
import type { Benchmark, MacroKind } from '@core/benchmark';

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

const INTAKE_OPS_CEILING_FIRST: ChipOption<IntakeOp>[] = [
  { value: 'atMost', label: 'Stay under' },
  { value: 'atLeast', label: 'At least' },
];
const INTAKE_OPS_FLOOR_FIRST: ChipOption<IntakeOp>[] = [
  { value: 'atLeast', label: 'At least' },
  { value: 'atMost', label: 'Stay under' },
];
const MACROS: ChipOption<MacroKind>[] = [
  { value: 'protein', label: 'Protein' },
  { value: 'carbs', label: 'Carbs' },
  { value: 'fat', label: 'Fat' },
  { value: 'fiber', label: 'Fiber' },
];
const MIN_TIERS: ChipOption<FidelityMinTier>[] = [
  { value: 'T2', label: 'T2 or better' },
  { value: 'T3', label: 'T3 only' },
];
const OUTCOME_PAIR_DIMS: ChipOption<OutcomePairDim>[] = [
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'energyBalance', label: 'Energy balance' },
];
const BALANCE_DIRECTIONS: ChipOption<TrendDirection>[] = [
  { value: 'down', label: 'Deficit' },
  { value: 'up', label: 'Surplus' },
];

/** Step-2 header for the nutrition paths. */
const NUTRITION_HEADER: Record<string, string> = {
  calories: 'Calories',
  macro: 'Macros',
  logging: 'Logging',
  fidelity: 'Capture quality',
};

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
  const { weightUnit, deficitKcal } = useSettings();
  const { benchmarkId } = useLocalSearchParams<{ benchmarkId?: string }>();
  const isEdit = typeof benchmarkId === 'string' && benchmarkId.length > 0;

  const [form, setForm] = useState<BenchmarkForm>(emptyBenchmarkForm);
  const [step, setStep] = useState<'dimension' | 'detail'>(isEdit ? 'detail' : 'dimension');
  const [original, setOriginal] = useState<Benchmark | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  // The suggestion inputs (locked: "default the field to the suggestion; let
  // them overwrite it"). Weight = the trend's latest point; TDEE = measured
  // when it exists, else the predicted baseline. Null data → no suggestion —
  // the field stays honestly empty.
  const { points } = useWeightTrend();
  const { profile } = useBodyProfile();
  const { measured } = useExpenditure(points);
  const weightKg = points.length > 0 ? points[points.length - 1].trendKg : null;
  const tdeeKcal =
    measured?.inferredTdeeKcal ??
    (profile && weightKg != null
      ? estimateBaselineTdee(
          metricsFrom(profile, weightKg, new Date().getFullYear()),
          profile.activityLevel
        ).tdeeKcal
      : null);

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
  function pickNutrition(kind: 'calories' | 'macro' | 'logging' | 'fidelity') {
    setForm((f) => {
      const next: BenchmarkForm = {
        ...f,
        dimension: { kind } as BenchmarkDimension,
        secondFace: false,
      };
      // Calculator-suggested, user-owned: prefill only an empty field.
      if (kind === 'calories' && !f.calorieKcal.trim()) {
        const s = suggestCalorieCeiling(tdeeKcal, deficitKcal);
        if (s != null) next.calorieKcal = String(s);
      }
      if (kind === 'macro' && !f.macroGrams.trim() && f.macro === 'protein') {
        const s = suggestProteinGrams(weightKg);
        if (s != null) next.macroGrams = String(s);
      }
      return next;
    });
    setStep('detail');
  }
  // Switching the macro resets the amount deterministically: protein gets its
  // suggestion back; other macros start blank (a protein number would lie there).
  function switchMacro(macro: MacroKind) {
    setForm((f) => ({
      ...f,
      macro,
      macroGrams: macro === 'protein' ? String(suggestProteinGrams(weightKg) ?? '') : '',
    }));
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

        {/* Nutrition family (expenditure build, Pass F) — same grammar, food data. */}
        <Text variant="label" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[6] }}>
          Nutrition
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing[3],
            marginTop: theme.spacing[3],
          }}
        >
          <PickTile label="Calories" Icon={Flame} onPress={() => pickNutrition('calories')} />
          <PickTile label="Protein" Icon={Drumstick} onPress={() => pickNutrition('macro')} />
          <PickTile label="Log food" Icon={ClipboardCheck} onPress={() => pickNutrition('logging')} />
          <PickTile label="Capture" Icon={ScanLine} onPress={() => pickNutrition('fidelity')} />
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

  // Edit mode renders nothing until the benchmark hydrates — otherwise the
  // unhydrated (null-dimension) form falls through to the bodyweight branch
  // and flashes the wrong fields (found by the 2026-07-03 build review).
  if (isEdit && !original) {
    return (
      <Screen>
        {error ? (
          <Text variant="bodySm" color={theme.colors.negative}>
            {error}
          </Text>
        ) : null}
      </Screen>
    );
  }

  const isActivityPath = form.dimension?.kind === 'activity';
  const isNutritionPath = form.dimension != null && isNutritionDimension(form.dimension);
  const headerLabel =
    form.dimension?.kind === 'activity'
      ? activityLabelFor(form.dimension.activityId)
      : isNutritionPath
        ? NUTRITION_HEADER[form.dimension!.kind]
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
      {isNutritionPath ? (
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Watch what?</Text>
          <ChipSelect
            options={OUTCOME_PAIR_DIMS}
            value={form.outcomePairDim}
            onChange={(outcomePairDim) => update({ outcomePairDim })}
          />
        </View>
      ) : null}
      {isNutritionPath && form.outcomePairDim === 'energyBalance' ? (
        <>
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Which way?</Text>
            <ChipSelect
              options={BALANCE_DIRECTIONS}
              value={form.balanceDirection}
              onChange={(balanceDirection) => update({ balanceDirection })}
            />
          </View>
          <Field
            label="Around how much (optional)"
            value={form.balanceKcal}
            onChangeText={(balanceKcal) => update({ balanceKcal })}
            placeholder="—"
            suffix="cal/day"
            keyboardType="number-pad"
          />
          <Text variant="bodySm" color={theme.colors.textMuted}>
            Measured from your logged food and weigh-in trend — it reads
            &ldquo;not enough data&rdquo; until both can carry it. Never predicted.
          </Text>
        </>
      ) : (
        <>
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
        </>
      )}
      {isActivityPath || isNutritionPath ? (
        <RemoveFaceLink onPress={() => update({ secondFace: false })} />
      ) : null}
    </Card>
  );

  // ─── Nutrition behavior cards (days predicates + capture share) ─────────────

  const windowChips = (
    <View style={{ gap: theme.spacing[2] }}>
      <Text variant="label">Per</Text>
      <ChipSelect options={WINDOWS} value={form.window} onChange={(window) => update({ window })} />
    </View>
  );

  const daysField = (
    <Field
      label="On how many days"
      value={form.daysTarget}
      onChangeText={(daysTarget) => update({ daysTarget })}
      placeholder="5"
      suffix="days"
      keyboardType="number-pad"
    />
  );

  const nutritionBehaviorCard = (
    <Card style={{ marginTop: theme.spacing[5], gap: theme.spacing[5] }}>
      <FaceHeader label="Behavior" sub="the part you control" />
      {form.dimension?.kind === 'calories' ? (
        <>
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Direction</Text>
            <ChipSelect
              options={INTAKE_OPS_CEILING_FIRST}
              value={form.calorieOp}
              onChange={(calorieOp) => update({ calorieOp })}
            />
          </View>
          <Field
            label="Calories"
            value={form.calorieKcal}
            onChangeText={(calorieKcal) => update({ calorieKcal })}
            placeholder="2200"
            suffix="cal"
            keyboardType="number-pad"
          />
          {tdeeKcal != null ? (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              Pre-filled from your current burn estimate − {deficitKcal} cal (Settings ›
              Deficit target). Yours to change.
            </Text>
          ) : null}
          {daysField}
          {windowChips}
        </>
      ) : null}
      {form.dimension?.kind === 'macro' ? (
        <>
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Which macro</Text>
            <ChipSelect options={MACROS} value={form.macro} onChange={switchMacro} />
          </View>
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Direction</Text>
            <ChipSelect
              options={INTAKE_OPS_FLOOR_FIRST}
              value={form.macroOp}
              onChange={(macroOp) => update({ macroOp })}
            />
          </View>
          <Field
            label="Amount"
            value={form.macroGrams}
            onChangeText={(macroGrams) => update({ macroGrams })}
            placeholder="150"
            suffix="g"
            keyboardType="number-pad"
          />
          {form.macro === 'protein' && weightKg != null ? (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              Pre-filled at ≈0.8 g per lb of your trend weight. Yours to change.
            </Text>
          ) : null}
          {daysField}
          {windowChips}
        </>
      ) : null}
      {form.dimension?.kind === 'logging' ? (
        <>
          {daysField}
          {windowChips}
          <Text variant="bodySm" color={theme.colors.textMuted}>
            A day counts when everything logged that day carries full macros —
            partial entries leave it short of complete.
          </Text>
        </>
      ) : null}
      {form.dimension?.kind === 'fidelity' ? (
        <>
          <View style={{ gap: theme.spacing[2] }}>
            <Text variant="label">Capture tier</Text>
            <ChipSelect
              options={MIN_TIERS}
              value={form.fidelityMinTier}
              onChange={(fidelityMinTier) => update({ fidelityMinTier })}
            />
          </View>
          <Field
            label="Share of entries"
            value={form.fidelityPct}
            onChangeText={(fidelityPct) => update({ fidelityPct })}
            placeholder="80"
            suffix="%"
            keyboardType="number-pad"
          />
          {windowChips}
          <Text variant="bodySm" color={theme.colors.textMuted}>
            Counts HOW entries were captured — weighed and scanned are T3,
            described and photo are T2, partial logs are T1. Never the
            app&rsquo;s own confidence score.
          </Text>
        </>
      ) : null}
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
      {isActivityPath || isNutritionPath ? (
        <>
          {isNutritionPath ? nutritionBehaviorCard : behaviorCard}
          {form.secondFace ? (
            outcomeCard
          ) : (
            <PairFaceLink
              label="＋ Pair an outcome"
              sub={
                isNutritionPath
                  ? 'bodyweight or energy balance — a measured result to watch'
                  : 'a measured result to watch alongside the rhythm'
              }
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
