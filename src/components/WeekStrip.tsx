/**
 * WeekStrip — the Nutrition tab's history navigator. 7 Sun–Sat day-cells
 * with a tap callback; a horizontal swipe pages the strip ±1 week. Pure
 * presentation + a swipe gesture — week visibility and selection state live
 * on the caller; the strip just renders what it's given and reports taps.
 *
 * Visual signals (mockup structure — letters only, the date lives in the
 * DayNavHeader above; no day-of-month numbers in the strip):
 *   • selected day: the weekday letter inside a raised white disc
 *   • today (when ≠ selected): a quiet thin ring (borderStrong)
 *   • day had food logged: a small muted dot below the cell
 *
 * No future bound — Pass 2 allows future-week paging for meal planning.
 */
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { LocalDate } from '@core/observation';
import { Text } from './Text';
import { useTheme } from '@/theme';
import { weekdayLetter, weekOf } from '@/lib/date';

const CELL_SIZE = 40;
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
          return (
            <Pressable
              key={d}
              onPress={() => onSelectDay(d)}
              accessibilityRole="button"
              accessibilityLabel={`View ${d}${isToday ? ' (today)' : ''}${hasFood ? ', food logged' : ''}`}
              style={{ alignItems: 'center', gap: 6 }}
            >
              {/* Selected day → a raised white disc holding the letter; today
                  (when not selected) → a quiet ring; other days → bare letter. */}
              <View
                style={[
                  {
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    borderRadius: CELL_SIZE / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? theme.colors.surface : 'transparent',
                    borderWidth: !isSelected && isToday ? 1 : 0,
                    borderColor: theme.colors.borderStrong,
                  },
                  isSelected ? theme.shadow.sm : null,
                ]}
              >
                <Text
                  variant="label"
                  color={isSelected ? theme.colors.text : theme.colors.textMuted}
                >
                  {weekdayLetter(d)}
                </Text>
              </View>
              {/* Soft "food logged" marker — muted, not an alert. */}
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: hasFood ? theme.colors.textMuted : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}
