/**
 * BenchmarkDetailSheet — the decision-proof detail tap-in
 * (benchmarks-templates.md B2 / §3 "Benchmark detail sheet"). Mounts from
 * the list surface and from Home's pinned cards; identical under every
 * type/list-layout outcome. Hero = outcome face when both faces exist (v0.4
 * rule), behavior rhythm beneath as consistency context; a behavior-only
 * benchmark promotes its own rhythm. Lifecycle actions (pause/done/
 * reactivate) sit at the bottom; "Edit" hands off to the Structured-entry
 * form for anything beyond status. Face-type badges come from the
 * decision-proof classifier (@core/benchmarkClassify) — Compliance/Outcome/
 * Trend, per face, never a user-picked type.
 *
 * Also a candidate mount point for nutrition adherence history (locked
 * #12d, owned by nutrition-tab.md ⚑1) — the history panel below already
 * renders generically off `windowCounts`/`dayGrid`, so a future nutrition
 * face needs no new sheet, just data.
 */
import { useState } from 'react';
import { Modal, View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { Button } from './Button';
import { BenchmarkRhythm } from './BenchmarkRhythm';
import { BenchmarkDayGrid } from './BenchmarkDayGrid';
import { useBenchmarkDetail } from '@/hooks/useBenchmarkDetail';
import { useSettings } from '@/settings/useSettings';
import { behaviorLine, outcomeLine } from '@/lib/benchmarkStatus';
import { benchmarkLabels, BENCHMARK_FACE_LABEL } from '@core/benchmarkClassify';
import { updateBenchmark } from '@/storage/benchmarks';
import type { Benchmark } from '@core/benchmark';
import type { WeightTrendPoint } from '@core/trend';
import type { ExpenditureWindow } from '@core/expenditure';

type BenchmarkDetailSheetProps = {
  /** null closes the sheet — the same "controlled by id" idiom the list and
   *  Home both use for the single instance they mount. */
  benchmarkId: string | null;
  onClose: () => void;
  /** Called after a lifecycle action changes the benchmark, so the caller's
   *  own list/card data refreshes too. */
  onChanged?: () => void;
  /**
   * Caller-supplied trend/expenditure data — REQUIRED, not fetched here.
   * The sheet is always mounted (a Modal just toggles `visible`), so if it
   * ran its own useWeightTrend/useExpenditure it would re-run those 90-day
   * queries on every render of its host screen whether or not the sheet is
   * open. Both callers (Home, /benchmarks) already have this data available
   * for their own benchmark-status rendering — pass it straight through.
   */
  trendPoints: WeightTrendPoint[];
  measured: ExpenditureWindow | null;
};

export function BenchmarkDetailSheet({
  benchmarkId,
  onClose,
  onChanged,
  trendPoints,
  measured,
}: BenchmarkDetailSheetProps) {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const { benchmark, lens, groups, reload } = useBenchmarkDetail(
    benchmarkId,
    trendPoints,
    measured
  );
  const [saving, setSaving] = useState(false);

  async function setStatus(status: Benchmark['status']) {
    if (!benchmark || saving) return;
    setSaving(true);
    try {
      await updateBenchmark(benchmark.id, {
        status,
        resolvedAt: status === 'active' ? undefined : new Date().toISOString(),
      });
      reload();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  function editBenchmark() {
    if (!benchmark) return;
    onClose();
    router.push({ pathname: '/edit-benchmark', params: { benchmarkId: benchmark.id } });
  }

  const visible = benchmarkId != null;
  const labels = benchmark ? benchmarkLabels(benchmark) : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          padding: theme.spacing[5],
          maxHeight: '85%',
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {benchmark && lens ? (
            <>
              <Text variant="label" color={theme.colors.textMuted}>
                Benchmark
              </Text>
              <Text variant="displayMd" style={{ marginTop: theme.spacing[1] }}>
                {benchmark.title}
              </Text>
              {labels.length > 0 ? (
                <View
                  style={{ flexDirection: 'row', gap: theme.spacing[2], marginTop: theme.spacing[3] }}
                >
                  {labels.map((l) => (
                    <FaceBadge key={l} label={BENCHMARK_FACE_LABEL[l]} />
                  ))}
                </View>
              ) : null}

              {/* Group membership (P4-3 / B4) — read-only here; add/remove/
                  pause lives on Profile's group management module. */}
              {groups.length > 0 ? (
                <Text
                  variant="bodySm"
                  color={theme.colors.textMuted}
                  style={{ marginTop: theme.spacing[3] }}
                >
                  In{' '}
                  {groups
                    .map((g) => `${g.title}${g.paused ? ' (paused)' : ''}`)
                    .join(', ')}
                </Text>
              ) : null}

              {/* Hero — outcome wins when both faces exist (v0.4 rule); a
                  behavior-only benchmark promotes its own rhythm instead. */}
              {lens.hero === 'outcome' && lens.outcome ? (
                <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[1] }}>
                  <Text variant="label" color={theme.colors.textSecondary}>
                    Outcome
                  </Text>
                  <Text variant="dataLg">{outcomeLine(lens.outcome, weightUnit)}</Text>
                </View>
              ) : null}

              {/* Behavior — the rhythm you own, beneath the outcome hero as
                  consistency context, or promoted to the hero slot itself. */}
              {benchmark.behavior && lens.behavior ? (
                <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[1] }}>
                  <Text variant="label" color={theme.colors.textSecondary}>
                    Behavior
                  </Text>
                  <Text variant={lens.hero === 'outcome' ? 'dataSm' : 'dataLg'}>
                    {behaviorLine(lens.behavior)}
                  </Text>
                </View>
              ) : null}

              {/* Outcome beneath, when behavior is the hero and an outcome
                  face still exists (dual-face, behavior-promoted case). */}
              {lens.hero === 'behavior' && lens.outcome ? (
                <View style={{ marginTop: theme.spacing[4], gap: theme.spacing[1] }}>
                  <Text variant="label" color={theme.colors.textSecondary}>
                    Outcome
                  </Text>
                  <Text variant="dataSm" color={theme.colors.textSecondary}>
                    {outcomeLine(lens.outcome, weightUnit)}
                  </Text>
                </View>
              ) : null}

              {/* Face history — the rhythm bars + current-window day grid,
                  identical under every type/list decision. */}
              {lens.windowCounts && benchmark.behavior ? (
                <View style={{ marginTop: theme.spacing[6] }}>
                  <BenchmarkRhythm
                    counts={lens.windowCounts}
                    run={lens.run}
                    window={benchmark.behavior.window}
                  />
                  {lens.dayGrid ? (
                    <View style={{ marginTop: theme.spacing[4] }}>
                      <BenchmarkDayGrid days={lens.dayGrid} />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Lifecycle actions */}
              <View style={{ marginTop: theme.spacing[8], gap: theme.spacing[2] }}>
                {benchmark.status === 'active' ? (
                  <>
                    <Button
                      label="Mark done"
                      variant="secondary"
                      onPress={() => setStatus('achieved')}
                      loading={saving}
                    />
                    <Button
                      label="Pause"
                      variant="ghost"
                      onPress={() => setStatus('paused')}
                      loading={saving}
                    />
                  </>
                ) : benchmark.status === 'paused' ? (
                  <Button
                    label="Resume"
                    variant="secondary"
                    onPress={() => setStatus('active')}
                    loading={saving}
                  />
                ) : (
                  <Button
                    label="Reactivate"
                    variant="ghost"
                    onPress={() => setStatus('active')}
                    loading={saving}
                  />
                )}
                <Button label="Edit" variant="ghost" onPress={editBenchmark} />
              </View>
            </>
          ) : (
            // Loading (local SQLite, sub-100ms) — a quiet blank rather than a
            // flash of empty chrome; the sheet is only ever open for an id
            // that resolves, so this window is brief.
            <View style={{ height: 120 }} />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function FaceBadge({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingVertical: theme.spacing[1],
        paddingHorizontal: theme.spacing[2],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text variant="label" color={theme.colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}
