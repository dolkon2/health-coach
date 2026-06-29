/**
 * DayNavHeader — the title row above the WeekStrip. Renders the selected
 * day's label ("Today" / "Yesterday" / "Tomorrow" / "Sun, Jun 22") with
 * prev/next arrows for ±1 day stepping. The label itself is tappable as
 * a quick "jump back to today" shortcut when the selected day ≠ today
 * (cf. MacroFactor).
 *
 * No future bound on `›` — Pass 2 allows future-day viewing for meal
 * planning. (Logger-to-future is the separate Pass 2.5 work.)
 */
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { LocalDate } from '@core/observation';
import { Text } from './Text';
import { useTheme } from '@/theme';
import { dayNavLabel } from '@/lib/date';

type Props = {
  selectedDate: LocalDate;
  today: LocalDate;
  onPrev: () => void;
  onNext: () => void;
  onJumpToToday: () => void;
};

export function DayNavHeader({
  selectedDate,
  today,
  onPrev,
  onNext,
  onJumpToToday,
}: Props) {
  const theme = useTheme();
  const label = dayNavLabel(selectedDate, today);
  const isToday = selectedDate === today;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[3],
      }}
    >
      <Pressable
        onPress={onPrev}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Previous day"
      >
        <ChevronLeft size={28} color={theme.colors.textSecondary} strokeWidth={1.5} />
      </Pressable>
      <Pressable
        onPress={isToday ? undefined : onJumpToToday}
        disabled={isToday}
        accessibilityRole={isToday ? undefined : 'button'}
        accessibilityLabel={isToday ? undefined : 'Jump to today'}
        hitSlop={6}
      >
        <Text variant="displayLg">{label}</Text>
      </Pressable>
      <Pressable
        onPress={onNext}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Next day"
      >
        <ChevronRight size={28} color={theme.colors.textSecondary} strokeWidth={1.5} />
      </Pressable>
    </View>
  );
}
