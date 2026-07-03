/**
 * Body stats — the profile behind the baseline TDEE (expenditure build, Pass B).
 *
 * Height, birth year, formula sex, optional bodyfat, and the Route-1 activity
 * self-report. These feed exactly one thing: the labeled-weak predicted burn
 * that logged measurement replaces. Weight is deliberately absent — it comes
 * from weigh-ins, never a form field that can go stale.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, Field, ChipSelect } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { useBodyProfile } from '@/hooks/useBodyProfile';
import {
  ACTIVITY_OPTIONS,
  buildBodyProfile,
  emptyBodyProfileForm,
  formFromProfile,
  validateBodyProfileForm,
  type BodyProfileForm,
  type HeightUnit,
} from '@/lib/bodyProfile';
import type { Sex } from '@core/baselineTdee';

const HEIGHT_UNITS: Array<{ value: HeightUnit; label: string }> = [
  { value: 'cm', label: 'cm' },
  { value: 'ftin', label: 'ft / in' },
];
const SEXES: Array<{ value: Sex; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export default function BodyProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const { profile, loading, save } = useBodyProfile();

  // Imperial weight display suggests imperial height entry; the toggle is right there.
  const defaultUnit: HeightUnit = weightUnit === 'lb' ? 'ftin' : 'cm';
  const [form, setForm] = useState<BodyProfileForm>(() => emptyBodyProfileForm(defaultUnit));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nowYear = useMemo(() => new Date().getFullYear(), []);

  // Hydrate once the stored profile arrives (edit mode).
  useEffect(() => {
    if (profile) setForm(formFromProfile(profile, defaultUnit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const set = <K extends keyof BodyProfileForm>(key: K, value: BodyProfileForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const activityDetail = ACTIVITY_OPTIONS.find((o) => o.value === form.activityLevel)?.detail;

  async function handleSave() {
    const reason = validateBodyProfileForm(form, nowYear);
    if (reason) {
      setError(reason);
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      await save(buildBodyProfile(form, nowYear));
      router.back();
    } catch {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  }

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.sandstone}>
        Body stats
      </Text>
      <Text variant="body" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
        These feed the day-one burn estimate — the predicted kind. Your logged
        weigh-ins take over as the trend builds. Weight isn&apos;t asked here;
        it comes from your scale.
      </Text>

      {/* Height */}
      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
        <Text variant="label">Height</Text>
        <ChipSelect
          options={HEIGHT_UNITS}
          value={form.heightUnit}
          onChange={(u) => set('heightUnit', u)}
        />
        {form.heightUnit === 'cm' ? (
          <Field
            value={form.heightCm}
            onChangeText={(t) => set('heightCm', t)}
            placeholder="175"
            suffix="cm"
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: theme.spacing[4] }}>
            <Field
              value={form.heightFt}
              onChangeText={(t) => set('heightFt', t)}
              placeholder="5"
              suffix="ft"
              keyboardType="number-pad"
              style={{ flex: 1 }}
            />
            <Field
              value={form.heightIn}
              onChangeText={(t) => set('heightIn', t)}
              placeholder="10"
              suffix="in"
              keyboardType="number-pad"
              style={{ flex: 1 }}
            />
          </View>
        )}
      </View>

      {/* Birth year */}
      <View style={{ marginTop: theme.spacing[6] }}>
        <Field
          label="Birth year"
          value={form.birthYear}
          onChangeText={(t) => set('birthYear', t)}
          placeholder="1990"
          keyboardType="number-pad"
        />
      </View>

      {/* Formula sex */}
      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
        <Text variant="label">Sex</Text>
        <Text variant="bodySm" color={theme.colors.textMuted}>
          Which BMR formula applies — nothing more.
        </Text>
        <ChipSelect options={SEXES} value={form.sex} onChange={(s) => set('sex', s)} />
      </View>

      {/* Bodyfat (optional) */}
      <View style={{ marginTop: theme.spacing[6] }}>
        <Field
          label="Body fat % (optional)"
          value={form.bodyFatPct}
          onChangeText={(t) => set('bodyFatPct', t)}
          placeholder="—"
          suffix="%"
        />
        <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
          Give more, get sharper: with body fat the estimate uses lean mass and
          the range tightens.
        </Text>
      </View>

      {/* Activity (Route-1 self-report) */}
      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
        <Text variant="label">How active are you, typically?</Text>
        <Text variant="bodySm" color={theme.colors.textMuted}>
          A starting guess, in your own words — measurement replaces it.
        </Text>
        <ChipSelect
          options={ACTIVITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={form.activityLevel}
          onChange={(a) => set('activityLevel', a)}
        />
        {activityDetail ? (
          <Text variant="bodySm" color={theme.colors.textSecondary}>
            {activityDetail}
          </Text>
        ) : null}
      </View>

      {error ? (
        <Text variant="bodySm" color={theme.colors.negative} style={{ marginTop: theme.spacing[4] }}>
          {error}
        </Text>
      ) : null}

      <View style={{ height: theme.spacing[8] }} />
      <Button
        label={profile ? 'Save changes' : 'Save body stats'}
        onPress={handleSave}
        loading={saving}
        disabled={loading}
      />
      <View style={{ height: theme.spacing[3] }} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
