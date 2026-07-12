/**
 * Reflect — the residual benchmark-keyed tap-in (profile-settings.md P8).
 *
 * When the 5-tab shell swap took Reflect off the bar, its layers dispersed:
 * the weight trend went to Nutrition Trend (N1), the stimulus ledger to
 * Settings › Views (locked #2, Dylan 2026-07-11: parked under Settings). What
 * remains here is the benchmark hero/lens — the correlation hub keyed by a
 * benchmark, per benchmarks-spec.md's three-layer hierarchy:
 *   1. Frame — the benchmark this view is about (tap to manage); a lens
 *      switcher when several active benchmarks are in browse mode.
 *   2. Hero — the outcome face the benchmark promotes (the weight chart when
 *      it's a bodyweight goal, the measured energy balance when it's that),
 *      or the behavior rhythm when the doing IS the story.
 *   3. Supporting — the behavior rhythm beneath an outcome hero.
 *
 * The ledger no longer renders here (its only door is Settings) and there is
 * no no-benchmark default: reached only from Profile, and Profile's entry is
 * absent when no benchmark exists, so this screen assumes a benchmark. Opened
 * two ways (locked: Profile is the only door): browsable "Reflect →" (lens
 * across active benchmarks) or keyed to one benchmark via ?benchmarkId= — a
 * current benchmark's card or a past goal's row (profile ⚑1).
 */
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Screen,
  Text,
  Card,
  ChipSelect,
  WeightTrendChart,
  BenchmarkRhythm,
  BenchmarkDayGrid,
} from '@/components';
import { useTheme } from '@/theme';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useExpenditure } from '@/hooks/useExpenditure';
import { useBenchmarkReflect } from '@/hooks/useBenchmarkReflect';
import { useSettings } from '@/settings/useSettings';
import { outcomeLine } from '@/lib/benchmarkStatus';

export default function ReflectScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const params = useLocalSearchParams<{ benchmarkId?: string }>();
  // A single string param; expo-router can hand back string[] for repeats.
  const focusId = Array.isArray(params.benchmarkId) ? params.benchmarkId[0] : params.benchmarkId;

  const { points, raw, reload: reloadTrend } = useWeightTrend();
  // The measured expenditure window feeds an energy-balance outcome lens —
  // the same residual the Nutrition tab's burn card shows.
  const { measured, reload: reloadExpenditure } = useExpenditure(points);
  const { benchmarks, lens, lensId, setLensId, reload: reloadBenchmarks } = useBenchmarkReflect(
    points,
    measured,
    focusId ?? null
  );

  // Re-fetch on focus — e.g. after editing a benchmark or logging.
  useFocusEffect(
    useCallback(() => {
      reloadTrend();
      reloadBenchmarks();
      reloadExpenditure();
    }, [reloadTrend, reloadBenchmarks, reloadExpenditure])
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

  // The chart appears only as an outcome hero for a bodyweight goal — the
  // standalone weight trend now lives on Nutrition Trend, not here.
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

  // A keyed open whose benchmark no longer exists vs a browse with nothing to
  // show — both honest, neither resurrects the ledger.
  const emptyMessage = focusId
    ? 'This benchmark is no longer here.'
    : 'No benchmarks to reflect on yet.';

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
          {/* Lens switcher only in browse mode — a keyed open is single-benchmark. */}
          {!focusId && benchmarks.length > 1 ? (
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
        </>
      ) : (
        <Card style={{ marginTop: theme.spacing[8] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            {emptyMessage}
          </Text>
        </Card>
      )}

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
