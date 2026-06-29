/**
 * RestTimer — the in-app rest countdown banner. Tap to skip. It only renders while
 * a rest is running (the screen guards on remainingSec > 0); the matching local
 * notification (useRestTimer) covers the phone-down case.
 */
import React from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { formatRest } from '@/lib/restTimer';

type RestTimerProps = {
  remainingSec: number;
  onSkip: () => void;
};

export function RestTimer({ remainingSec, onSkip }: RestTimerProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onSkip}
      accessibilityRole="button"
      accessibilityLabel={`Resting, ${remainingSec} seconds left. Tap to skip.`}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
      }}
    >
      <Text variant="label" color={theme.colors.sandstone}>
        Rest · {formatRest(remainingSec)}
      </Text>
      <Text variant="label" color={theme.colors.textMuted}>
        Skip
      </Text>
    </Pressable>
  );
}
