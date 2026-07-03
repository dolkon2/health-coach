/**
 * DayMealList — the per-day meals view used on today and any tapped past
 * (or future) day. Extracted from the inline render Pass 1 built in
 * app/(tabs)/nutrition.tsx so the same code renders every day.
 *
 * Renders the daily-total card (honest nulls, partial note), then meals
 * grouped by hour-of-day in a timeline gutter — each group's left side gets
 * a rounded pill containing the hour anchor, sitting in front of a
 * continuous vertical line so the day reads as a flow of time (Pass 2's
 * small visual upgrade over Pass 1's plain-text gutter).
 *
 * Interactions carry from Pass 1: tap a meal card → edit; swipe-left → delete
 * the whole meal; tap the X on an item row → delete just that item. Pure
 * presentation + the two storage calls Pass 1 used; the caller hands in
 * `entries` and an `onReload` for post-mutation refresh.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import type { ObservationOf } from '@core/observation';
import { blendComposite } from '@core/nutrition/fidelity';
import { captureLabel } from '@core/nutrition/captureTier';
import { Card } from './Card';
import { Text } from './Text';
import { SwipeToDelete } from './SwipeToDelete';
import { FidelityTreatment } from './FidelityTreatment';
import { useTheme } from '@/theme';
import { hourBucketLabel, localTimeLabel } from '@/lib/date';
import {
  dailyTotals,
  fidelityTreatment,
  itemMacroSummary,
  mealDisplayName,
  removeItemFromMeal,
  type DailyMacroTotal,
} from '@/lib/foodLog';
import { deleteObservation, updateObservation } from '@/storage/observations';

type FoodObs = ObservationOf<'foodEntry'>;

const macroStr = (v: number | null | undefined): string =>
  v == null ? '—' : String(Math.round(v));

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

export type DayMealListProps = {
  entries: ReadonlyArray<FoodObs>;
  onReload: () => void;
  /** Copy for the empty-state card, e.g. "No food logged this day." */
  emptyMessage?: string;
};

export function DayMealList({
  entries,
  onReload,
  emptyMessage = 'No food logged.',
}: DayMealListProps) {
  const theme = useTheme();
  const router = useRouter();
  const totals = dailyTotals(entries.map((o) => o.payload));

  // Group meals by hour-of-day bucket — chronological order preserved
  // because the caller hands entries in ascending occurredAt order.
  const grouped = useMemo<Array<[string, FoodObs[]]>>(() => {
    const map = new Map<string, FoodObs[]>();
    for (const o of entries) {
      const bucket = hourBucketLabel(o.occurredAt, o.tz);
      const list = map.get(bucket);
      if (list) list.push(o);
      else map.set(bucket, [o]);
    }
    return Array.from(map.entries());
  }, [entries]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deleteMeal = useCallback(
    async (id: string) => {
      await deleteObservation(id);
      onReload();
    },
    [onReload]
  );

  // Inline per-item delete: re-roll macros, re-blend fidelity on the envelope,
  // and persist. If this was the meal's last item, delete the whole observation
  // (a meal with zero foods is not a thing — removeItemFromMeal returns null).
  const deleteItem = useCallback(
    (meal: FoodObs, index: number) => {
      const item = meal.payload.items[index];
      const label = item?.description?.trim() || `item ${index + 1}`;
      const mealLabel = mealDisplayName(meal.payload);
      Alert.alert(`Delete ${label}?`, `Removes it from ${mealLabel}. This is permanent.`, [
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
            onReload();
          },
        },
      ]);
    },
    [onReload]
  );

  if (entries.length === 0) {
    return (
      <Card>
        <Text variant="body" color={theme.colors.textMuted}>
          {emptyMessage}
        </Text>
      </Card>
    );
  }

  return (
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
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: theme.colors.clay,
              }}
            />
            <Text variant="bodySm" color={theme.colors.clay} style={{ flex: 1 }}>
              {totals.partialCount} partial{' '}
              {totals.partialCount === 1 ? 'entry' : 'entries'} — missing macros not counted
            </Text>
          </View>
        ) : null}
      </Card>

      {/* Timeline — continuous vertical line, hour pills anchored on top. */}
      <View>
        {grouped.map(([bucket, meals], idx) => {
          const isLast = idx === grouped.length - 1;
          return (
            <View
              key={bucket}
              style={{
                flexDirection: 'row',
                gap: theme.spacing[3],
                paddingBottom: isLast ? 0 : theme.spacing[3],
              }}
            >
              <View style={{ width: 64, alignItems: 'center' }}>
                {/* Full-height vertical line — runs through the gutter so
                    adjacent groups visually connect. The pill below sits
                    on top of it (opaque bg) so the line "breaks" behind. */}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: theme.colors.border,
                  }}
                />
                <View
                  style={{
                    marginTop: theme.spacing[3],
                    backgroundColor: theme.colors.bg,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                >
                  <Text variant="label" color={theme.colors.textMuted}>
                    {bucket}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1, gap: theme.spacing[3] }}>
                {meals.map((o) => {
                  const treat = fidelityTreatment(o.fidelity);
                  const items = o.payload.items;
                  const expandable = items.length > 1;
                  const isOpen = expanded.has(o.id);
                  const mealName = mealDisplayName(o.payload);
                  return (
                    <SwipeToDelete
                      key={o.id}
                      onDelete={() => deleteMeal(o.id)}
                      confirmTitle={`Delete ${mealName}?`}
                      confirmMessage="This is permanent."
                    >
                      <Card style={{ gap: theme.spacing[2] }}>
                        <Pressable
                          onPress={() =>
                            router.push({ pathname: '/log-food', params: { editId: o.id } })
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${mealName}`}
                          style={{ gap: theme.spacing[2] }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: theme.spacing[2],
                            }}
                          >
                            <FidelityTreatment fidelity={o.fidelity} />
                            <Text variant="body" style={{ flex: 1 }}>
                              {mealName}
                            </Text>
                            <Text variant="bodySm" color={theme.colors.textMuted}>
                              {localTimeLabel(o.occurredAt, o.tz)}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: theme.spacing[2],
                            }}
                          >
                            <Text
                              variant="bodySm"
                              color={theme.colors.textSecondary}
                              style={{ flex: 1, opacity: treat.opacity }}
                            >
                              {macroStr(o.payload.kcal)} cal · {macroStr(o.payload.proteinG)} P ·{' '}
                              {macroStr(o.payload.carbsG)} C · {macroStr(o.payload.fatG)} F
                            </Text>
                            {/* Capture method as the legible unit (T1/T2/T3). */}
                            <Text variant="label" color={theme.colors.textMuted}>
                              {captureLabel(o.payload)}
                            </Text>
                          </View>
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
                              const itemName =
                                it.description?.trim() || `item ${i + 1}`;
                              return (
                                <View
                                  key={i}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'flex-start',
                                    gap: theme.spacing[2],
                                  }}
                                >
                                  <View style={{ flex: 1, gap: 2 }}>
                                    <Text
                                      variant="bodySm"
                                      color={theme.colors.text}
                                      numberOfLines={1}
                                    >
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
          );
        })}
      </View>
    </View>
  );
}
