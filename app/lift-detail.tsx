/**
 * Lift detail — e1RM trend + recent sessions for one exercise (Body P4).
 * Reached from the Training Progress screen's Lifts list. Functional only.
 */
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Text, Card } from '@/components';
import { useTheme } from '@/theme';
import { useGymAnalytics } from '@/hooks/useGymAnalytics';

export default function LiftDetailScreen() {
  const theme = useTheme();
  const { exerciseKey } = useLocalSearchParams<{ exerciseKey?: string }>();
  const { lifts, loading } = useGymAnalytics();
  const lift = lifts.find((l) => l.exerciseKey === exerciseKey);

  if (loading) {
    return (
      <Screen scroll>
        <Text variant="displayLg">Lift</Text>
      </Screen>
    );
  }

  if (!lift) {
    return (
      <Screen scroll>
        <Text variant="displayLg">Lift</Text>
        <Card style={{ marginTop: theme.spacing[6] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            No working sets found for this exercise.
          </Text>
        </Card>
      </Screen>
    );
  }

  const recent = [...lift.points].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <Screen scroll>
      <Text variant="displayLg">{lift.exercise}</Text>
      <Text
        variant="label"
        style={{ marginTop: theme.spacing[6], marginBottom: theme.spacing[2] }}
      >
        e1RM trend (Epley, working sets, ≤12 reps)
      </Text>
      <View style={{ gap: theme.spacing[2] }}>
        {recent.map((p, i) => (
          <Card key={`${p.date}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body">{p.date}</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
              {i === 0 && lift.isPR ? (
                <Text variant="dataSm" color={theme.colors.sandstone}>
                  PR
                </Text>
              ) : null}
              <Text variant="dataSm" color={theme.colors.textMuted}>
                {p.e1rmKg.toFixed(1)} kg
              </Text>
            </View>
          </Card>
        ))}
      </View>
      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
