/**
 * LogbookCalendar — the Strong-style month grid for the Profile logbook
 * (profile-settings.md §2/§3). Checkmark days are days with ≥1 logged session;
 * empty days are neutral, never red. Tapping a marked day selects it so the
 * parent can render that day's entries beneath the grid.
 *
 * Pure month math lives in lib/logbookCalendar.ts; this is presentation only.
 * It fabricates nothing — a day with no sessions is simply un-marked, and the
 * grid renders the same whether or not anything was logged that month.
 */
import { View, Pressable } from 'react-native';
import { useState } from 'react';
import type { LocalDate } from '@core/observation';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { monthCells, monthLabel, shiftMonth } from '@/lib/logbookCalendar';
import { todayLocalDate } from '@/lib/date';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type LogbookCalendarProps = {
  /** Local days ('YYYY-MM-DD') that carry at least one session. */
  markedDays: Set<string>;
  selectedDay: LocalDate | null;
  /** Called with a day when one is tapped, or null when paging away clears it. */
  onSelectDay: (day: LocalDate | null) => void;
};

export function LogbookCalendar({ markedDays, selectedDay, onSelectDay }: LogbookCalendarProps) {
  const theme = useTheme();
  const today = todayLocalDate();
  // Open on the selected day's month if one is set, else the current month.
  const [anchor, setAnchor] = useState<LocalDate>(selectedDay ?? today);
  const cells = monthCells(anchor);
  const weeks = Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  // Paging months clears a selection the new month can't show, so the grid and
  // the parent's day-detail section never disagree about which day is in view.
  function goToMonth(delta: number) {
    const next = shiftMonth(anchor, delta);
    setAnchor(next);
    if (selectedDay && !selectedDay.startsWith(next.slice(0, 7))) onSelectDay(null);
  }

  return (
    <View style={{ gap: theme.spacing[3] }}>
      {/* Month nav */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <NavArrow label="Previous month" glyph="‹" onPress={() => goToMonth(-1)} />
        <Text variant="label">{monthLabel(anchor)}</Text>
        <NavArrow label="Next month" glyph="›" onPress={() => goToMonth(1)} />
      </View>

      {/* Weekday header */}
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="label" color={theme.colors.textMuted}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={{ gap: theme.spacing[2] }}>
        {weeks.map((week, w) => (
          <View key={w} style={{ flexDirection: 'row' }}>
            {week.map((cell) => {
              const marked = cell.inMonth && markedDays.has(cell.date);
              // Only a still-marked day shows the selected fill — a day whose
              // last session was just deleted drops both the dot and the fill.
              const selected = marked && cell.date === selectedDay;
              const isToday = cell.inMonth && cell.date === today;
              const dayNum = Number(cell.date.split('-')[2]);
              return (
                <View key={cell.date} style={{ flex: 1, alignItems: 'center' }}>
                  <Pressable
                    disabled={!marked}
                    onPress={() => onSelectDay(cell.date)}
                    accessibilityRole={marked ? 'button' : undefined}
                    accessibilityLabel={marked ? `Sessions on ${cell.date}` : undefined}
                    accessibilityState={{ selected }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: theme.radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? theme.colors.accent : 'transparent',
                      borderWidth: isToday && !selected ? 1 : 0,
                      borderColor: theme.colors.border,
                    }}
                  >
                    <Text
                      variant="dataSm"
                      color={
                        selected
                          ? theme.colors.bg
                          : marked
                            ? theme.colors.text
                            : theme.colors.textMuted
                      }
                      style={{ opacity: cell.inMonth ? 1 : 0.35 }}
                    >
                      {dayNum}
                    </Text>
                    {/* A quiet dot marks a day that carries a session — the
                        "checkmark" idiom, adherence-neutral (never a color of
                        judgment). Hidden on the selected day (the fill reads it). */}
                    {marked && !selected ? (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 3,
                          width: 4,
                          height: 4,
                          borderRadius: theme.radius.full,
                          backgroundColor: theme.colors.accent,
                        }}
                      />
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function NavArrow({
  label,
  glyph,
  onPress,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={label}>
      <Text variant="displayMd" color={theme.colors.textMuted}>
        {glyph}
      </Text>
    </Pressable>
  );
}
