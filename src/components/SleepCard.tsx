/**
 * SleepCard — last night's sleep duration, read-only.
 *
 * Auto-imported from HealthKit. Attribution rule: sleep belongs to the WAKE day
 * (the civil day it ended). Staged breakdown (deep/REM/light) is stored on the
 * Observation when available but deliberately never surfaced above the hours.
 */
import { Card, Text } from '@/components';
import { useTheme } from '@/theme';
import type { ObservationOf } from '@core/observation';

type Props = { observation: ObservationOf<'sleep'> | null };

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${h}h ${m}m`;
}

export function SleepCard({ observation }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: theme.spacing[1] }}>
      <Text variant="label" color={theme.colors.textSecondary}>
        Sleep
      </Text>
      {observation ? (
        <>
          <Text variant="dataLg">{formatDuration(observation.payload.durationMin)}</Text>
          <Text variant="dataSm" color={theme.colors.textMuted}>
            last night
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
