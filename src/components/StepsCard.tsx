/**
 * StepsCard — today's step count, read-only.
 *
 * Auto-imported from HealthKit (no manual entry, no edit, no swipe-to-delete).
 * Tier-1 fact only — no chart, no comparison, no "you walked X% more". This is
 * a mirror, not a coach.
 */
import { Card, Text } from '@/components';
import { useTheme } from '@/theme';
import type { ObservationOf } from '@core/observation';

type Props = { observation: ObservationOf<'steps'> | null };

export function StepsCard({ observation }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: theme.spacing[1] }}>
      <Text variant="label" color={theme.colors.textSecondary}>
        Steps
      </Text>
      {observation ? (
        <>
          <Text variant="dataLg">{observation.payload.count.toLocaleString()}</Text>
          <Text variant="dataSm" color={theme.colors.textMuted}>
            today
          </Text>
        </>
      ) : (
        <Text variant="body" color={theme.colors.textMuted}>
          No data yet.
        </Text>
      )}
    </Card>
  );
}
