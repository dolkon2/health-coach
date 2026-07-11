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
  BenchmarkDayGrid,
} from '@/components';
import { useTheme } from '@/theme';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useWeeklyStimulus } from '@/hooks/useWeeklyStimulus';
import { useBenchmarkReflect } from '@/hooks/useBenchmarkReflect';
import { useExpenditure } from '@/hooks/useExpenditure';
import { useSettings } from '@/settings/useSettings';
import { outcomeLine } from '@/lib/benchmarkStatus';

export default function ReflectScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const { points, raw, reload: reloadTrend } = useWeightTrend();
  const { weeks, sessionsById, reload: reloadStimulus } = useWeeklyStimulus();
  // The measured expenditure window feeds an energy-balance outcome lens —
  // the same residual the Nutrition tab's burn card shows.
  const { measured, reload: reloadExpenditure } = useExpenditure(points);
  const { benchmarks, lens, lensId, setLensId, reload: reloadBenchmarks } =
    useBenchmarkReflect(points, measured);

  // Re-fetch on focus — e.g. after logging from Today (mirrors Today's pattern).
  useFocusEffect(
    useCallback(() => {
      reloadTrend();
      reloadStimulus();
      reloadBenchmarks();
      reloadExpenditure();
    }, [reloadTrend, reloadStimulus, reloadBenchmarks, reloadExpenditure])
  );

  const outcomeMetric = lens?.benchmark.outcome?.dimension.metric;
  const weightIsHero = lens?.hero === 'outcome' && outcomeMetric === 'bodyweight';
  // An energy-balance outcome keys a numeric hero (no chart exists for it):
  // the measured balance, or the honest not-enough-data line.
  const balanceIsHero = lens?.hero === 'outcome' && outcomeMetric === 'energyBalance';
  const rhythm =
    lens?.windowCounts && lens.benchmark.behavior ? (
      <>
        <BenchmarkRhythm
          counts={lens.windowCounts}
          run={lens.run}
          window={lens.benchmark.behavior.window}
        />
        {lens.dayGrid ? (
          <View style={{ marginTop: theme.spacing[4] }}>
            <BenchmarkDayGrid days={lens.dayGrid} />
          </View>
        ) : null}
      </>
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
      <Text variant="label" color={theme.colors.accent}>
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
          ) : balanceIsHero ? (
            <>
              {/* Energy balance: measured intake − measured burn. Reads as a
                  plain number with its provenance, or the honest absence. */}
              <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[2] }}>
                <Text variant="label">Energy balance</Text>
                <Text
                  variant={lens.outcome?.kind === 'balance' ? 'dataLg' : 'body'}
                  color={
                    lens.outcome?.kind === 'balance'
                      ? theme.colors.text
                      : theme.colors.textMuted
                  }
                >
                  {lens.outcome ? outcomeLine(lens.outcome, weightUnit) : ''}
                </Text>
                {lens.outcome?.kind !== 'balance' ? (
                  <Text variant="bodySm" color={theme.colors.textMuted}>
                    Measured from your logged food and weigh-in trend once both
                    can carry it — never predicted.
                  </Text>
                ) : null}
              </View>
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

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
