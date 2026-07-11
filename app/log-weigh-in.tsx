/**
 * Log weigh-in — the modal from Today. Pass 3: the real input.
 *
 * Enter a weight, save, and it persists as a tier-1, fidelity-1.0 manual
 * Observation. Today re-fetches on focus and renders it. Storage is always
 * kg; the input shows the user's preferred unit (units.ts).
 *
 * Pass 6 — accepts `?editId=…` to open in edit mode: prefills from the
 * existing observation and saves via updateObservation (hard overwrite; the
 * supersede pattern is deferred to Ring 2).
 */
import { useEffect, useState } from 'react';
import { View, TextInput, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen, Text, Button } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { displayToKg, kgToDisplay } from '@/lib/units';
import {
  createObservation,
  getObservationById,
  updateObservation,
} from '@/storage/observations';
import { deviceTz } from '@/lib/date';
import { uuidv7 } from '@/lib/id';
import type { Observation, ObservationOf } from '@core/observation';

export default function LogWeighInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = typeof editId === 'string' && editId.length > 0;

  const [weight, setWeight] = useState('');
  const [original, setOriginal] = useState<ObservationOf<'weighIn'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the existing observation when editing.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    getObservationById(editId!)
      .then((obs) => {
        if (cancelled || !obs || obs.kind !== 'weighIn') return;
        const w = obs as ObservationOf<'weighIn'>;
        setOriginal(w);
        setWeight(kgToDisplay(w.payload.weightKg, weightUnit).toFixed(1));
      })
      .catch(() => {
        if (!cancelled) setError('Could not load weigh-in.');
      });
    return () => {
      cancelled = true;
    };
  }, [editId, isEdit, weightUnit]);

  const weightNum = parseFloat(weight);
  const weightValid = Number.isFinite(weightNum) && weightNum > 0;

  async function handleSave() {
    if (!weightValid || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);

    const now = new Date().toISOString();
    const payload = {
      kind: 'weighIn' as const,
      weightKg: displayToKg(weightNum, weightUnit),
    };

    try {
      if (isEdit && original) {
        const edited: Observation = { ...original, payload };
        await updateObservation(edited);
      } else {
        const obs: Observation = {
          id: uuidv7(),
          kind: 'weighIn',
          occurredAt: now,
          loggedAt: now,
          tz: deviceTz(),
          tier: 1,
          fidelity: 1.0,
          source: { type: 'manual' },
          payload,
        };
        await createObservation(obs);
      }
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
        {isEdit ? 'Edit weigh-in' : 'Log weigh-in'}
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
        label={isEdit ? 'Save changes' : 'Save weigh-in'}
        onPress={handleSave}
        disabled={!weightValid || (isEdit && !original)}
        loading={saving}
      />
      <View style={{ height: theme.spacing[3] }} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
