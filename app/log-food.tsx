/**
 * Log Food — a modal from Today (Pass 2.5).
 *
 * Two input methods the free data layer fully supports today: **Search & weigh**
 * (USDA/OFF search → pick → enter the mass; high fidelity) and **Describe**
 * (type "8 oz ribeye" → parse → DB match; fidelity from what the parser got).
 * Foods accumulate into a meal you can Log or Save as a template.
 *
 * Layout: saved meals are a persistent horizontal row at the top (re-log a
 * template in one tap). The Log / Save buttons sit in a sticky footer so the
 * commit action is always one tap away regardless of scroll position. Fidelity
 * shows only as a visual treatment — the hero block's opacity and a dot marker,
 * never a number. All the logic lives in the tested lib/foodLog +
 * hooks/useFoodLog; this screen is a thin consumer.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Text, Button, Card, Field, ChipSelect, FidelityTreatment, type ChipOption } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { useFoodLog } from '@/hooks/useFoodLog';
import { noonOfLocalDate } from '@/lib/date';
import { heroNumber, fidelityTreatment, mealItemsLabel, itemMacroSummary, scaleMacros, recomputeKcal, type NutritionFocus } from '@/lib/foodLog';
import type { FoodCandidate } from '@/lib/foodSearch';
import type { FoodItem, MealTemplate } from '@core/observation';

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

/** Field <-> nullable-number bridges for the estimate editor. Empty = null
 *  (honesty: a blank macro is "not captured", never 0). */
const numToField = (v: number | null | undefined): string => (v == null ? '' : String(v));
const fieldToNum = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * EstimateItemEditor — inline editor for one keyless estimate row (Decision E).
 * Reuses Field for every value. Editing a macro recomputes calories (4/4/9 +
 * alcohol) ONLY when protein, carbs, and fat are all present — a blank macro
 * stays null and never zero-fills the calorie total (null ≠ 0). Mirrors the
 * Search & weigh detail pane; commits on Done.
 */
