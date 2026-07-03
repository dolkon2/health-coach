/**
 * Today — the home of the daily loop. Open it, see today, log a weigh-in, log a
 * session, leave. Food shows as the daily total + a compact list of today's
 * meals (tap → edit). Per-item breakdown and per-item delete live in the
 * Nutrition tab — Today is a glance.
 */
import { useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, Button, SessionCard, StepsCard, SleepCard, SwipeToDelete, FidelityTreatment, BenchmarkStatusCard } from '@/components';
import { useTheme } from '@/theme';
import { todayLocalLabel, yearLabel, localTimeLabel } from '@/lib/date';
import { useTodayObservations } from '@/hooks/useTodayObservations';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useBenchmarkStatuses } from '@/hooks/useBenchmarkStatuses';
import { useTodayStimulusContributions } from '@/hooks/useTodayStimulusContributions';
import { useWearableSync } from '@/hooks/useWearableSync';
import { useSettings } from '@/settings/useSettings';
import { formatWeight, formatDelta } from '@/lib/units';
import { dailyTotals, fidelityTreatment, mealDisplayName, type DailyMacroTotal } from '@/lib/foodLog';
import { captureLabel } from '@core/nutrition/captureTier';
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

  const {
    weighInToday,
    sessionsToday,
    foodEntriesToday,
    stepsToday,
    sleepToday,
    reload: reloadToday,
  } = useTodayObservations();
  const { points: trendPoints, delta, reload: reloadTrend } = useWeightTrend();
  const contributions = useTodayStimulusContributions(sessionsToday);
  const foodTotals = dailyTotals(foodEntriesToday.map((o) => o.payload));
  const wearable = useWearableSync(reloadToday);
  // Pinned benchmarks read the same smoothed points the trend chart uses —
  // one weigh-in query serves both the weigh-in card and the outcome faces.
  const { entries: benchmarkEntries, reload: reloadBenchmarks } =
    useBenchmarkStatuses(trendPoints);

  // Re-fetch whenever Today regains focus — e.g. after the weigh-in modal saves.
  // Also polls HealthKit (throttled, no-op until the user has connected).
  // Depend on the *stable* syncNow, not the whole `wearable` object — the hook
  // returns a fresh object every render, so listing `wearable` here re-fired this
  // effect on every render → reloadToday → setState → render → loop (which also
  // starved the single SQLite connection). syncNow is a stable useCallback.
  useFocusEffect(
    useCallback(() => {
      reloadToday();
      reloadTrend();
      reloadBenchmarks();
      wearable.syncNow();
    }, [reloadToday, reloadTrend, reloadBenchmarks, wearable.syncNow])
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

      {/* Benchmarks — pinned goals at a glance. The section exists only when
          the user pinned something: Today never asks for a goal to be set
          (pull, not push — benchmarks-spec.md). */}
      {benchmarkEntries.length > 0 ? (
        <View style={{ marginTop: theme.spacing[8] }}>
          <Text variant="label" style={{ marginBottom: theme.spacing[2] }}>
            Benchmarks
          </Text>
          <View style={{ gap: theme.spacing[3] }}>
            {benchmarkEntries.map((e) => (
              <BenchmarkStatusCard
                key={e.benchmark.id}
                benchmark={e.benchmark}
                behavior={e.behavior}
                outcome={e.outcome}
                weightUnit={weightUnit}
                onPress={() => router.push('/benchmarks')}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Weigh-in */}
      <View
        style={{
          marginTop: benchmarkEntries.length > 0 ? theme.spacing[3] : theme.spacing[8],
        }}
      >
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

      {/* Steps + sleep — auto-imported from HealthKit, glance-only.
          Connect CTA appears only until the user has opted in (Apple HIG:
          permission request must arise from user interaction). */}
      {wearable.connected ? (
        <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
          <StepsCard observation={stepsToday} />
          <SleepCard observation={sleepToday} />
        </View>
      ) : (
        <View style={{ marginTop: theme.spacing[3] }}>
          <Card style={{ gap: theme.spacing[3] }}>
            <Text variant="body" color={theme.colors.textMuted}>
              Connect Apple Health to bring in steps and sleep automatically.
            </Text>
            <Button
              label={wearable.syncing ? 'Connecting…' : 'Connect Apple Health'}
              onPress={() => {
                wearable.connect();
              }}
              variant="secondary"
            />
          </Card>
        </View>
      )}

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

            {/* Compact per-meal row — tap to edit, swipe to delete. The per-item
                breakdown + per-item delete live in the Nutrition tab. */}
            {foodEntriesToday.map((o) => {
              const treat = fidelityTreatment(o.fidelity);
              const mealName = mealDisplayName(o.payload);
              return (
                <SwipeToDelete
                  key={o.id}
                  onDelete={() => removeAndReload(o.id)}
                  confirmTitle={`Delete ${mealName}?`}
                  confirmMessage="This is permanent."
                >
                  <Pressable
                    onPress={() => router.push({ pathname: '/log-food', params: { editId: o.id } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${mealName}`}
                  >
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
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}
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
                    </Card>
                  </Pressable>
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
