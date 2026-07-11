/**
 * Log pain — a standalone flare-up entry, not attached to any session
 * (Body P7b, pt-model.md). A subjective Observation, metric 'pain'. 0 is a
 * deliberate pain-free reading, distinct from never having logged at all —
 * the app never interprets or grades what's entered (FDA wellness framing,
 * informational only).
 */
import { useState } from 'react';
import { View, TextInput, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, ChipSelect } from '@/components';
import { useTheme } from '@/theme';
import { mobilityZones, ZONE_SIDES } from '@/data/taxonomies';
import { createObservation } from '@/storage/observations';
import { deviceTz } from '@/lib/date';
import { uuidv7 } from '@/lib/id';
import type { BodySide, Observation } from '@core/observation';

export default function LogPainScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [zoneId, setZoneId] = useState('');
  const [side, setSide] = useState<BodySide | null>(null);
  const [pain, setPain] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zone = mobilityZones().find((z) => z.id === zoneId);
  const painNum = parseFloat(pain);
  const valid =
    zoneId.trim() !== '' && Number.isInteger(painNum) && painNum >= 0 && painNum <= 10;

  async function handleSave() {
    if (!valid || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);

    const now = new Date().toISOString();
    const obs: Observation = {
      id: uuidv7(),
      kind: 'subjective',
      occurredAt: now,
      loggedAt: now,
      tz: deviceTz(),
      tier: 1,
      fidelity: 1.0,
      source: { type: 'manual' },
      payload: {
        kind: 'subjective',
        metric: 'pain',
        value: painNum,
        zoneId,
        ...(zone?.sided && side ? { side } : {}),
      },
    };

    try {
      await createObservation(obs);
      router.back();
    } catch {
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
    <Screen scroll>
      <Text variant="label" color={theme.colors.accent}>
        Pain
      </Text>
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        Log pain
      </Text>
      <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
        Informational only — the app never diagnoses or interprets what you enter.
      </Text>

      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[2] }}>
        <Text variant="label">Area</Text>
        <ChipSelect
          options={mobilityZones().map((z) => ({ value: z.id, label: z.label }))}
          value={zoneId || null}
          onChange={(id) => {
            setZoneId(id);
            setSide(null);
          }}
        />
      </View>

      {zone?.sided ? (
        <View style={{ marginTop: theme.spacing[4], gap: theme.spacing[2] }}>
          <Text variant="label">Side (optional)</Text>
          <ChipSelect
            options={ZONE_SIDES.map((s) => ({ value: s, label: s }))}
            value={side}
            onChange={setSide}
          />
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing[6] }}>
        <Text variant="label">Pain (0–10)</Text>
        <TextInput
          value={pain}
          onChangeText={setPain}
          placeholder="0"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="number-pad"
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
      <Button label="Save" onPress={handleSave} disabled={!valid} loading={saving} />
      <View style={{ height: theme.spacing[3] }} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
