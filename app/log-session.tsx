/**
 * Log session — a modal from Today. Pass 1 placeholder; the modality picker, set
 * logger with required movement-pattern tagging, and Observation write land in
 * Pass 4.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button } from '@/components';
import { useTheme } from '@/theme';

export default function LogSessionScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen>
      <Text variant="displayMd">Log session</Text>
      <Text variant="body" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[3] }}>
        The session logger — modality picker, sets, and movement-pattern tagging —
        is built in Pass 4.
      </Text>
      <View style={{ height: theme.spacing[6] }} />
      <Button label="Close" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}
