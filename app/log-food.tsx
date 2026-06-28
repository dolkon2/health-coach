import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Pressable,
  Keyboard,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Card, Button } from '@/components';
import { FidelityIndicator, fidelityLevel } from '@/components/FidelityIndicator';
import { useTheme } from '@/theme';
import { searchFoods, scaleMacros, type FoodResult, type Macros } from '@/services/usda';
import { createObservation } from '@/storage/observations';
import { uuidv7 } from '@/lib/id';
import type { Observation } from '@core/observation';

export default function LogFoodScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [grams, setGrams] = useState('100');
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const foods = await searchFoods(q);
      setResults(foods);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      setSelected(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(text), 400);
    },
    [doSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const selectFood = useCallback((food: FoodResult) => {
    setSelected(food);
    setGrams(String(food.servingSizeG));
    Keyboard.dismiss();
  }, []);

  const logFood = useCallback(async () => {
    if (!selected) return;
    const g = parseFloat(grams) || 100;
    const scaled = scaleMacros(selected.macrosPer100g, g);

    const now = new Date().toISOString();
    const obs: Observation = {
      id: uuidv7(),
      kind: 'foodEntry',
      occurredAt: now,
      loggedAt: now,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tier: 1,
      fidelity: 0.7,
      source: { type: 'foodapi', provider: 'usda', itemId: String(selected.fdcId) },
      payload: {
        kind: 'foodEntry',
        description: selected.description,
        servings: 1,
        kcal: scaled.kcal,
        proteinG: scaled.proteinG,
        carbsG: scaled.carbsG,
        fatG: scaled.fatG,
        fiberG: scaled.fiberG,
      },
    };

    setSaving(true);
    try {
      await createObservation(obs);
      router.back();
    } catch (e) {
      setError('Failed to save');
      setSaving(false);
    }
  }, [selected, grams, router]);

  const g = parseFloat(grams) || 0;
  const scaled = selected ? scaleMacros(selected.macrosPer100g, g) : null;

  return (
    <Screen scroll>
      {/* Search */}
      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            borderColor: theme.colors.border,
            fontFamily: theme.fonts.body.regular,
          },
        ]}
        placeholder="Search foods — e.g. chicken breast, rice"
        placeholderTextColor={theme.colors.textMuted}
        value={query}
        onChangeText={onChangeText}
        autoFocus
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />

      {loading && (
        <ActivityIndicator
          color={theme.colors.sandstone}
          style={{ marginTop: theme.spacing[4] }}
        />
      )}

      {error && (
        <Text variant="bodySm" color={theme.colors.negative} style={{ marginTop: theme.spacing[3] }}>
          {error}
        </Text>
      )}

      {/* Selected food detail */}
      {selected && scaled && (
        <Card style={{ marginTop: theme.spacing[4], gap: theme.spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontFamily: theme.fonts.body.semibold }}>
                {selected.description}
              </Text>
              {selected.brandOwner && (
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  {selected.brandOwner}
                </Text>
              )}
            </View>
            <FidelityIndicator level={fidelityLevel(0.7)} />
          </View>

          {/* Quantity input */}
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

          {/* Macros */}
          <MacroRow macros={scaled} />

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: theme.spacing[3], marginTop: theme.spacing[1] }}>
            <Button
              label="Log food"
              onPress={logFood}
              loading={saving}
              style={{ flex: 1 }}
            />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => setSelected(null)}
            />
          </View>
        </Card>
      )}

      {/* Results list */}
      {!selected && results.length > 0 && (
        <View style={{ marginTop: theme.spacing[3] }}>
          <Text variant="label" style={{ marginBottom: theme.spacing[2] }}>
            {results.length} results
          </Text>
          {results.map((food) => (
            <FoodResultRow key={food.fdcId} food={food} onPress={() => selectFood(food)} />
          ))}
        </View>
      )}

      {!selected && !loading && query.length >= 2 && results.length === 0 && !error && (
        <Text
          variant="body"
          color={theme.colors.textMuted}
          style={{ marginTop: theme.spacing[6], textAlign: 'center' }}
        >
          No foods found for "{query}"
        </Text>
      )}

      <View style={{ height: 40 }} />
    </Screen>
  );
}

function FoodResultRow({ food, onPress }: { food: FoodResult; onPress: () => void }) {
  const theme = useTheme();
  const m = food.macrosPer100g;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.resultRow,
        {
          backgroundColor: pressed ? theme.colors.surfaceRaised : theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body" numberOfLines={2}>
          {food.description}
        </Text>
        {food.brandOwner && (
          <Text variant="bodySm" color={theme.colors.textMuted} numberOfLines={1}>
            {food.brandOwner}
          </Text>
        )}
      </View>
      <View style={styles.macroChips}>
        <MacroChip label="C" value={m.kcal} />
        <MacroChip label="P" value={m.proteinG} />
        <MacroChip label="F" value={m.fatG} />
      </View>
    </Pressable>
  );
}

function MacroChip({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="dataSm" color={theme.colors.textMuted}>
        {label}
      </Text>
      <Text variant="dataSm">{value}</Text>
    </View>
  );
}

function MacroRow({ macros }: { macros: Macros }) {
  const theme = useTheme();
  const items = [
    { label: 'CAL', value: String(macros.kcal), highlight: true },
    { label: 'P', value: `${macros.proteinG}g` },
    { label: 'C', value: `${macros.carbsG}g` },
    { label: 'F', value: `${macros.fatG}g` },
  ];

  return (
    <View style={styles.macroRow}>
      {items.map((item) => (
        <View key={item.label} style={{ alignItems: 'center', flex: 1 }}>
          <Text
            variant={item.highlight ? 'dataLg' : 'data'}
            color={item.highlight ? theme.colors.sandstone : theme.colors.text}
          >
            {item.value}
          </Text>
          <Text variant="label" color={theme.colors.textMuted}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    fontSize: 15,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  gramsInput: {
    fontSize: 18,
    width: 80,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  macroChips: {
    flexDirection: 'row',
    gap: 12,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});
