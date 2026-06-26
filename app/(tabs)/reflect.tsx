/**
 * Reflect — the weight trend chart and the stimulus ledger. This is where
 * Phase 1 starts feeling like a product.
 *
 * Pass 1: placeholder. The custom SVG trend chart lands in Pass 5; the ledger
 * too. Until the engine is built, Reflect honestly says there's nothing to show
 * yet rather than rendering a fabricated curve.
 */
import { View } from 'react-native';
import { Screen, Text, Card } from '@/components';
import { useTheme } from '@/theme';

export default function ReflectScreen() {
  const theme = useTheme();

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.sandstone}>
        Reflect
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        The long view
      </Text>

      <Card style={{ marginTop: theme.spacing[8], gap: theme.spacing[2] }}>
        <Text variant="label">Weight trend</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Log a few weigh-ins and a smoothed trend will appear here.
        </Text>
      </Card>

      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[2] }}>
        <Text variant="label">Stimulus ledger</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Log sessions and your weekly volume by movement pattern shows up here.
        </Text>
      </Card>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
