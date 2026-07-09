/**
 * Log ROM check-in — the weigh-in idiom for a self-administered range-of-
 * motion test (Body P7b). Pick a bundled test, enter the reading; storage
 * is always the test's own native unit (cm/degrees) — no conversion layer,
 * unlike weight. `validated` is shown honestly: a published-criterion test
 * reads as "validated protocol", an unvalidated one doesn't claim to be.
 */
import { useEffect, useState } from 'react';
import { View, TextInput, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen, Text, Button, ChipSelect } from '@/components';
import { useTheme } from '@/theme';
import { romTests, romTestById } from '@/data/taxonomies';
import {
  createObservation,
  getObservationById,
  updateObservation,
} from '@/storage/observations';
import { deviceTz } from '@/lib/date';
import { uuidv7 } from '@/lib/id';
import type { Observation, ObservationOf } from '@core/observation';

/** romReading's side is narrower than the shared BodySide — no 'both', a ROM
 *  test is inherently single-limb per reading. */
type RomSide = 'left' | 'right';

export default function LogRomScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = typeof editId === 'string' && editId.length > 0;

  const [testId, setTestId] = useState('');
  const [side, setSide] = useState<RomSide | null>(null);
  const [value, setValue] = useState('');
  const [original, setOriginal] = useState<ObservationOf<'romReading'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    getObservationById(editId!)
      .then((obs) => {
        if (cancelled || !obs || obs.kind !== 'romReading') return;
        const r = obs as ObservationOf<'romReading'>;
        setOriginal(r);
        setTestId(r.payload.testId);
        setValue(String(r.payload.value));
        if (r.payload.side) setSide(r.payload.side);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load check-in.');
      });
    return () => {
      cancelled = true;
    };
  }, [editId, isEdit]);

  const test = romTestById(testId);
  const valueNum = parseFloat(value);
  const valid = test != null && Number.isFinite(valueNum);

  async function handleSave() {
    if (!valid || !test || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);

    const now = new Date().toISOString();
    const payload = {
      kind: 'romReading' as const,
      testId: test.id,
      value: valueNum,
      unit: test.unit,
      ...(test.perSide && side ? { side } : {}),
    };

    try {
      if (isEdit && original) {
        const edited: Observation = { ...original, payload };
        await updateObservation(edited);
      } else {
        const obs: Observation = {
          id: uuidv7(),
          kind: 'romReading',
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
      <Text variant="label" color={theme.colors.sandstone}>
        ROM check-in
      </Text>
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        {isEdit ? 'Edit check-in' : 'Log ROM check-in'}
      </Text>

      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[2] }}>
        <Text variant="label">Test</Text>
        <ChipSelect
          options={romTests().map((t) => ({ value: t.id, label: t.name }))}
          value={testId || null}
          onChange={(id) => {
            setTestId(id);
            setSide(null);
          }}
        />
      </View>

      {test ? (
        <>
          <Text
            variant="bodySm"
            color={theme.colors.textMuted}
            style={{ marginTop: theme.spacing[3] }}
          >
            {test.protocol}
          </Text>
          <Text
            variant="dataSm"
            color={theme.colors.textMuted}
            style={{ marginTop: theme.spacing[1] }}
          >
            {test.validated
              ? 'Validated protocol — published criterion validity.'
              : 'Not a clinically validated protocol — a consistent, repeatable self-test only.'}
          </Text>

          {test.perSide ? (
            <View style={{ marginTop: theme.spacing[4], gap: theme.spacing[2] }}>
              <Text variant="label">Side (optional)</Text>
              <ChipSelect
                options={[
                  { value: 'left' as const, label: 'left' },
                  { value: 'right' as const, label: 'right' },
                ]}
                value={side}
                onChange={setSide}
              />
            </View>
          ) : null}

          <View style={{ marginTop: theme.spacing[6] }}>
            <Text variant="label">Value ({test.unit})</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] }}>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="decimal-pad"
                autoFocus
                style={[inputStyle, { flex: 1, marginTop: theme.spacing[2] }]}
              />
              <Text variant="dataSm" color={theme.colors.textMuted}>
                {test.unit}
              </Text>
            </View>
          </View>
        </>
      ) : null}

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
        label={isEdit ? 'Save changes' : 'Save check-in'}
        onPress={handleSave}
        disabled={!valid || (isEdit && !original)}
        loading={saving}
      />
      <View style={{ height: theme.spacing[3] }} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
