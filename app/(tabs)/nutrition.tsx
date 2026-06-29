/**
 * Nutrition — the depth tab. Pass 1: today-in-full. Today's daily total + per-meal
 * cards grouped under hour-of-day anchors (the left gutter), with the per-item
 * breakdown an expand-tap away. Tap a meal card → edit; swipe-left a meal card →
 * delete the whole meal; tap the X on an item row → delete just that item (the
 * new affordance the Nutrition tab adds over Today). Today stays a glance; depth
 * lives here (planning/nutrition-tab-plan.md).
 *
 * What is NOT here yet, by design: history (Pass 2's day strip), energy balance
 * (Pass 3), trends (Pass 4), benchmarks (Phase 5 — the slot lives above the daily
 * total, invisible until earned).
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { X } from 'lucide-react-native';
import { Screen, Text, Card, Button, SwipeToDelete, FidelityTreatment } from '@/components';
import { useTheme } from '@/theme';
import { todayLocalLabel, yearLabel, localTimeLabel, hourBucketLabel } from '@/lib/date';
import { useTodayObservations } from '@/hooks/useTodayObservations';
import {
  dailyTotals,
  fidelityTreatment,
  itemMacroSummary,
  removeItemFromMeal,
  type DailyMacroTotal,
} from '@/lib/foodLog';
import { blendComposite } from '@core/nutrition/fidelity';
import { deleteObservation, updateObservation } from '@/storage/observations';
import type { ObservationOf } from '@core/observation';

type FoodObs = ObservationOf<'foodEntry'>;

const macroStr = (v: number | null | undefined): string => (v == null ? '—' : String(Math.round(v)));

function TotalMacro({ label, total }: { label: string; total: DailyMacroTotal }) {
  const theme = useTheme();
  return (
    <View>
      <Text variant="data">{macroStr(total.value)}</Text>
      <Text variant="label" color={theme.colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

export default function NutritionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { foodEntriesToday, reload } = useTodayObservations();
  const totals = dailyTotals(foodEntriesToday.map((o) => o.payload));

  // Group meals by hour-of-day bucket ("10 AM", "12 PM", …). foodEntriesToday is
  // already chronological, so insertion order preserves the gutter order.
  const grouped = useMemo<Array<[string, FoodObs[]]>>(() => {
    const map = new Map<string, FoodObs[]>();
    for (const o of foodEntriesToday) {
      const bucket = hourBucketLabel(o.occurredAt, o.tz);
      const list = map.get(bucket);
      if (list) list.push(o);
      else map.set(bucket, [o]);
    }
    return Array.from(map.entries());
  }, [foodEntriesToday]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const deleteMeal = useCallback(
    async (id: string) => {
      await deleteObservation(id);
      reload();
    },
    [reload]
  );

  // Inline per-item delete: re-roll macros, re-blend fidelity on the envelope,
  // and persist. If this was the meal's last item, delete the whole observation
  // (a meal with zero foods is not a thing — removeItemFromMeal returns null).
  const deleteItem = useCallback(
    (meal: FoodObs, index: number) => {
      const item = meal.payload.items[index];
      const label = item?.description?.trim() || `item ${index + 1}`;
      Alert.alert(`Delete ${label}?`, 'This is permanent.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const nextPayload = removeItemFromMeal(meal.payload, index);
            if (nextPayload == null) {
              await deleteObservation(meal.id);
            } else {
              await updateObservation({
                ...meal,
                payload: nextPayload,
                fidelity: blendComposite(nextPayload.items),
              });
            }
            reload();
          },
        },
      ]);
    },
    [reload]
  );

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.sandstone}>
        Nutrition
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        {todayLocalLabel()}
      </Text>
      <Text variant="dataSm" style={{ marginTop: theme.spacing[1] }}>
        {yearLabel()}
      </Text>

      {/* Benchmark slot reserved here — invisible until Phase 5 earns it. */}

      <View style={{ marginTop: theme.spacing[8] }}>
        {foodEntriesToday.length > 0 ? (
          <View style={{ gap: theme.spacing[3] }}>
            <Card raised style={{ gap: theme.spacing[2] }}>
              <Text variant="label" color={theme.colors.textSecondary}>
                Daily total
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing[5] }}>
                <TotalMacro label="Cal" total={totals.kcal} />
                <TotalMacro label="P" total={totals.proteinG} />
                <TotalMacro label="C" total={totals.carbsG} />
                <TotalMacro label="F" total={totals.fatG} />
              </View>
              {totals.partialCount > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                  <View
                    style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.colors.clay }}
                  />
                  <Text variant="bodySm" color={theme.colors.clay} style={{ flex: 1 }}>
                    {totals.partialCount} partial{' '}
                    {totals.partialCount === 1 ? 'entry' : 'entries'} — missing macros not counted
                  </Text>
                </View>
              ) : null}
            </Card>

            {grouped.map(([bucket, meals]) => (
              <View key={bucket} style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                {/* Left gutter — hour anchor. Fixed-width so the meal cards line up. */}
                <View style={{ width: 56, paddingTop: theme.spacing[3] }}>
                  <Text variant="label" color={theme.colors.textMuted}>
                    {bucket}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: theme.spacing[3] }}>
                  {meals.map((o) => {
                    const treat = fidelityTreatment(o.fidelity);
                    const items = o.payload.items;
                    const expandable = items.length > 1;
                    const isOpen = expanded.has(o.id);
                    const mealName = o.payload.description || 'Meal';
                    return (
                      <SwipeToDelete
                        key={o.id}
                        onDelete={() => deleteMeal(o.id)}
                        confirmTitle={`Delete ${mealName}?`}
                        confirmMessage="This is permanent."
                      >
                        <Card style={{ gap: theme.spacing[2] }}>
                          <Pressable
                            onPress={() => router.push({ pathname: '/log-food', params: { editId: o.id } })}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${mealName}`}
                            style={{ gap: theme.spacing[2] }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                              <FidelityTreatment fidelity={o.fidelity} />
                              <Text variant="body" style={{ flex: 1 }}>
                                {mealName}
                              </Text>
                              <Text variant="bodySm" color={theme.colors.textMuted}>
                                {localTimeLabel(o.occurredAt, o.tz)}
                              </Text>
                            </View>
                            <Text
                              variant="bodySm"
                              color={theme.colors.textSecondary}
                              style={{ opacity: treat.opacity }}
                            >
                              {macroStr(o.payload.kcal)} cal · {macroStr(o.payload.proteinG)} P ·{' '}
                              {macroStr(o.payload.carbsG)} C · {macroStr(o.payload.fatG)} F
                            </Text>
                          </Pressable>

                          {expandable ? (
                            <Pressable
                              onPress={() => toggleExpanded(o.id)}
                              accessibilityRole="button"
                              accessibilityLabel={`${isOpen ? 'Hide' : 'Show'} the ${items.length} foods in ${mealName}`}
                              hitSlop={6}
                              style={{ alignSelf: 'flex-start' }}
                            >
                              <Text variant="bodySm" color={theme.colors.textMuted}>
                                {isOpen ? 'Hide items ▴' : `${items.length} items ▾`}
                              </Text>
                            </Pressable>
                          ) : null}

                          {expandable && isOpen ? (
                            <View
                              style={{
                                gap: theme.spacing[3],
                                marginTop: theme.spacing[1],
                                paddingTop: theme.spacing[2],
                                borderTopWidth: 1,
                                borderTopColor: theme.colors.border,
                              }}
                            >
                              {items.map((it, i) => {
                                const itemName = it.description?.trim() || `item ${i + 1}`;
                                return (
                                  <View
                                    key={i}
                                    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[2] }}
                                  >
                                    <View style={{ flex: 1, gap: 2 }}>
                                      <Text variant="bodySm" color={theme.colors.text} numberOfLines={1}>
                                        {it.description ? `${it.description} · ` : ''}
                                        {Math.round(it.quantity)} g
                                      </Text>
                                      <Text variant="bodySm" color={theme.colors.textMuted}>
                                        {itemMacroSummary(it)}
                                      </Text>
                                    </View>
                                    <Pressable
                                      onPress={() => deleteItem(o, i)}
                                      hitSlop={10}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Delete ${itemName} from ${mealName}`}
                                      style={{ padding: theme.spacing[1] }}
                                    >
                                      <X size={16} color={theme.colors.textMuted} strokeWidth={1.5} />
                                    </Pressable>
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}
                        </Card>
                      </SwipeToDelete>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              No food logged today.
            </Text>
          </Card>
        )}

        <Button
          label="Log food"
          variant="secondary"
          onPress={() => router.push('/log-food')}
          style={{ marginTop: theme.spacing[3] }}
        />
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
