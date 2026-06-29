/**
 * Log Food — a modal from Today (Pass 2.5).
 *
 * Two input methods the free data layer fully supports today: **Search & weigh**
 * (USDA/OFF search → pick → enter the mass; high fidelity) and **Describe**
 * (type "8 oz ribeye" → parse → DB match; fidelity from what the parser got).
 * Foods accumulate into a meal you can Log or Save as a template.
 *
 * Fidelity shows only as a visual treatment — the hero block's opacity and a
 * dot marker, never a number. Nutrition focus picks which macro is the hero; it
 * is display-only and changes nothing stored. Partial logs render as valid —
 * missing macros read as "—", with no "complete this" nag. All the logic lives
 * in the tested lib/foodLog + hooks/useFoodLog; this screen is a thin consumer.
 */
import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Screen, Text, Button, Card, Field, ChipSelect, FidelityTreatment, type ChipOption } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { useFoodLog } from '@/hooks/useFoodLog';
import { heroNumber, fidelityTreatment, mealItemsLabel, itemMacroSummary, scaleMacros, type NutritionFocus } from '@/lib/foodLog';
import type { FoodCandidate } from '@/lib/foodSearch';

const MODE_OPTIONS: ChipOption<'weigh' | 'describe'>[] = [
  { value: 'weigh', label: 'Search & weigh' },
  { value: 'describe', label: 'Describe' },
];
const FOCUS_OPTIONS: ChipOption<NutritionFocus>[] = [
  { value: 'calories', label: 'Calories' },
  { value: 'protein', label: 'Protein' },
  { value: 'carbs', label: 'Carbs' },
  { value: 'fat', label: 'Fat' },
];

const macroStr = (v: number | null | undefined): string => (v == null ? '—' : String(Math.round(v)));

function Macro({ label, value }: { label: string; value: number | null | undefined }) {
  const theme = useTheme();
  return (
    <View>
      <Text variant="data">{macroStr(value)}</Text>
      <Text variant="label" color={theme.colors.textSecondary}>{label}</Text>
    </View>
  );
}