function EstimateItemEditor({
  item,
  onSave,
  onRemove,
}: {
  item: FoodItem;
  onSave: (patch: Partial<FoodItem>) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(item.description ?? '');
  const [portion, setPortion] = useState(item.portionText ?? '');
  const [kcal, setKcal] = useState(numToField(item.kcal));
  const [protein, setProtein] = useState(numToField(item.proteinG));
  const [carbs, setCarbs] = useState(numToField(item.carbsG));
  const [fat, setFat] = useState(numToField(item.fatG));

  // Recompute calories from the edited macros — guarded so a blank macro never
  // becomes a fake 0 in the total. When any macro is blank, calories stay as set.
  const recompute = (p: string, c: string, f: string) => {
    const k = recomputeKcal({
      proteinG: fieldToNum(p),
      carbsG: fieldToNum(c),
      fatG: fieldToNum(f),
      alcoholG: item.alcoholG,
    });
    if (k != null) setKcal(String(k));
  };

  return (
    <Card raised style={{ gap: theme.spacing[3] }}>
      <Field label="Food" value={name} onChangeText={setName} keyboardType="default" />
      <Field label="Portion" value={portion} onChangeText={setPortion} placeholder="e.g. 2 eggs" keyboardType="default" />
      <View style={{ flexDirection: 'row', gap: theme.spacing[4] }}>
        <Field label="Calories" value={kcal} onChangeText={setKcal} style={{ flex: 1 }} />
        <Field
          label="Protein"
          value={protein}
          onChangeText={(v) => { setProtein(v); recompute(v, carbs, fat); }}
          suffix="g"
          style={{ flex: 1 }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing[4] }}>
        <Field
          label="Carbs"
          value={carbs}
          onChangeText={(v) => { setCarbs(v); recompute(protein, v, fat); }}
          suffix="g"
          style={{ flex: 1 }}
        />
        <Field
          label="Fat"
          value={fat}
          onChangeText={(v) => { setFat(v); recompute(protein, carbs, v); }}
          suffix="g"
          style={{ flex: 1 }}
        />
      </View>
      <Text variant="bodySm" color={theme.colors.textSecondary}>
        {itemMacroSummary({
          kcal: fieldToNum(kcal),
          proteinG: fieldToNum(protein),
          carbsG: fieldToNum(carbs),
          fatG: fieldToNum(fat),
        })}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        <Button
          label="Done"
          onPress={() =>
            onSave({
              description: name.trim() || item.description,
              portionText: portion.trim() || undefined,
              kcal: fieldToNum(kcal),
              proteinG: fieldToNum(protein),
              carbsG: fieldToNum(carbs),
              fatG: fieldToNum(fat),
            })
          }
          style={{ flex: 1 }}
        />
        <Button label="Remove" variant="outline" onPress={onRemove} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/**
 * SavedMealsRow — horizontal row of meal-template cards above the search field.
 *
 * Tapping a card loads its items into the in-flight meal; we gate visibility on
 * `items.length === 0` so a tap can't silently discard a meal in progress (the
 * loadSavedMeal call replaces `items`). Hidden in edit mode — when editing one
 * meal, re-logging a different template isn't a sensible action.
 */
function SavedMealsRow({
  saved,
  onPick,
  onDelete,
}: {
  saved: MealTemplate[];
  onPick: (t: MealTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Text variant="label" color={theme.colors.textSecondary}>Saved meals</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing[3], paddingRight: theme.spacing[4] }}
      >
        {saved.map((t) => {
          const count = t.canonicalItems.length;
          const label = t.name || mealItemsLabel(t.canonicalItems) || `${count} item${count === 1 ? '' : 's'}`;
          return (
            <Pressable key={t.id} onPress={() => onPick(t)} accessibilityRole="button">
              <Card style={{ width: 160 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); onDelete(t.id); }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete saved meal"
                  >
                    <Text variant="bodySm" color={theme.colors.textMuted}>✕</Text>
                  </Pressable>
                </View>
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  {count} item{count === 1 ? '' : 's'}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function LogFood() {
  const theme = useTheme();
  const router = useRouter();
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const { editId, date: dateParam } = useLocalSearchParams<{ editId?: string; date?: string }>();
  // When the Nutrition tab opens this screen from a past or future day,
  // it passes ?date=YYYY-MM-DD — default the meal's occurredAt to noon of
  // that day. Today's "Log food" passes no `date`, so this stays undefined
  // and useFoodLog falls through to "now" (preserves Pass 1 behavior).
  const defaultOccurredAt = useMemo(
    () => (dateParam ? noonOfLocalDate(dateParam) : undefined),
    [dateParam]
  );
  const fl = useFoodLog(editId, defaultOccurredAt);
  const scrollRef = useRef<ScrollView>(null);
  const [focus, setFocus] = useState<NutritionFocus>(settings.nutritionFocus);
  const [grams, setGrams] = useState('');
  const [selected, setSelected] = useState<FoodCandidate | null>(null);
  const [describeText, setDescribeText] = useState('');
  // Android renders DateTimePicker as a modal opened on tap; iOS uses the
  // inline compact button. The state only gates the Android branch.
  const [showPicker, setShowPicker] = useState(false);
  // Which estimate row is open in the inline editor (Decision E), or null.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Dismissal that survives a missing back-stack (e.g. when the screen was
  // deep-linked or opened with no parent route) — fall back to the Today tab
  // instead of dispatching a GO_BACK action no navigator can handle.
  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const onLog = async () => {
    if (await fl.logMeal()) dismiss();
  };

  const onPickSavedMeal = useCallback((t: MealTemplate) => {
    fl.loadSavedMeal(t);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [fl.loadSavedMeal]);

  const showSavedMealsRow = !fl.isEdit && fl.savedMeals.length > 0 && fl.items.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen
        options={{
          title: fl.isEdit ? 'Edit meal' : 'Log food',
          // Explicit dismiss affordance — the modal swipe-down can be missed,
          // and a corrupted nav stack would leave a back-gesture stranded.
          headerLeft: () => (
            <Pressable onPress={dismiss} accessibilityRole="button" hitSlop={12}>
              <Text variant="body" color={theme.colors.sandstone}>Cancel</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing[6], paddingBottom: theme.spacing[4] }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {showSavedMealsRow ? (
          <>
            <SavedMealsRow saved={fl.savedMeals} onPick={onPickSavedMeal} onDelete={fl.deleteSavedMeal} />
            <View style={{ height: theme.spacing[4] }} />
          </>
        ) : null}

        <ChipSelect options={MODE_OPTIONS} value={fl.mode} onChange={(m) => { fl.setMode(m); setSelected(null); setEditingIndex(null); }} />
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
            {!selected && fl.recents.length > 0 && (
              <View style={{ gap: theme.spacing[2] }}>
                <Text variant="label" color={theme.colors.textSecondary}>Recent</Text>
                {fl.recents.map((r) => (
                  <Pressable key={`recent:${r.item.foodId}`} onPress={() => fl.addRecent(r.item)}>
                    <Card>
                      <Text variant="body">{r.item.description} · {Math.round(r.item.quantity)} g</Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}
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

        {fl.error ? (
          <Text variant="bodySm" color={theme.colors.clay} style={{ marginTop: theme.spacing[2] }}>{fl.error}</Text>
        ) : null}

        {fl.preview ? (
          <Card style={{ marginTop: theme.spacing[5], gap: theme.spacing[3] }}>
            {/* Optional meal name. Blank by default — the display layer falls back
                to "First item + N more" via mealDisplayName, so an unnamed meal
                never masquerades as one ingredient on the cards. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Name this meal"
                  value={fl.description}
                  onChangeText={fl.setDescription}
                  placeholder="optional"
                />
              </View>
              <View style={{ paddingBottom: theme.spacing[2] }}>
                <FidelityTreatment fidelity={fl.preview.fidelity} />
              </View>
            </View>

            {/* When? — defaults to now / noon of the chosen day / original eaten time
                (edit mode), adjustable via the native picker. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
              <Text variant="label" color={theme.colors.textSecondary}>When?</Text>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={new Date(fl.occurredAt)}
                  mode="datetime"
                  display="compact"
                  themeVariant="dark"
                  onChange={(_e, d) => {
                    if (d) fl.setOccurredAt(d.toISOString());
                  }}
                />
              ) : (
                <>
                  <Pressable onPress={() => setShowPicker(true)} accessibilityRole="button">
                    <Text variant="body">
                      {new Date(fl.occurredAt).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Pressable>
                  {showPicker ? (
                    <DateTimePicker
                      value={new Date(fl.occurredAt)}
                      mode="datetime"
                      display="default"
                      onChange={(_e, d) => {
                        setShowPicker(false);
                        if (d) fl.setOccurredAt(d.toISOString());
                      }}
                    />
                  ) : null}
                </>
              )}
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

            {fl.items.map((it, i) => {
              const isEstimate = it.foodId == null;
              if (isEstimate && editingIndex === i) {
                return (
                  <EstimateItemEditor
                    key={i}
                    item={it}
                    onSave={(patch) => { fl.updateItem(i, patch); setEditingIndex(null); }}
                    onRemove={() => { fl.removeItem(i); setEditingIndex(null); }}
                  />
                );
              }
              // Per-row fidelity opacity: an estimate looks rough, a weighed item solid.
              return (
                <View key={i} style={{ gap: 2, opacity: fidelityTreatment(it.fidelity).opacity }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing[3] }}>
                    <Text variant="bodySm" color={theme.colors.text} style={{ flex: 1 }} numberOfLines={1}>
                      {it.description ? `${it.description} · ` : ''}{it.portionText ?? `${Math.round(it.quantity)} g`}
                    </Text>
                    {isEstimate ? (
                      <Pressable onPress={() => setEditingIndex(i)} accessibilityRole="button" hitSlop={6}>
                        <Text variant="bodySm" color={theme.colors.sandstone}>Edit</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => { fl.removeItem(i); setEditingIndex(null); }} accessibilityRole="button" hitSlop={6}>
                      <Text variant="bodySm" color={theme.colors.clay}>Remove</Text>
                    </Pressable>
                  </View>
                  <Text variant="bodySm" color={theme.colors.textSecondary}>{itemMacroSummary(it)}</Text>
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>

      {/* Sticky CTA — the commit action is always one tap away. Only renders
          when there's something to log; the hairline border + bg color keep it
          legible against the scroll content underneath. */}
      {fl.preview ? (
        <View
          style={{
            paddingHorizontal: theme.spacing[6],
            paddingTop: theme.spacing[3],
            paddingBottom: insets.bottom + theme.spacing[3],
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.bg,
          }}
        >
          {fl.isEdit ? (
            <Button label="Save changes" onPress={onLog} />
          ) : (
            <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
              <Button label="Log meal" onPress={onLog} style={{ flex: 1 }} />
              <Button label="Save meal" variant="outline" onPress={() => fl.saveMeal()} style={{ flex: 1 }} />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
