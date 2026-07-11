/**
 * WeekStrip — the Nutrition tab's history navigator. 7 Sun–Sat day-cells
 * with a tap callback; a horizontal swipe pages the strip ±1 week. Pure
 * presentation + a swipe gesture — week visibility and selection state live
 * on the caller; the strip just renders what it's given and reports taps.
 *
 * Visual signals (each is a single, load-bearing dot):
 *   • selected day: filled outline in the accent color
 *   • today (when ≠ selected): a subtler thin outline (borderStrong)
 *   • day had food logged: a small caution dot below the cell (matches the
 *     partial-entry dot in the daily-total card)
 *
 * No future bound — Pass 2 allows future-week paging for meal planning.
 */
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { LocalDate } from '@core/observation';
import { Text } from './Text';
import { useTheme } from '@/theme';
import { dayOfMonth, weekdayLetter, weekOf } from '@/lib/date';

const CELL_WIDTH = 40;
const CELL_HEIGHT = 56;
const SWIPE_THRESHOLD = 60;

type Props = {
  selectedDate: LocalDate;
  /** Anchors the visible 7-day window (Sun-Sat containing this date). */
  weekContaining: LocalDate;
  today: LocalDate;
  daysWithFood: ReadonlySet<LocalDate>;
  onSelectDay: (d: LocalDate) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
};

export function WeekStrip({
  selectedDate,
  weekContaining,
  today,
  daysWithFood,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
}: Props) {
  const theme = useTheme();
  const days = weekOf(weekContaining);

  // Horizontal swipe pages the strip ±1 week. activeOffsetX prevents the
  // gesture from competing with vertical scroll until it's clearly a swipe.
  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onEnd((e) => {
      'worklet';
      if (e.translationX > SWIPE_THRESHOLD) runOnJS(onPrevWeek)();
      else if (e.translationX < -SWIPE_THRESHOLD) runOnJS(onNextWeek)();
    });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: theme.spacing[2],
        }}
      >
        {days.map((d) => {
          const isSelected = d === selectedDate;
          const isToday = d === today;
          const hasFood = daysWithFood.has(d);
          const borderColor = isSelected
            ? theme.colors.accent
            : isToday
              ? theme.colors.borderStrong
              : 'transparent';
          return (
            <Pressable
              key={d}
              onPress={() => onSelectDay(d)}
              accessibilityRole="button"
              accessibilityLabel={`View ${d}${isToday ? ' (today)' : ''}${hasFood ? ', food logged' : ''}`}
              style={{ alignItems: 'center', gap: 4 }}
            >
              <View
                style={{
                  width: CELL_WIDTH,
                  height: CELL_HEIGHT,
                  borderRadius: CELL_WIDTH / 2,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <Text variant="label" color={theme.colors.textMuted}>
                  {weekdayLetter(d)}
                </Text>
                <Text variant="body">{dayOfMonth(d)}</Text>
              </View>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: hasFood ? theme.colors.caution : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}
