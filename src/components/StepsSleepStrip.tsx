/**
 * StepsSleepStrip — Home's demoted steps/sleep line (H3,
 * planning/rework/tabs/home-tab.md § 3: "deliberately non-headline"). One
 * line, smallest type on the page, hours + count only — no chart, no
 * comparison, no tier-3 staged-sleep/readiness score (locked #9). Presence:
 * HealthKit connected and at least one of today's values exists; otherwise
 * absent (the caller decides whether to render this at all). Non-interactive
 * at MVP (home-tab.md § 3 open question).
 */
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { formatDurationHm } from '@/lib/date';
import type { ObservationOf } from '@core/observation';

type StepsSleepStripProps = {
  steps: ObservationOf<'steps'> | null;
  sleep: ObservationOf<'sleep'> | null;
};

export function StepsSleepStrip({ steps, sleep }: StepsSleepStripProps) {
  const theme = useTheme();
  const parts: string[] = [];
  if (steps) parts.push(`${steps.payload.count.toLocaleString()} steps`);
  if (sleep) parts.push(`${formatDurationHm(sleep.payload.durationMin)} sleep`);
  if (parts.length === 0) return null;

  return (
    <View>
      <Text variant="dataSm" color={theme.colors.textMuted}>
        {parts.join(' · ')}
      </Text>
    </View>
  );
}
