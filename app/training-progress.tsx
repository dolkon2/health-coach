/**
 * Training Progress — the Training tab's "Progress →" tap-in.
 *
 * Body P3: calisthenics skill-ladder chains (current step + ladder position,
 * core/ladderTrend.ts). Body P4 extends this screen with gym analytics (lift
 * detail, weekly tonnage) — same tap-in, same "functional only" scope; the
 * Gorge redesign owns polish.
 */
import { View } from 'react-native';
import { Screen, Text, Card } from '@/components';
import { useTheme } from '@/theme';
import { useLadderProgress } from '@/hooks/useLadderProgress';

export default function TrainingProgressScreen() {
  const theme = useTheme();
  const { chains, loading } = useLadderProgress();

  return (
    <Screen scroll>
      <Text variant="displayLg">Progress</Text>

      <Text
        variant="label"
        style={{ marginTop: theme.spacing[6], marginBottom: theme.spacing[2] }}
      >
        Calisthenics ladders
      </Text>
      {loading ? null : chains.length > 0 ? (
        <View style={{ gap: theme.spacing[3] }}>
          {chains.map((c) => (
            <Card key={c.chainId} style={{ gap: theme.spacing[1] }}>
              <Text variant="label" color={theme.colors.sandstone}>
                {c.chainName}
              </Text>
              <Text variant="body">{c.stepName}</Text>
              <Text variant="dataSm" color={theme.colors.textMuted}>
                Ladder position {c.current.ladderPosition.toFixed(2)}
              </Text>
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <Text variant="body" color={theme.colors.textMuted}>
            No ladder steps logged yet — pick one from the calisthenics picker to
            start tracking progress.
          </Text>
        </Card>
      )}

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