export default function LogFood() {
  const theme = useTheme();
  const router = useRouter();
  const settings = useSettings();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const fl = useFoodLog(editId);
  const [focus, setFocus] = useState<NutritionFocus>(settings.nutritionFocus);
  const [grams, setGrams] = useState('');
  const [selected, setSelected] = useState<FoodCandidate | null>(null);
  const [describeText, setDescribeText] = useState('');

  const onLog = async () => {
    if (await fl.logMeal()) router.back();
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: fl.isEdit ? 'Edit meal' : 'Log food' }} />
      <ChipSelect options={MODE_OPTIONS} value={fl.mode} onChange={(m) => { fl.setMode(m); setSelected(null); }} />
      <View style={{ height: theme.spacing[4] }} />

      {fl.mode === 'weigh' ? (
        <View style={{ gap: theme.spacing[3] }}>
          <Field
            label="Search a food"
            value={fl.query}
            onChangeText={(t) => { fl.setQuery(t); setSelected(null); }}
            placeholder="e.g. cheddar cheese"
            keyboardType="default"
            autoFocus
          />
          {fl.searching ? <Text variant="bodySm" color={theme.colors.textMuted}>Searching…</Text> : null}
          {!selected &&
            fl.candidates.map((c) => (
              <Pressable key={`${c.sourceDb}:${c.foodId}`} onPress={() => { setSelected(c); fl.selectFood(c); }}>
                <Card>
                  <Text variant="body">{c.description}</Text>
                  {c.brand ? <Text variant="bodySm" color={theme.colors.textMuted}>{c.brand}</Text> : null}
                </Card>
              </Pressable>
            ))}
          {selected ? (
            <Card raised style={{ gap: theme.spacing[3] }}>
              <Text variant="body">{selected.description}</Text>
              <Field label="Amount" value={grams} onChangeText={setGrams} suffix="g" autoFocus />
              {/* Live "what this portion gives you" — updates as you type the amount. */}
              {Number(grams) > 0 && fl.selectedBasis ? (
                <Text variant="data" color={theme.colors.textSecondary}>
                  {itemMacroSummary(scaleMacros(fl.selectedBasis, Number(grams)))}
                </Text>
              ) : null}
              <Button
                label="Add to meal"
                onPress={async () => {
                  const g = Number(grams);
                  if (g > 0) { await fl.addWeighed(selected, g); setSelected(null); setGrams(''); }
                }}
                disabled={!(Number(grams) > 0)}
                loading={fl.busy}
              />
            </Card>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: theme.spacing[3] }}>
          <Field
            label="Describe a food"
            value={describeText}
            onChangeText={setDescribeText}
            placeholder={'e.g. "8 oz ribeye"'}
            keyboardType="default"
            autoFocus
          />
          <Button
            label="Add to meal"
            onPress={async () => { if (describeText.trim()) { await fl.addDescribed(describeText); setDescribeText(''); } }}
            disabled={!describeText.trim()}
            loading={fl.busy}
          />
        </View>
      )}

      {fl.savedMeals.length > 0 && fl.items.length === 0 ? (
        <View style={{ marginTop: theme.spacing[5], gap: theme.spacing[2] }}>
          <Text variant="label" color={theme.colors.textSecondary}>Saved meals</Text>
          {fl.savedMeals.map((t) => {
            const count = t.canonicalItems.length;
            const label = t.name || mealItemsLabel(t.canonicalItems);
            return (
              <Pressable key={t.id} onPress={() => fl.loadSavedMeal(t)} accessibilityRole="button">
                <Card>
                  <Text variant="body" numberOfLines={1}>
                    {label || `${count} item${count === 1 ? '' : 's'}`}
                  </Text>
                  <Text variant="bodySm" color={theme.colors.textMuted}>
                    {count} item{count === 1 ? '' : 's'} · saved {t.createdAt.slice(0, 10)}
                  </Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {fl.error ? (
        <Text variant="bodySm" color={theme.colors.clay} style={{ marginTop: theme.spacing[2] }}>{fl.error}</Text>
      ) : null}

      {fl.preview ? (
        <Card style={{ marginTop: theme.spacing[5], gap: theme.spacing[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
            <Text variant="label" color={theme.colors.textSecondary}>{fl.description || 'Meal'}</Text>
            <FidelityTreatment fidelity={fl.preview.fidelity} />
          </View>

          <ChipSelect options={FOCUS_OPTIONS} value={focus} onChange={setFocus} />

          {/* Hero + macros treated by fidelity opacity: solid data looks solid, rough looks rough. */}
          <View style={{ opacity: fidelityTreatment(fl.preview.fidelity).opacity, gap: theme.spacing[3] }}>
            <View>
              <Text variant="displayLg" style={{ fontSize: 40, lineHeight: 48 }}>{macroStr(heroNumber(fl.preview.rollup, focus).value)}</Text>
              <Text variant="label" color={theme.colors.textSecondary}>
                {heroNumber(fl.preview.rollup, focus).label} ({heroNumber(fl.preview.rollup, focus).unit})
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing[5] }}>
              <Macro label="Cal" value={fl.preview.rollup.kcal} />
              <Macro label="P" value={fl.preview.rollup.proteinG} />
              <Macro label="C" value={fl.preview.rollup.carbsG} />
              <Macro label="F" value={fl.preview.rollup.fatG} />
            </View>
          </View>

          {fl.items.map((it, i) => (
            <View key={i} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing[3] }}>
                <Text variant="bodySm" color={theme.colors.text} style={{ flex: 1 }} numberOfLines={1}>
                  {it.description ? `${it.description} · ` : ''}{Math.round(it.quantity)} g
                </Text>
                <Pressable onPress={() => fl.removeItem(i)} accessibilityRole="button">
                  <Text variant="bodySm" color={theme.colors.clay}>Remove</Text>
                </Pressable>
              </View>
              <Text variant="bodySm" color={theme.colors.textSecondary}>{itemMacroSummary(it)}</Text>
            </View>
          ))}

          {fl.isEdit ? (
            <Button label="Save changes" onPress={onLog} />
          ) : (
            <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
              <Button label="Log meal" onPress={onLog} style={{ flex: 1 }} />
              <Button label="Save meal" variant="outline" onPress={() => fl.saveMeal()} style={{ flex: 1 }} />
            </View>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
