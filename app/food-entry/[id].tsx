/**
 * Food entry detail — view, edit grams, delete.
 *
 * Edits re-scale macros proportionally from the stored `grams` (or from
 * the original kcal if grams is missing) and persist via supersede so the
 * history is preserved. Delete is a hard delete: food log entries don't
 * earn a tombstone — the trend doesn't depend on them.
 */
import { useState, useEffect, useCallback } from 'react';
import { View, TextInput, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Screen, Text, Card, Button } from '@/components';
import { FidelityIndicator, fidelityLevel } from '@/components/FidelityIndicator';
import { useTheme } from '@/theme';
import {
  getObservationById,
  supersedeObservation,
  deleteObservation,
} from '@/storage/observations';
import { uuidv7 } from '@/lib/id';
import type { Observation, ObservationOf } from '@core/observation';

export default function FoodEntryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [entry, setEntry] = useState<ObservationOf<'foodEntry'> | null>(null);
  const [grams, setGrams] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const obs = await getObservationById(id);
      if (obs && obs.payload.kind === 'foodEntry') {
        const food = obs as ObservationOf<'foodEntry'>;
        setEntry(food);
        setGrams(String(food.payload.grams ?? ''));
      }
    })();
  }, [id]);

  const save = useCallback(async () => {
    if (!entry) return;
    const newGrams = parseFloat(grams);
    if (!isFinite(newGrams) || newGrams <= 0) return;

    const oldGrams = entry.payload.grams;
    if (!oldGrams) {
      Alert.alert('Can\'t re-scale', 'This entry was logged without a gram amount.');
      return;
    }
    const f = newGrams / oldGrams;
    const r1 = (v: number) => Math.round(v * 10) / 10;

    const next: Observation = {
      ...entry,
      id: uuidv7(),
      loggedAt: new Date().toISOString(),
      payload: {
        ...entry.payload,
        grams: newGrams,
        kcal: Math.round(entry.payload.kcal * f),
        proteinG: r1(entry.payload.proteinG * f),
        carbsG: r1(entry.payload.carbsG * f),
        fatG: r1(entry.payload.fatG * f),
        fiberG: entry.payload.fiberG != null ? r1(entry.payload.fiberG * f) : undefined,
      },
    };

    setBusy(true);
    try {
      await supersedeObservation(entry.id, next);
      router.back();
    } finally {
      setBusy(false);
    }
  }, [entry, grams, router]);

  const onDelete = useCallback(() => {
    if (!entry) return;
    Alert.alert(
      'Delete entry?',
      entry.payload.description,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteObservation(entry.id);
              router.back();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [entry, router]);

  if (!entry) {
    return (
      <Screen>
        <Text variant="body" color={theme.colors.textMuted}>
          Loading…
        </Text>
      </Screen>
    );
  }

  const p = entry.payload;
  const time = new Date(entry.occurredAt).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Screen scroll>
      <Card style={{ gap: theme.spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
          <View style={{ flex: 1 }}>
            <Text variant="body" style={{ fontFamily: theme.fonts.body.semibold }}>
              {p.description}
            </Text>
            <Text variant="bodySm" color={theme.colors.textMuted}>
              {time}
            </Text>
          </View>
          <FidelityIndicator level={fidelityLevel(entry.fidelity)} />
        </View>

        <View style={{ height: 1, backgroundColor: theme.colors.border }} />

        <View style={styles.macroRow}>
          <Macro label="CAL" value={String(p.kcal)} highlight />
          <Macro label="P" value={`${p.proteinG}g`} />
          <Macro label="C" value={`${p.carbsG}g`} />
          <Macro label="F" value={`${p.fatG}g`} />
        </View>

        {p.grams != null ? (
          <>
            <View style={{ height: 1, backgroundColor: theme.colors.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
              <Text variant="label">Amount</Text>
              <TextInput
                style={[
                  styles.gramsInput,
                  {
                    backgroundColor: theme.colors.surfaceRaised,
                    color: theme.colors.text,
                    borderColor: theme.colors.borderStrong,
                    fontFamily: theme.fonts.data.medium,
                  },
                ]}
                value={grams}
                onChangeText={setGrams}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <Text variant="body" color={theme.colors.textSecondary}>g</Text>
            </View>
            <Button
              label="Save changes"
              onPress={save}
              loading={busy}
              disabled={String(p.grams) === grams}
            />
          </>
        ) : (
          <Text variant="bodySm" color={theme.colors.textMuted}>
            Logged without a gram amount — re-scaling isn't available.
          </Text>
        )}

        <Button
          label="Delete entry"
          variant="outline"
          onPress={onDelete}
          disabled={busy}
        />
        <Button label="Close" variant="ghost" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

function Macro({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text
        variant={highlight ? 'dataLg' : 'data'}
        color={highlight ? theme.colors.sandstone : theme.colors.text}
      >
        {value}
      </Text>
      <Text variant="label" color={theme.colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  gramsInput: {
    fontSize: 18,
    width: 90,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
