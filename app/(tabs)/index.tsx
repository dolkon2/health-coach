/**
 * Home — today at a glance, plus the fastest path to logging
 * (planning/rework/tabs/home-tab.md). Two tiers: the always-present log bar
 * (Log Session opens the Earth/Sky/Water/Body element picker; Log Food opens
 * the food logger directly), and a glance tier of today's modules — present
 * only when the user actually tracks them (absent, not empty).
 *
 * The log bar is a persistent footer (Dylan, 2026-07-12 — matches the
 * mockup's `LogBar` and Training's already-shipped footer-button pattern),
 * not inline content — it stays visible while the glance tier scrolls under
 * it. Uses `PillActionButton` (`src/components/PillActionButton.tsx`), not
 * the shared `Button` component: the mockup's quiet dual-button treatment
 * (small glyph + label, light surface fill) doesn't match any of Button's
 * existing variants. `PillActionButton` is the same one Training's footer
 * and Nutrition's Log food use — one consistent system across all three.
 *
 * Explicitly NOT here (moved or removed per the spec): the weigh-in card
 * (Nutrition/Trend owns weigh-in — see nutrition.tsx's onLogWeighIn), today's
 * session list and meal list (the logbook lives on Profile, per locked #3),
 * the third log button, and the HealthKit "Connect" CTA (Settings owns
 * connection state now — settings.tsx; Home only reads `connected` to decide
 * whether the steps/sleep strip renders).
 *
 * Glance-tier order: Today's session → Nutrition → Pinned Spots → Benchmarks.
 * The today's-template card (H5) leads: it's the day's plan, the most
 * actionable "what's on" item. It surfaces any active SessionTemplate whose
 * `dayAssignment` matches today's weekday (the recurrence property the earlier
 * pass was waiting on — it exists now: sessionTemplate.ts's dayAssignment +
 * isActive, the same "repeats <Day>" a TemplateCard already shows). Absent,
 * not empty: no card on a day with nothing scheduled.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Screen,
  Text,
  Card,
  ElementPickerSheet,
  BenchmarkStatusCard,
  BenchmarkDetailSheet,
  SpotCard,
  StepsSleepStrip,
  MacroBar,
  TemplateCard,
  PillActionButton,
  DiamondGlyph,
  TriangleGlyph,
} from '@/components';
import { useTheme } from '@/theme';
import { todayLocalLabel, yearLabel, todayLocalDate, weekdayMonZero } from '@/lib/date';
import { listTemplates } from '@/storage/sessionTemplates';
import type { SessionTemplate } from '@core/sessionTemplate';
import { useTodayObservations } from '@/hooks/useTodayObservations';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useBenchmarkStatuses } from '@/hooks/useBenchmarkStatuses';
import { useExpenditure } from '@/hooks/useExpenditure';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useWearableSync } from '@/hooks/useWearableSync';
import { useSpotsGlance } from '@/hooks/useSpotsGlance';
import { useSettings } from '@/settings/useSettings';
import { dailyTotals, dailyFocusTotal } from '@/lib/foodLog';
import { mostRecentActivityByElement } from '@/lib/mostRecentActivity';
import type { Activity } from '@/lib/activity';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { nutritionFocus, weightUnit } = useSettings();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [benchmarkDetailId, setBenchmarkDetailId] = useState<string | null>(null);
  const [todaysTemplates, setTodaysTemplates] = useState<SessionTemplate[]>([]);

  // Today's scheduled sessions (H5) — active templates assigned to today's
  // weekday. One table read on focus; the filter is Mon=0…Sun=6 to match
  // dayAssignment's own scale (see weekdayMonZero).
  const reloadTodaysTemplates = useCallback(async () => {
    const all = await listTemplates();
    const todayDow = weekdayMonZero(todayLocalDate());
    setTodaysTemplates(all.filter((t) => t.isActive && t.dayAssignment === todayDow));
  }, []);

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
  const { spots: glanceSpots, current: spotsCurrent, reload: reloadSpots } = useSpotsGlance();
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
      reloadSpots();
      reloadTodaysTemplates();
      syncNow();
    }, [
      reloadToday,
      reloadTrend,
      reloadBenchmarks,
      reloadExpenditure,
      reloadSpots,
      reloadTodaysTemplates,
      syncNow,
    ])
  );

  function openTemplate(t: SessionTemplate) {
    // Mirror Training's template open — the logger with the template's
    // activity pre-selected; templateId carried for the Pass 3 backlink.
    router.push({ pathname: '/log-session', params: { activity: t.activity, templateId: t.id } });
  }

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
    <Screen
      scroll
      footer={
        <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
          <PillActionButton
            icon={<DiamondGlyph color={theme.colors.textSecondary} />}
            label="Log Session"
            onPress={openPicker}
          />
          <PillActionButton
            icon={<TriangleGlyph color={theme.colors.textSecondary} />}
            label="Log Food"
            onPress={() => router.push('/log-food')}
          />
        </View>
      }
    >
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

      <ElementPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        mostRecent={mostRecent}
        onPickActivity={openActivityLogger}
        onPickBody={openBodyLogger}
      />

      {/* Nutrition today — Focus-mode aware total; absent until food is
          logged. Leads the glance tier (Dylan, 2026-07-12). */}
      {showNutritionCard ? (
        <View style={{ marginTop: theme.spacing[6] }}>
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
              <MacroBar
                proteinG={foodTotals.proteinG.value}
                carbsG={foodTotals.carbsG.value}
                fatG={foodTotals.fatG.value}
              />
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

      {/* Today's scheduled sessions (H5) — active templates whose recurrence
          day is today. Sits under Nutrition, above Spots (Dylan, 2026-07-12).
          Absent on a day with nothing scheduled. */}
      {todaysTemplates.length > 0 ? (
        <View style={{ marginTop: showNutritionCard ? theme.spacing[8] : theme.spacing[6] }}>
          <Text variant="label" style={{ marginBottom: theme.spacing[2] }}>
            Today
          </Text>
          <View style={{ gap: theme.spacing[3] }}>
            {todaysTemplates.map((t) => (
              <TemplateCard key={t.id} template={t} onPress={() => openTemplate(t)} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Pinned Spots — a floor module (home-tab.md § 2): the "Spots →" link
          keeps a one-line presence even at zero spots, since it's the only
          door to the spots list. Condensed cards (cap 3) render above it
          once spots exist, most-recently-created first (the spec's
          "most-recently-visited" ordering waits on a sessions-at-spot query
          that doesn't exist yet — see useSpotsGlance). */}
      <View style={{ marginTop: showNutritionCard ? theme.spacing[8] : theme.spacing[6] }}>
        <Pressable
          onPress={() => router.push('/spots')}
          accessibilityRole="button"
          accessibilityLabel="Open spots"
          style={{ marginBottom: theme.spacing[2] }}
        >
          <Text variant="label" color={theme.colors.textMuted}>
            Spots →
          </Text>
        </Pressable>
        {glanceSpots.length > 0 ? (
          <View style={{ gap: theme.spacing[3] }}>
            {glanceSpots.map((s) => (
              <SpotCard
                key={s.id}
                spot={s}
                current={spotsCurrent[s.id]}
                onPress={() => router.push({ pathname: '/spot/[id]', params: { id: s.id } })}
              />
            ))}
          </View>
        ) : null}
      </View>

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
                onPress={() => setBenchmarkDetailId(e.benchmark.id)}
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

      <BenchmarkDetailSheet
        benchmarkId={benchmarkDetailId}
        onClose={() => setBenchmarkDetailId(null)}
        onChanged={reloadBenchmarks}
        trendPoints={trendPoints}
        measured={measured}
      />

    </Screen>
  );
}
