/**
 * Home — today at a glance, plus the fastest path to logging
 * (planning/rework/tabs/home-tab.md). Two tiers: the always-present log bar
 * (Log Session opens the Earth/Sky/Water/Body element picker; Log Food opens
 * the food logger directly), and a glance tier of today's modules — present
 * only when the user actually tracks them (absent, not empty).
 *
 * Explicitly NOT here (moved or removed per the spec): the weigh-in card
 * (Nutrition/Trend owns weigh-in — see nutrition.tsx's onLogWeighIn), today's
 * session list and meal list (the logbook lives on Profile, per locked #3),
 * the third log button, and the HealthKit "Connect" CTA (Settings owns
 * connection state now — settings.tsx; Home only reads `connected` to decide
 * whether the steps/sleep strip renders).
 *
 * Pinned Spots and today's-template card (H4/H5) are NOT built in this pass —
 * both are gated on tracks that don't exist yet (Spots migration 015 + list;
 * Training's per-template recurrence property). They keep their place in
 * Dylan's confirmed shelf order (Nutrition → Spots → template → Benchmarks →
 * Steps/Sleep) once their dependencies land.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, Button, ElementPickerSheet, BenchmarkStatusCard, StepsSleepStrip } from '@/components';
import { useTheme } from '@/theme';
import { todayLocalLabel, yearLabel } from '@/lib/date';
import { useTodayObservations } from '@/hooks/useTodayObservations';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useBenchmarkStatuses } from '@/hooks/useBenchmarkStatuses';
import { useExpenditure } from '@/hooks/useExpenditure';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useWearableSync } from '@/hooks/useWearableSync';
import { useSettings } from '@/settings/useSettings';
import { dailyTotals, dailyFocusTotal } from '@/lib/foodLog';
import { mostRecentActivityByElement } from '@/lib/mostRecentActivity';
import type { Activity } from '@/lib/activity';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { nutritionFocus, weightUnit } = useSettings();
  const [pickerVisible, setPickerVisible] = useState(false);

  const { foodEntriesToday, stepsToday, sleepToday, reload: reloadToday } = useTodayObservations();
  const { points: trendPoints, reload: reloadTrend } = useWeightTrend();
  const foodTotals = dailyTotals(foodEntriesToday.map((o) => o.payload));
  const wearable = useWearableSync(reloadToday);
  // The measured expenditure window feeds any energy-balance outcome face —
  // the same residual the Nutrition tab's burn card shows.
  const { measured, reload: reloadExpenditure } = useExpenditure(trendPoints);
  // Pinned benchmarks read the same smoothed points the trend chart uses.
  const { entries: benchmarkEntries, reload: reloadBenchmarks } =
    useBenchmarkStatuses(trendPoints, measured);
  // Most-recent-activity-per-element (H1): a JS scan over recent sessions.
  // Fetched once on mount and refreshed only when the picker sheet actually
  // opens (openPicker below) — not on every Home focus. The value is only
  // ever read inside a closed-by-default sheet, so eagerly re-running a
  // 365-day session scan on every focus (Training tab already runs the same
  // query independently) would be pure waste on the far more common case of
  // a Home visit that never opens it.
  const { sessions: recentSessions, reload: reloadSessions } = useSessionHistory();
  const mostRecent = useMemo(() => mostRecentActivityByElement(recentSessions), [recentSessions]);
  // Depend on the stable `syncNow` callback, NOT the whole `wearable` object —
  // see the equivalent note this screen carried before the rework (Today's
  // useWearableSync reference): the hook returns a fresh object every render.
  const { syncNow } = wearable;

  useFocusEffect(
    useCallback(() => {
      reloadToday();
      reloadTrend();
      reloadBenchmarks();
      reloadExpenditure();
      syncNow();
    }, [reloadToday, reloadTrend, reloadBenchmarks, reloadExpenditure, syncNow])
  );

  function openPicker() {
    reloadSessions();
    setPickerVisible(true);
  }

  function openActivityLogger(activity: Activity) {
    setPickerVisible(false);
    // Interim routing (home-tab.md § 5): Earth/Sky/Water always open the
    // current logger with the activity pre-selected. Swapped for the real
    // Map Record deep link at H6 — Home is never blocked on Map.
    router.push({ pathname: '/log-session', params: { activity: activity.id } });
  }

  function openBodyLogger() {
    setPickerVisible(false);
    // Body never uses the log-session interim — it hands off to Training's
    // existing template/session selection screen (locked #6).
    router.push('/training');
  }

  const focusTotal = dailyFocusTotal(foodTotals, nutritionFocus);
  const showNutritionCard = foodEntriesToday.length > 0;
  const showStepsSleep = wearable.connected && (stepsToday !== null || sleepToday !== null);

  return (
    <Screen scroll>
      {/* Date header */}
      <Text variant="label" color={theme.colors.accent}>
        Home
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        {todayLocalLabel()}
      </Text>
      <Text variant="dataSm" style={{ marginTop: theme.spacing[1] }}>
        {yearLabel()}
      </Text>

      {/* Log bar — always present, needs zero data (home-tab.md § 2 tier 1). */}
      <View style={{ flexDirection: 'row', gap: theme.spacing[3], marginTop: theme.spacing[6] }}>
        <Button
          label="Log session"
          onPress={openPicker}
          style={{ flex: 1 }}
        />
        <Button
          label="Log food"
          variant="secondary"
          onPress={() => router.push('/log-food')}
          style={{ flex: 1 }}
        />
      </View>

      <ElementPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        mostRecent={mostRecent}
        onPickActivity={openActivityLogger}
        onPickBody={openBodyLogger}
      />

      {/* Nutrition today — Focus-mode aware total; absent until food is logged. */}
      {showNutritionCard ? (
        <View style={{ marginTop: theme.spacing[8] }}>
          <Text variant="label" style={{ marginBottom: theme.spacing[2] }}>
            Nutrition
          </Text>
          <Pressable
            onPress={() => router.push('/nutrition')}
            accessibilityRole="button"
            accessibilityLabel="Open Nutrition"
          >
            <Card style={{ gap: theme.spacing[1] }}>
              <Text variant="dataLg">
                {focusTotal.total.value == null
                  ? '—'
                  : `${Math.round(focusTotal.total.value)} ${focusTotal.unit}`}
              </Text>
              <Text variant="label" color={theme.colors.textSecondary}>
                {focusTotal.label} today
              </Text>
              {focusTotal.total.missing > 0 ? (
                <Text variant="bodySm" color={theme.colors.caution}>
                  {focusTotal.total.missing} {focusTotal.total.missing === 1 ? 'entry' : 'entries'} missing this macro — not counted
                </Text>
              ) : null}
            </Card>
          </Pressable>
        </View>
      ) : null}

      {/* Benchmarks — the "Benchmarks →" link is a floor module: it keeps a
          one-line presence even at zero, since it's the only door to the
          management list (home-tab.md § 3). */}
      <View style={{ marginTop: theme.spacing[8] }}>
        <Pressable
          onPress={() => router.push('/benchmarks')}
          accessibilityRole="button"
          accessibilityLabel="Open benchmarks"
          style={{ marginBottom: theme.spacing[2] }}
        >
          <Text variant="label" color={theme.colors.textMuted}>
            Benchmarks →
          </Text>
        </Pressable>
        {benchmarkEntries.length > 0 ? (
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
        ) : null}
      </View>

      {/* Steps + sleep — the deliberately non-headline bottom line (H3, locked #9). */}
      {showStepsSleep ? (
        <View style={{ marginTop: theme.spacing[6] }}>
          <StepsSleepStrip steps={stepsToday} sleep={sleepToday} />
        </View>
      ) : null}

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
