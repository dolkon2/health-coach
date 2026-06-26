/**
 * Settings — a gear-icon screen, not a tab. Pass 1 ships a working theme toggle
 * (exercises the ThemeProvider) and placeholders for the rest. Units, modality
 * picker, and JSON export are wired in later passes.
 */
import { View } from 'react-native';
import { Screen, Text, Card, Button } from '@/components';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <Screen scroll>
      <Card style={{ gap: theme.spacing[3] }}>
        <Text variant="label">Theme</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Currently {theme.scheme}. Dark is the default.
        </Text>
        <Button
          label={theme.scheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          variant="outline"
          onPress={theme.toggleScheme}
        />
      </Card>

      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[2] }}>
        <Text variant="label">Units</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          kg · km (configurable in a later pass)
        </Text>
      </Card>

      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[2] }}>
        <Text variant="label">Your data</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          One-button JSON export lands with the storage layer. You own your data.
        </Text>
      </Card>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
