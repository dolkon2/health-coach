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
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, Button, SessionCard, SwipeToDelete } from '@/components';
import { useTheme } from '@/theme';
import { todayLocalLabel, yearLabel } from '@/lib/date';
import { useTodayObservations } from '@/hooks/useTodayObservations';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useTodayStimulusContributions } from '@/hooks/useTodayStimulusContributions';
import { useSettings } from '@/settings/useSettings';
import { formatWeight, formatDelta } from '@/lib/units';
import { deleteObservation } from '@/storage/observations';

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

  const removeAndReload = useCallback(
    async (id: string) => {
      await deleteObservation(id);
      reloadToday();
      reloadTrend();
    },
    [reloadToday, reloadTrend]
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
      <View style={{ marginTop: theme.spacing[8] }}>
        <Text variant="label" style={{ marginBottom: theme.spacing[2] }}>
          Weigh-in
        </Text>
        {weighInToday ? (
          <SwipeToDelete
            onDelete={() => removeAndReload(weighInToday.id)}
            confirmTitle="Delete weigh-in?"
            confirmMessage={`${formatWeight(
              weighInToday.payload.weightKg,
              weightUnit
            )} — permanent.`}
          >
            <Card style={{ gap: theme.spacing[3] }}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/log-weigh-in',
                    params: { editId: weighInToday.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Edit weigh-in"
                style={{ gap: theme.spacing[1] }}
              >
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
              </Pressable>
              <Button
                label="Log another"
                variant="ghost"
                onPress={() => router.push('/log-weigh-in')}
              />
            </Card>
          </SwipeToDelete>
        ) : (
          <Card style={{ gap: theme.spacing[3] }}>
            <Text variant="body" color={theme.colors.textMuted}>
              Not logged today.
            </Text>
            <Button label="Log weigh-in" onPress={() => router.push('/log-weigh-in')} />
          </Card>
        )}
      </View>

      {/* Sessions */}
      <View style={{ marginTop: theme.spacing[3] }}>
        <Text variant="label" style={{ marginBottom: theme.spacing[2] }}>
          Today's sessions
        </Text>
        {sessionsToday.length > 0 ? (
          <View style={{ gap: theme.spacing[3] }}>
            {sessionsToday.map((session) => (
              <SwipeToDelete
                key={session.id}
                onDelete={() => removeAndReload(session.id)}
                confirmTitle="Delete session?"
                confirmMessage={`${session.payload.modality} — permanent.`}
              >
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/log-session',
                      params: { editId: session.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${session.payload.modality} session`}
                >
                  <SessionCard
                    session={session}
                    contribution={contributions[session.id]}
                  />
                </Pressable>
              </SwipeToDelete>
            ))}
          </View>
        ) : (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              No sessions yet.
            </Text>
          </Card>
        )}
        <Button
          label="Log session"
          variant="secondary"
          onPress={() => router.push('/log-session')}
          style={{ marginTop: theme.spacing[3] }}
        />
        <Button
          label="Log food"
          variant="secondary"
          onPress={() => router.push('/log-food')}
          style={{ marginTop: theme.spacing[2] }}
        />
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
