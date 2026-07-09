/**
 * Training Progress — the Training tab's "Progress →" tap-in.
 *
 * Body P3: calisthenics skill-ladder chains (current step + ladder position,
 * core/ladderTrend.ts). Body P4: gym analytics — lifts list (tap through to
 * e1RM trend + PRs on /lift-detail) and this week's muscle-group tonnage
 * (core/gymAnalytics.ts). Functional only; the Gorge redesign owns polish.
 */
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Card } from '@/components';
import { useTheme } from '@/theme';
import { useLadderProgress } from '@/hooks/useLadderProgress';
import { useGymAnalytics } from '@/hooks/useGymAnalytics';
import { MUSCLE_GROUP_LABELS, PR_KIND_LABELS } from '@/lib/gymAnalyticsLabels';

export default function TrainingProgressScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { chains, loading: laddersLoading } = useLadderProgress();
  const { lifts, weeklyTonnage, loading: liftsLoading } = useGymAnalytics();

  const tonnageRows = Object.entries(weeklyTonnage).filter(([, v]) => (v ?? 0) > 0) as Array<
    [keyof typeof MUSCLE_GROUP_LABELS, number]
  >;

  return (
    <Screen scroll>
      <Text variant="displayLg">Progress</Text>

      <Text
        variant="label"
        style={{ marginTop: theme.spacing[6], marginBottom: theme.spacing[2] }}
      >
        Lifts
      </Text>
      {liftsLoading ? null : lifts.length > 0 ? (
        <View style={{ gap: theme.spacing[3] }}>
          {lifts.map((lift) => (
            <Pressable
              key={lift.exerciseKey}
              onPress={() =>
                router.push({
                  pathname: '/lift-detail',
                  params: { exerciseKey: lift.exerciseKey },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${lift.exercise} detail`}
            >
              <Card style={{ gap: theme.spacing[1] }}>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text variant="label" color={theme.colors.sandstone}>
                    {lift.exercise}
                  </Text>
                  {lift.newPrKinds.includes('e1rm') ? (
                    <Text variant="dataSm" color={theme.colors.sandstone}>
                      PR
                    </Text>
                  ) : null}
                </View>
                <Text variant="dataSm" color={theme.colors.textMuted}>
                  e1RM {lift.points[lift.points.length - 1]?.e1rmKg.toFixed(1)} kg
                </Text>
                {lift.newPrKinds.filter((k) => k !== 'e1rm').length > 0 ? (
                  <Text variant="dataSm" color={theme.colors.textMuted}>
                    Also a PR:{' '}
                    {lift.newPrKinds
                      .filter((k) => k !== 'e1rm')
                      .map((k) => PR_KIND_LABELS[k])
                      .join(', ')}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <Card>
          <Text variant="body" color={theme.colors.textMuted}>
            No working sets logged yet — e1RM tracks reps-based sets (excludes
            warmups and sets over 12 reps).
          </Text>
        </Card>
      )}

      <Text
        variant="label"
        style={{ marginTop: theme.spacing[8], marginBottom: theme.spacing[2] }}
      >
        This week's tonnage
      </Text>
      {liftsLoading ? null : tonnageRows.length > 0 ? (
        <Card style={{ gap: theme.spacing[2] }}>
          {tonnageRows
            .sort((a, b) => b[1] - a[1])
            .map(([group, kg]) => (
              <View
                key={group}
                style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <Text variant="body">{MUSCLE_GROUP_LABELS[group]}</Text>
                <Text variant="dataSm" color={theme.colors.textMuted}>
                  {kg.toFixed(0)} kg
                </Text>
              </View>
            ))}
        </Card>
      ) : (
        <Card>
          <Text variant="body" color={theme.colors.textMuted}>
            No tonnage this week yet — only library-linked exercises (picked
            from the exercise picker) contribute to muscle-group tonnage.
          </Text>
        </Card>
      )}

      <Text
        variant="label"
        style={{ marginTop: theme.spacing[8], marginBottom: theme.spacing[2] }}
      >
        Calisthenics ladders
      </Text>
      {laddersLoading ? null : chains.length > 0 ? (
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
