/**
 * Nutrition — the depth tab. Pass 2: week strip + tap-into-a-past-day.
 *
 * Layout (Option C, locked 2026-06-28):
 *   "Nutrition"  tab identifier
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
 * What's still deferred by design: energy balance (Pass 3), trends (Pass 4),
 * benchmarks (Phase 5 — the slot above the totals card is reserved).
 */
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Screen,
  Text,
  Button,
  DayNavHeader,
  WeekStrip,
  DayMealList,
} from '@/components';
import { useTheme } from '@/theme';
import { addDays, todayLocalDate, weekOf } from '@/lib/date';
import { useFoodEntriesByDay } from '@/hooks/useFoodEntriesByDay';

export default function NutritionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const today = todayLocalDate();

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

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
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

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.sandstone}>
        Nutrition
      </Text>

      <View style={{ marginTop: theme.spacing[2] }}>
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

      {/* Benchmark slot reserved here — invisible until Phase 5 earns it. */}

      <View style={{ marginTop: theme.spacing[6] }}>
        <DayMealList
          entries={entries}
          onReload={reload}
          emptyMessage={
            isToday ? 'No food logged today.' : 'No food logged this day.'
          }
        />

        <Button
          label="Log food"
          variant="secondary"
          // Today → no date param, so the logger defaults to modal-open time
          // ("now", current behavior). Any other day → pass date so the
          // logger defaults to noon of that day, adjustable in the picker.
          onPress={() =>
            router.push(
              isToday
                ? '/log-food'
                : { pathname: '/log-food', params: { date: selectedDate } }
            )
          }
          style={{ marginTop: theme.spacing[3] }}
        />
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
