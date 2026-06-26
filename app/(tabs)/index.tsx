/**
 * Today — the home of the daily loop. Open it, see today, log a weigh-in, log a
 * session, leave.
 *
 * Pass 3: the weigh-in card is live. Two states — not-logged (a tap target) and
 * logged (today's weight + the smoothed trend delta from core/trend.ts). The
 * delta line only renders when the engine has enough data for an honest answer;
 * it never fabricates one. Sessions stay a placeholder until Pass 4.
 */
import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, Button, SessionCard } from '@/components';
import { useTheme } from '@/theme';
import { todayLocalLabel, yearLabel } from '@/lib/date';
import { useTodayObservations } from '@/hooks/useTodayObservations';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useTodayStimulusContributions } from '@/hooks/useTodayStimulusContributions';
import { useSettings } from '@/settings/useSettings';
import { formatWeight, formatDelta } from '@/lib/units';

export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();

  const { weighInToday, sessionsToday, reload: reloadToday } = useTodayObservations();
  const { delta, reload: reloadTrend } = useWeightTrend();
  const contributions = useTodayStimulusContributions(sessionsToday);

  // Re-fetch whenever Today regains focus — e.g. after the weigh-in modal saves.
  useFocusEffect(
    useCallback(() => {
      reloadToday();
      reloadTrend();
    }, [reloadToday, reloadTrend])
  );

  return (
    <Screen scroll>
      {/* Date header — display font, uppercase, primary text */}
      <Text variant="label" color={theme.colors.sandstone}>
        Today
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        {todayLocalLabel()}
      </Text>
      <Text variant="dataSm" style={{ marginTop: theme.spacing[1] }}>
        {yearLabel()}
      </Text>

      {/* Weigh-in */}
      <Card style={{ marginTop: theme.spacing[8], gap: theme.spacing[3] }}>
        <Text variant="label">Weigh-in</Text>
        {weighInToday ? (
          <>
            <Text variant="dataLg" color={theme.colors.text}>
              {formatWeight(weighInToday.payload.weightKg, weightUnit)}
            </Text>
            {delta ? (
              <Text variant="dataSm" color={theme.colors.textSecondary}>
                {`trend: ${formatWeight(delta.trendKg, weightUnit)}, ${formatDelta(
                  delta.deltaKg,
                  weightUnit
                )} over ${delta.days} days`}
              </Text>
            ) : null}
            <Button
              label="Update weigh-in"
              variant="ghost"
              onPress={() => router.push('/log-weigh-in')}
            />
          </>
        ) : (
          <>
            <Text variant="body" color={theme.colors.textMuted}>
              Not logged today.
            </Text>
            <Button label="Log weigh-in" onPress={() => router.push('/log-weigh-in')} />
          </>
        )}
      </Card>

      {/* Sessions */}
      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
        <Text variant="label">Today's sessions</Text>
        {sessionsToday.length > 0 ? (
          sessionsToday.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              contribution={contributions[session.id]}
            />
          ))
        ) : (
          <Text variant="body" color={theme.colors.textMuted}>
            No sessions yet.
          </Text>
        )}
        <Button
          label="Log session"
          variant="secondary"
          onPress={() => router.push('/log-session')}
        />
      </Card>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
