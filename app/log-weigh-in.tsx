/**
 * Log weigh-in — a modal from Today. Pass 1 placeholder; the real number input,
 * unit suffix, optional body-fat field, and Observation write land in Pass 3.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button } from '@/components';
import { useTheme } from '@/theme';

export default function LogWeighInScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen>
      <Text variant="displayMd">Log weigh-in</Text>
      <Text variant="body" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[3] }}>
        The weigh-in input is built in Pass 3, once the storage layer (Pass 2) can
        persist an Observation.
      </Text>
      <View style={{ height: theme.spacing[6] }} />
      <Button label="Close" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}
