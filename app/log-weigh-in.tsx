/**
 * Log weigh-in — the modal from Today. Pass 3: the real input.
 *
 * Enter a weight (and optionally body-fat %), save, and it persists as a tier-1,
 * fidelity-1.0 manual Observation. Today re-fetches on focus and renders it.
 * Storage is always kg; the input shows the user's preferred unit (units.ts).
 */
import { useState } from 'react';
import { View, TextInput, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { displayToKg } from '@/lib/units';
import { createObservation } from '@/storage/observations';
import { deviceTz } from '@/lib/date';
import { uuidv7 } from '@/lib/id';
import type { Observation } from '@core/observation';

export default function LogWeighInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();

  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightNum = parseFloat(weight);
  const bodyFatNum = parseFloat(bodyFat);
  const weightValid = Number.isFinite(weightNum) && weightNum > 0;

  async function handleSave() {
    if (!weightValid || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);

    const now = new Date().toISOString();
    const obs: Observation = {
      id: uuidv7(),
      kind: 'weighIn',
      occurredAt: now,
      loggedAt: now,
      tz: deviceTz(),
      tier: 1,
      fidelity: 1.0,
      source: { type: 'manual' },
      payload: {
        kind: 'weighIn',
        weightKg: displayToKg(weightNum, weightUnit),
        ...(Number.isFinite(bodyFatNum) && bodyFatNum > 0
          ? { bodyFatPct: bodyFatNum }
          : {}),
      },
    };

    try {
      await createObservation(obs);
      router.back();
    } catch (e) {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  }

  const inputStyle = {
    ...theme.type.dataLg,
    color: theme.colors.text,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing[2],
  };

  return (
    <Screen>
      <Text variant="label" color={theme.colors.sandstone}>
        Weigh-in
      </Text>
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        Log weigh-in
      </Text>

      {/* Weight */}
      <View style={{ marginTop: theme.spacing[8] }}>
        <Text variant="label">Weight ({weightUnit})</Text>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] }}
        >
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="0.0"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="decimal-pad"
            autoFocus
            style={[inputStyle, { flex: 1, marginTop: theme.spacing[2] }]}
          />
          <Text variant="dataSm" color={theme.colors.textMuted}>
            {weightUnit}
          </Text>
        </View>
      </View>

      {/* Body fat (optional) */}
      <View style={{ marginTop: theme.spacing[6] }}>
        <Text variant="label">Body fat % (optional)</Text>
        <TextInput
          value={bodyFat}
          onChangeText={setBodyFat}
          placeholder="—"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
          style={[inputStyle, { marginTop: theme.spacing[2] }]}
        />
      </View>

      {error ? (
        <Text
          variant="bodySm"
          color={theme.colors.negative}
          style={{ marginTop: theme.spacing[4] }}
        >
          {error}
        </Text>
      ) : null}

      <View style={{ height: theme.spacing[8] }} />
      <Button
        label="Save weigh-in"
        onPress={handleSave}
        disabled={!weightValid}
        loading={saving}
      />
      <View style={{ height: theme.spacing[3] }} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
