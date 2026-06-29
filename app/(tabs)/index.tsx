/**
 * Today — the home of the daily loop. Open it, see today, log a weigh-in, log a
 * session, leave.
 *
 * Pass 3: the weigh-in card is live. Two states — not-logged (a tap target) and
 * logged (today's weight + the smoothed trend delta from core/trend.ts). The
 * delta line only renders when the engine has enough data for an honest answer;
 * it never fabricates one. Sessions stay a placeholder until Pass 4.
 */
import { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, Button, SessionCard, SwipeToDelete, FidelityTreatment } from '@/components';
import { useTheme } from '@/theme';
import { todayLocalLabel, yearLabel, localTimeLabel } from '@/lib/date';
import { useTodayObservations } from '@/hooks/useTodayObservations';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useTodayStimulusContributions } from '@/hooks/useTodayStimulusContributions';
import { useSettings } from '@/settings/useSettings';
import { formatWeight, formatDelta } from '@/lib/units';
import { dailyTotals, fidelityTreatment, itemMacroSummary, type DailyMacroTotal } from '@/lib/foodLog';
import { deleteObservation } from '@/storage/observations';

// A captured macro renders as a rounded integer; a genuinely unknown one as "—",
// never 0 (food-logging-spec § null ≠ 0).
const macroStr = (v: number | null | undefined): string => (v == null ? '—' : String(Math.round(v)));

/** One column of the daily-total card: the honest sum (or "—") above its label. */
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

