/**
 * BenchmarkDayGrid — the CURRENT window, one cell per day (flag: day-grain
 * rhythm; a strict upgrade over BenchmarkRhythm's per-window bar for 'days'
 * measures, since the day verdicts already exist).
 *
 * Same grammar as BenchmarkRhythm: one color, no green/red.
 *  - hit: filled solid.
 *  - unknowable: filled, hazed (not a verdict yet, never counted a miss).
 *  - missed: outline only — the day happened, proved nothing worth filling.
 *  - pending: faint dashed outline — hasn't happened yet, distinct from
 *    unknowable (which is a day that happened but stayed undecidable).
 */
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import type { DayCell } from '@/lib/benchmarkReflect';

type BenchmarkDayGridProps = {
  days: DayCell[];
};

const CELL = 20;

/** 'YYYY-MM-DD' → local weekday initial (UTC-civil, same posture as the window math). */
function weekdayInitial(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getUTCDay()];
}

export function BenchmarkDayGrid({ days }: BenchmarkDayGridProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Text variant="label">This window, by day</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing[2], flexWrap: 'wrap' }}>
        {days.map((d) => {
          const filled = d.verdict === 'hit' || d.verdict === 'unknowable';
          return (
            <View key={d.date} style={{ alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderStyle: d.verdict === 'pending' ? 'dashed' : 'solid',
                  borderColor:
                    d.verdict === 'missed' ? theme.colors.textSecondary : theme.colors.border,
                  backgroundColor: filled ? theme.colors.trendLine : 'transparent',
                  opacity: d.verdict === 'hit' ? 0.9 : d.verdict === 'unknowable' ? 0.35 : 1,
                }}
              />
              <Text variant="bodySm" color={theme.colors.textMuted}>
                {weekdayInitial(d.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
