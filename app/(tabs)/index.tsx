/**
 * Today — the home of the daily loop. Open it, see today, log a weigh-in, log a
 * session, leave.
 *
 * Phase 1 / Pass 1: placeholder structure that reads the theme correctly and
 * wires navigation to the log modals. The real weigh-in card lands in Pass 3,
 * sessions in Pass 4. Nothing here fabricates data.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Card, Button } from '@/components';
import { useTheme } from '@/theme';
import { todayLocalLabel, yearLabel } from '@/lib/date';

export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();

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
        <Text variant="body" color={theme.colors.textMuted}>
          Not logged today.
        </Text>
        <Button label="Log weigh-in" onPress={() => router.push('/log-weigh-in')} />
      </Card>

      {/* Food */}
      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
        <Text variant="label">Food</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          No food logged today.
        </Text>
        <Button
          label="Log food"
          onPress={() => router.push('/log-food')}
        />
      </Card>

      {/* Sessions */}
      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
        <Text variant="label">Today's sessions</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          No sessions yet.
        </Text>
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
