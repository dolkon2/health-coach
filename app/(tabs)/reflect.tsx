/**
 * Reflect — the long view. The smoothed weight trend on top, the weekly stimulus
 * ledger below, scrollable. This is where Phase 1 starts feeling like a product.
 *
 * Both components read from the engine (trend.ts / stimulus.ts) and own their own
 * honest empty states — when there isn't enough data, they say so rather than
 * drawing a fabricated curve. No TDEE: without intake data the expenditure engine
 * can't produce an honest number, so we say that plainly instead of faking one.
 *
 * Benchmarks (user-written intent) land at the top of this tab in the next Reflect
 * pass; this screen builds the foundation they'll sit on.
 */
import { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, Text, WeightTrendChart, StimulusLedger } from '@/components';
import { useTheme } from '@/theme';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useWeeklyStimulus } from '@/hooks/useWeeklyStimulus';
import { useSettings } from '@/settings/useSettings';

export default function ReflectScreen() {
  const theme = useTheme();
  const { weightUnit } = useSettings();
  const { points, raw, reload: reloadTrend } = useWeightTrend();
  const { weeks, sessionsById, reload: reloadStimulus } = useWeeklyStimulus();

  // Re-fetch on focus — e.g. after logging from Today (mirrors Today's pattern).
  useFocusEffect(
    useCallback(() => {
      reloadTrend();
      reloadStimulus();
    }, [reloadTrend, reloadStimulus])
  );

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.sandstone}>
        Reflect
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        The long view
      </Text>

      <View style={{ marginTop: theme.spacing[8] }}>
        <WeightTrendChart points={points} raw={raw} weightUnit={weightUnit} />
      </View>

      <View style={{ marginTop: theme.spacing[8] }}>
        <StimulusLedger weeks={weeks} sessionsById={sessionsById} />
      </View>

      {/* No fabricated expenditure — honest about what's missing (Phase 2). */}
      <Text
        variant="dataSm"
        color={theme.colors.textMuted}
        style={{ marginTop: theme.spacing[8] }}
      >
        Expenditure available once food logging is in (Phase 2).
      </Text>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
