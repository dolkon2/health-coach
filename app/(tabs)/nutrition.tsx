/**
 * Nutrition — the depth tab. Intake/Trend split (rework Session 3, N1):
 * Intake holds tier-1 facts (day nav, totals, meals, logger); Trend holds
 * everything derived/modeled (weigh-in entry + trend chart, expenditure).
 * A modeled value structurally cannot headline the fact surface.
 *
 * **Intake** (default landing — logging is the primary loop):
 *   "Nutrition"  tab identifier
 *   [Intake | Trend]  two-segment switch, resets to Intake on tab re-entry
 *   ‹ Today ›    DayNavHeader (label cycles by selected day; tap to jump back)
 *   S M T W T F S WeekStrip (Sun-Sat; tap a cell to view, swipe to page weeks)
 *   [daily total + meals]  DayMealList (today, yesterday, tomorrow, whatever)
 *   [Log food]   only on today (Pass 2.5 brings logger-to-past-or-future)
 *
 * Navigation is in-tab local state, not a stack push — the strip and nav
 * stay anchored; only the day-view content swaps. Future-day viewing is
 * allowed (meal planning) but logging into the past/future still goes to
 * the present until Pass 2.5 ships a date picker in the logger.
 *
 * **Trend** — weigh-in entry + WeightTrendChart (relocated from Reflect),
 * a weigh-in edit/delete list, and ExpenditureCard (measured daily burn).
 *
 * Dylan's N1 pinned answer (2026-07-11): when N2 adds the target-status
 * card, it leads the Intake landing, above the totals card — recorded here
 * so N2 doesn't have to re-ask.
 *
 * What's still deferred by design: target-status + adherence benchmark
 * (N2), Focus lens (N3), Trend charts (N4).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  SegmentedControl,
  DayNavHeader,
  WeekStrip,
  DayMealList,
  ExpenditureCard,
  WeightTrendChart,
  WeighInHistory,
  PillActionButton,
  TriangleGlyph,
} from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { addDays, todayLocalDate, weekOf } from '@/lib/date';
import { useFoodEntriesByDay } from '@/hooks/useFoodEntriesByDay';
import { useBodyProfile } from '@/hooks/useBodyProfile';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useExpenditure } from '@/hooks/useExpenditure';

type SubTab = 'intake' | 'trend';

export default function NutritionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const today = todayLocalDate();

  const [subTab, setSubTab] = useState<SubTab>('intake');

  // Two pieces of state — what day is being viewed, and which week the
  // strip is showing. They're separate so a user can swipe the strip to
  // skim past weeks without losing their current day-view selection.
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekContaining, setWeekContaining] = useState(today);

  // Dates to fetch: the visible week plus the selected day (in case the
  // user swiped to a different week without re-selecting).
  const datesToFetch = useMemo(() => {
    const set = new Set(weekOf(weekContaining));
    set.add(selectedDate);
    return Array.from(set);
  }, [weekContaining, selectedDate]);

  const { entriesByDay, daysWithFood, reload } = useFoodEntriesByDay(datesToFetch);
  const { profile, reload: reloadProfile } = useBodyProfile();
  const { points, raw, reload: reloadTrend } = useWeightTrend();
  const { measured, reload: reloadExpenditure } = useExpenditure(points);

  // "Resets to Intake on tab re-entry" (spec) means re-entering the tab from
  // elsewhere in the app — not returning from a modal this screen itself
  // pushed (weigh-in edit, body-profile edit). Both dismiss back into this
  // same useFocusEffect, so callers of the modal-opening helpers below flag
  // the return trip here to keep the user on Trend instead of bouncing them
  // back to Intake right after they use the weigh-in correction path.
  const returningFromOwnModal = useRef(false);
  const openWeighIn = useCallback(
    (editId?: string) => {
      returningFromOwnModal.current = true;
      router.push(
        editId ? { pathname: '/log-weigh-in', params: { editId } } : '/log-weigh-in'
      );
    },
    [router]
  );
  const openBodyProfile = useCallback(() => {
    returningFromOwnModal.current = true;
    router.push('/body-profile');
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      if (returningFromOwnModal.current) {
        returningFromOwnModal.current = false;
      } else {
        setSubTab('intake');
      }
      reload();
      reloadProfile();
      reloadTrend();
      reloadExpenditure();
    }, [reload, reloadProfile, reloadTrend, reloadExpenditure])
  );

  const selectDay = useCallback((d: string) => {
    setSelectedDate(d);
    setWeekContaining(d); // snap the strip to the chosen day's week
  }, []);

  const prevDay = useCallback(() => {
    const next = addDays(selectedDate, -1);
    setSelectedDate(next);
    setWeekContaining(next);
  }, [selectedDate]);

  const nextDay = useCallback(() => {
    const next = addDays(selectedDate, 1);
    setSelectedDate(next);
    setWeekContaining(next);
  }, [selectedDate]);

  const jumpToToday = useCallback(() => {
    setSelectedDate(today);
    setWeekContaining(today);
  }, [today]);

  const prevWeek = useCallback(() => {
    setWeekContaining((w) => addDays(w, -7));
  }, []);

  const nextWeek = useCallback(() => {
    setWeekContaining((w) => addDays(w, 7));
  }, []);

  const isToday = selectedDate === today;
  const entries = entriesByDay.get(selectedDate) ?? [];

  const latestTrendKg = points.length > 0 ? points[points.length - 1].trendKg : null;

  return (
    <Screen
      scroll
      headerTransparent
      // Log food lives in the persistent footer, matching Home's log bar and
      // Training's footer action — the same `PillActionButton` system across
      // all three (Dylan, 2026-07-12). Only on Intake: logging doesn't apply
      // to Trend's derived/modeled surface. Wrapped in a `flexDirection: 'row'`
      // View — `PillActionButton`'s `flex: 1` needs a row parent to size
      // itself correctly (see training.tsx's identical fix).
      footer={
        subTab === 'intake' ? (
          <View style={{ flexDirection: 'row' }}>
            <PillActionButton
              icon={<TriangleGlyph color={theme.colors.textSecondary} />}
              label="Log food"
              onPress={() =>
                router.push(
                  isToday
                    ? '/log-food'
                    : { pathname: '/log-food', params: { date: selectedDate } }
                )
              }
            />
          </View>
        ) : undefined
      }
    >
      <Text variant="label" color={theme.colors.accent}>
        Nutrition
      </Text>

      <View style={{ marginTop: theme.spacing[3] }}>
        <SegmentedControl
          options={[
            { value: 'intake', label: 'Intake' },
            { value: 'trend', label: 'Trend' },
          ]}
          value={subTab}
          onChange={setSubTab}
        />
      </View>

      {subTab === 'intake' ? (
        <>
          <View style={{ marginTop: theme.spacing[5] }}>
            <DayNavHeader
              selectedDate={selectedDate}
              today={today}
              onPrev={prevDay}
              onNext={nextDay}
              onJumpToToday={jumpToToday}
            />
          </View>
          <View style={{ marginTop: theme.spacing[3] }}>
            <WeekStrip
              selectedDate={selectedDate}
              weekContaining={weekContaining}
              today={today}
              daysWithFood={daysWithFood}
              onSelectDay={selectDay}
              onPrevWeek={prevWeek}
              onNextWeek={nextWeek}
            />
          </View>

          {/* Target-status card slot — N2 lands it here, above the totals
              card (Dylan's N1 answer, recorded above). */}

          <View style={{ marginTop: theme.spacing[6] }}>
            <DayMealList
              entries={entries}
              onReload={reload}
              emptyMessage={
                isToday ? 'No food logged today.' : 'No food logged this day.'
              }
            />
          </View>
        </>
      ) : (
        <>
          {/* Weigh-in — entry + trend chart + a real edit/delete path (the
              gap Session 2 flagged: removing Home's weigh-in card left
              nowhere in-app to correct a fat-fingered or duplicate entry). */}
          <View style={{ marginTop: theme.spacing[6] }}>
            <Button label="Log weigh-in" variant="secondary" onPress={() => openWeighIn()} />
          </View>

          <View style={{ marginTop: theme.spacing[6] }}>
            <WeightTrendChart points={points} raw={raw} weightUnit={weightUnit} />
          </View>

          <View style={{ marginTop: theme.spacing[6] }}>
            <WeighInHistory
              raw={raw}
              weightUnit={weightUnit}
              onReload={reloadTrend}
              onEdit={openWeighIn}
            />
          </View>

          {/* Expenditure — the daily-burn estimate (baseline now; measured in Pass D). */}
          <View style={{ marginTop: theme.spacing[8] }}>
            <ExpenditureCard
              profile={profile}
              weightKg={latestTrendKg}
              measured={measured}
              onEditProfile={openBodyProfile}
              onLogWeighIn={() => openWeighIn()}
            />
          </View>
        </>
      )}

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