export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();

  const { weighInToday, sessionsToday, foodEntriesToday, reload: reloadToday } = useTodayObservations();
  const { delta, reload: reloadTrend } = useWeightTrend();
  const contributions = useTodayStimulusContributions(sessionsToday);
  const foodTotals = dailyTotals(foodEntriesToday.map((o) => o.payload));

  // Which multi-item meals are expanded to show their per-item breakdown.
  const [expandedFood, setExpandedFood] = useState<Set<string>>(() => new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpandedFood((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Re-fetch whenever Today regains focus — e.g. after the weigh-in modal saves.
  useFocusEffect(
    useCallback(() => {
      reloadToday();
      reloadTrend();
    }, [reloadToday, reloadTrend])
  );

  const removeAndReload = useCallback(
    async (id: string) => {
      await deleteObservation(id);
      reloadToday();
      reloadTrend();
    },
    [reloadToday, reloadTrend]
  );

  return (
    <Screen scroll>
      {/* Date header — display font, uppercase, primary text */}
      <Text variant="label" color={theme.colors.sandstone}>
        Today
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        {todayLocalLabel()}
      </Text>
      <Text variant="dataSm" style={{ marginTop: theme.spacing[1] }}>
        {yearLabel()}
      </Text>

      {/* Weigh-in */}
      <View style={{ marginTop: theme.spacing[8] }}>
        <Text variant="label" style={{ marginBottom: theme.spacing[2] }}>
          Weigh-in
        </Text>
        {weighInToday ? (
          <SwipeToDelete
            onDelete={() => removeAndReload(weighInToday.id)}
            confirmTitle="Delete weigh-in?"
            confirmMessage={`${formatWeight(
              weighInToday.payload.weightKg,
              weightUnit
            )} — permanent.`}
          >
            <Card style={{ gap: theme.spacing[3] }}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/log-weigh-in',
                    params: { editId: weighInToday.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Edit weigh-in"
                style={{ gap: theme.spacing[1] }}
              >
                <Text variant="dataLg" color={theme.colors.text}>
                  {formatWeight(weighInToday.payload.weightKg, weightUnit)}
                </Text>
                {delta ? (
                  <Text variant="dataSm" color={theme.colors.textSecondary}>
                    {`trend: ${formatWeight(delta.trendKg, weightUnit)}, ${formatDelta(
                      delta.deltaKg,
                      weightUnit
                    )} over ${delta.days} days`}
                  </Text>
                ) : null}
              </Pressable>
              <Button
                label="Log another"
                variant="ghost"
                onPress={() => router.push('/log-weigh-in')}
              />
            </Card>
          </SwipeToDelete>
        ) : (
          <Card style={{ gap: theme.spacing[3] }}>
            <Text variant="body" color={theme.colors.textMuted}>
              Not logged today.
            </Text>
            <Button label="Log weigh-in" onPress={() => router.push('/log-weigh-in')} />
          </Card>
        )}
      </View>

      {/* Sessions */}
      <View style={{ marginTop: theme.spacing[3] }}>
        <Text variant="label" style={{ marginBottom: theme.spacing[2] }}>
          Today's sessions
        </Text>
        {sessionsToday.length > 0 ? (
          <View style={{ gap: theme.spacing[3] }}>
            {sessionsToday.map((session) => (
              <SwipeToDelete
                key={session.id}
                onDelete={() => removeAndReload(session.id)}
                confirmTitle="Delete session?"
                confirmMessage={`${session.payload.modality} — permanent.`}
              >
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/log-session',
                      params: { editId: session.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${session.payload.modality} session`}
                >
                  <SessionCard
                    session={session}
                    contribution={contributions[session.id]}
                  />
                </Pressable>
              </SwipeToDelete>
            ))}
          </View>
        ) : (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              No sessions yet.
            </Text>
          </Card>
        )}
        <Button
          label="Log session"
          variant="secondary"
          onPress={() => router.push('/log-session')}
          style={{ marginTop: theme.spacing[3] }}
        />
      </View>

      {/* Today's food */}
      <View style={{ marginTop: theme.spacing[3] }}>
        <Text variant="label" style={{ marginBottom: theme.spacing[2] }}>
          Today's food
        </Text>
        {foodEntriesToday.length > 0 ? (
          <View style={{ gap: theme.spacing[3] }}>
            {/* Daily total — the honest sum: partial entries are excluded, never zeroed. */}
            <Card raised style={{ gap: theme.spacing[2] }}>
              <Text variant="label" color={theme.colors.textSecondary}>
                Daily total
              </Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing[5] }}>
                <TotalMacro label="Cal" total={foodTotals.kcal} />
                <TotalMacro label="P" total={foodTotals.proteinG} />
                <TotalMacro label="C" total={foodTotals.carbsG} />
                <TotalMacro label="F" total={foodTotals.fatG} />
              </View>
              {foodTotals.partialCount > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                  <View
                    style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.colors.clay }}
                  />
                  <Text variant="bodySm" color={theme.colors.clay} style={{ flex: 1 }}>
                    {foodTotals.partialCount} partial{' '}
                    {foodTotals.partialCount === 1 ? 'entry' : 'entries'} — missing macros not counted
                  </Text>
                </View>
              ) : null}
            </Card>

            {/* Each meal — name + fidelity dot; its macros at the fidelity's own
                opacity. Swipe to delete; tap a multi-item meal to see its breakdown. */}
            {foodEntriesToday.map((o) => {
              const treat = fidelityTreatment(o.fidelity);
              const items = o.payload.items;
              const expandable = items.length > 1;
              const isOpen = expandedFood.has(o.id);
              const mealName = o.payload.description || 'Meal';
              const card = (
                <Card style={{ gap: theme.spacing[2] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                    <FidelityTreatment fidelity={o.fidelity} />
                    <Text variant="body" style={{ flex: 1 }}>
                      {mealName}
                    </Text>
                    <Text variant="bodySm" color={theme.colors.textMuted}>
                      {localTimeLabel(o.occurredAt, o.tz)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                    <Text
                      variant="bodySm"
                      color={theme.colors.textSecondary}
                      style={{ flex: 1, opacity: treat.opacity }}
                    >
                      {macroStr(o.payload.kcal)} cal · {macroStr(o.payload.proteinG)} P ·{' '}
                      {macroStr(o.payload.carbsG)} C · {macroStr(o.payload.fatG)} F
                    </Text>
                    {expandable ? (
                      <Text variant="bodySm" color={theme.colors.textMuted}>
                        {isOpen ? '▴' : `${items.length} items ▾`}
                      </Text>
                    ) : null}
                  </View>
                  {expandable && isOpen ? (
                    <View
                      style={{
                        gap: theme.spacing[2],
                        marginTop: theme.spacing[1],
                        paddingTop: theme.spacing[2],
                        borderTopWidth: 1,
                        borderTopColor: theme.colors.border,
                      }}
                    >
                      {items.map((it, i) => (
                        <View key={i} style={{ gap: 2 }}>
                          <Text variant="bodySm" color={theme.colors.text} numberOfLines={1}>
                            {it.description ? `${it.description} · ` : ''}
                            {Math.round(it.quantity)} g
                          </Text>
                          <Text variant="bodySm" color={theme.colors.textMuted}>
                            {itemMacroSummary(it)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Card>
              );
              return (
                <SwipeToDelete
                  key={o.id}
                  onDelete={() => removeAndReload(o.id)}
                  confirmTitle={`Delete ${mealName}?`}
                  confirmMessage="This is permanent."
                >
                  {expandable ? (
                    <Pressable
                      onPress={() => toggleExpanded(o.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${isOpen ? 'Collapse' : 'Expand'} ${mealName}`}
                    >
                      {card}
                    </Pressable>
                  ) : (
                    card
                  )}
                </SwipeToDelete>
              );
            })}
          </View>
        ) : (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              No food logged yet.
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
