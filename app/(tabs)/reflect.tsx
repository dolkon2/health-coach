/**
 * Reflect — the long view, keyed by the user's benchmark (Phase 5 Pass 4).
 *
 * Three layers, in order (benchmarks-spec.md v0.4, "Three-layer hierarchy"):
 *   1. Frame — the active benchmark sets what the view is about; a lens
 *      switcher when several are active. Tap the frame to manage.
 *   2. Hero — the outcome face keys the hero when both faces exist (the
 *      measured story is what Reflect exists to mirror), with the behavior
 *      rhythm directly beneath as consistency context; a behavior-only
 *      benchmark promotes its rhythm — the doing IS the story.
 *   3. Supporting context — the stimulus ledger, plus the weight trend
 *      demoted here when it isn't the hero. (The correlation engine will
 *      rank this layer later; until then the existing views are the context.)
 *
 * No benchmark → the ledger is the neutral organizing frame, weight trend
 * below it (spec, "No-benchmark default": weight is never the default hero).
 * No CTA to create one — pull, not push.
 */
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Screen,
  Text,
  ChipSelect,
  WeightTrendChart,
  StimulusLedger,
  BenchmarkRhythm,
} from '@/components';
import { useTheme } from '@/theme';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useWeeklyStimulus } from '@/hooks/useWeeklyStimulus';
import { useBenchmarkReflect } from '@/hooks/useBenchmarkReflect';
import { useSettings } from '@/settings/useSettings';
import { outcomeLine } from '@/lib/benchmarkStatus';

export default function ReflectScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const { points, raw, reload: reloadTrend } = useWeightTrend();
  const { weeks, sessionsById, reload: reloadStimulus } = useWeeklyStimulus();
  const { benchmarks, lens, lensId, setLensId, reload: reloadBenchmarks } =
    useBenchmarkReflect(points);

  // Re-fetch on focus — e.g. after logging from Today (mirrors Today's pattern).
  useFocusEffect(
    useCallback(() => {
      reloadTrend();
      reloadStimulus();
      reloadBenchmarks();
    }, [reloadTrend, reloadStimulus, reloadBenchmarks])
  );

  const weightIsHero = lens?.hero === 'outcome';
  const rhythm =
    lens?.windowCounts && lens.benchmark.behavior ? (
      <BenchmarkRhythm
        counts={lens.windowCounts}
        run={lens.run}
        window={lens.benchmark.behavior.window}
      />
    ) : null;

  const weightChart = (
    <WeightTrendChart
      points={points}
      raw={raw}
      weightUnit={weightUnit}
      targetKg={
        weightIsHero && lens?.benchmark.outcome?.dimension.metric === 'bodyweight'
          ? lens.benchmark.outcome.target
          : undefined
      }
    />
  );

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.sandstone}>
        Reflect
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        The long view
      </Text>

      {lens ? (
        <>
          {/* ── Layer 1: the frame — what this view is about ─────────────── */}
          <Pressable
            onPress={() => router.push('/benchmarks')}
            accessibilityRole="button"
            accessibilityLabel={`Benchmark: ${lens.benchmark.title}`}
            style={{ marginTop: theme.spacing[8] }}
          >
            <Text variant="label" color={theme.colors.textMuted}>
              Working toward
            </Text>
            <Text variant="displayMd" style={{ marginTop: theme.spacing[1] }}>
              {lens.benchmark.title}
            </Text>
          </Pressable>
          {benchmarks.length > 1 ? (
            <View style={{ marginTop: theme.spacing[3] }}>
              <ChipSelect
                options={benchmarks.map((b) => ({ value: b.id, label: b.title }))}
                value={lensId}
                onChange={setLensId}
              />
            </View>
          ) : null}

          {/* ── Layer 2: the hero the benchmark promotes ─────────────────── */}
          {weightIsHero ? (
            <>
              <View style={{ marginTop: theme.spacing[6] }}>{weightChart}</View>
              {lens.outcome ? (
                <Text
                  variant="dataSm"
                  color={theme.colors.textSecondary}
                  style={{ marginTop: theme.spacing[2] }}
                >
                  {outcomeLine(lens.outcome, weightUnit)}
                </Text>
              ) : null}
              {/* Behavior beneath the hero — your own path, held or not,
                  against the movement it was meant to produce. */}
              {rhythm ? <View style={{ marginTop: theme.spacing[6] }}>{rhythm}</View> : null}
            </>
          ) : rhythm ? (
            <View style={{ marginTop: theme.spacing[6] }}>{rhythm}</View>
          ) : null}

          {/* ── Layer 3: supporting context ──────────────────────────────── */}
          <View style={{ marginTop: theme.spacing[8] }}>
            <StimulusLedger weeks={weeks} sessionsById={sessionsById} />
          </View>
          {!weightIsHero ? (
            <View style={{ marginTop: theme.spacing[8] }}>{weightChart}</View>
          ) : null}
        </>
      ) : (
        <>
          {/* No benchmark: the ledger is the neutral organizing frame; weight
              is never the default hero. No "set a goal!" CTA — pull, not push. */}
          <View style={{ marginTop: theme.spacing[8] }}>
            <StimulusLedger weeks={weeks} sessionsById={sessionsById} />
          </View>
          <View style={{ marginTop: theme.spacing[8] }}>{weightChart}</View>
        </>
      )}

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
