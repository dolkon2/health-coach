/**
 * Stimulus ledger — the Settings › Views tap-in (profile-settings.md P4, locked
 * #2). A full screen rendering the existing StimulusLedger over the weekly
 * stimulus read model: read-only over sessions, the engine untouched.
 *
 * This is where the ledger parks — "highly deferred" is a product status and
 * Settings expresses it honestly. Recorded graduation condition (⚑6): if Reflect
 * ever ships a ledger mode, this entry retires. Descriptive only; no CTA to
 * train, ever.
 */
import { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, Text, StimulusLedger } from '@/components';
import { useTheme } from '@/theme';
import { useWeeklyStimulus } from '@/hooks/useWeeklyStimulus';

export default function StimulusLedgerScreen() {
  const theme = useTheme();
  const { weeks, sessionsById, reload } = useWeeklyStimulus();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.accent}>
        Views
      </Text>
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        Stimulus ledger
      </Text>
      <Text variant="body" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
        A week-by-week read of the training you logged, grouped by pattern. It
        describes what you did — never a target, score, or prompt to do more.
      </Text>

      <View style={{ marginTop: theme.spacing[8] }}>
        <StimulusLedger weeks={weeks} sessionsById={sessionsById} />
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
