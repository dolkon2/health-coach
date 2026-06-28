/**
 * DailyIntakeCard — what you've eaten today.
 *
 * Reads food entries for the local civil day, sums macros, surfaces fidelity
 * as a visual property (constitution: confidence is a visual property, not
 * metadata). No targets, no percentages, no progress bars — just what
 * actually happened, and how confidently it was captured.
 */
import { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card } from './Card';
import { Text } from './Text';
import { Button } from './Button';
import { FidelityIndicator, fidelityLevel } from './FidelityIndicator';
import { useTheme } from '@/theme';
import { listFoodEntriesForDay, totalsFromEntries } from '@/storage/queries';
import type { DailyIntakeTotals } from '@/storage/queries';
import type { ObservationOf } from '@core/observation';

export function DailyIntakeCard() {
  const theme = useTheme();
  const router = useRouter();
  const [entries, setEntries] = useState<ObservationOf<'foodEntry'>[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listFoodEntriesForDay();
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totals = totalsFromEntries(entries);

  return (
    <Card style={{ gap: theme.spacing[3] }}>
      <View style={styles.headerRow}>
        <Text variant="label">Food today</Text>
        {totals.entryCount > 0 && (
          <FidelityIndicator level={fidelityLevel(totals.fidelity)} />
        )}
      </View>

      {!loaded || totals.entryCount === 0 ? (
        <Text variant="body" color={theme.colors.textMuted}>
          {loaded ? 'Not logged.' : ''}
        </Text>
      ) : (
        <>
          <View style={styles.totalsRow}>
            <View>
              <Text variant="dataLg" color={theme.colors.sandstone}>
                {totals.kcal}
              </Text>
              <Text variant="label" color={theme.colors.textMuted}>
                CAL
              </Text>
            </View>
            <View style={styles.macroGroup}>
              <MacroCell label="P" grams={totals.proteinG} />
              <MacroCell label="C" grams={totals.carbsG} />
              <MacroCell label="F" grams={totals.fatG} />
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: theme.colors.border }} />

          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onPress={() => router.push(`/food-entry/${entry.id}`)}
            />
          ))}
        </>
      )}

      <Button
        label="Log food"
        onPress={() => router.push('/log-food')}
        style={{ marginTop: theme.spacing[1] }}
      />
    </Card>
  );
}

function MacroCell({ label, grams }: { label: string; grams: number }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="data">{grams}g</Text>
      <Text variant="label" color={theme.colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

function EntryRow({
  entry,
  onPress,
}: {
  entry: ObservationOf<'foodEntry'>;
  onPress: () => void;
}) {
  const theme = useTheme();
  const time = new Date(entry.occurredAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.entryRow,
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={1}>
          {entry.payload.description}
        </Text>
        <Text variant="bodySm" color={theme.colors.textMuted}>
          {time}
        </Text>
      </View>
      <Text variant="data" color={theme.colors.textSecondary}>
        {entry.payload.kcal}
      </Text>
      <FidelityIndicator level={fidelityLevel(entry.fidelity)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  macroGroup: {
    flexDirection: 'row',
    gap: 20,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
});
