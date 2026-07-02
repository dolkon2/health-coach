/**
 * Benchmarks — the goal layer's home (Phase 5 Pass 2).
 *
 * Reached from the Training tab. Lists the benchmarks you're working toward; tap
 * a row to edit or archive it. "+ New" pushes /edit-benchmark (Structured entry).
 * Ships empty — the app never authors a goal (constitution: goals are yours).
 * Archiving sets something down quietly: archived benchmarks drop to a muted
 * section, history preserved, retrievable. Today (Pass 3) surfaces the pinned
 * active ones as status cards.
 */
import { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, Button } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { listBenchmarks } from '@/storage/benchmarks';
import { summarizeBenchmark } from '@/lib/benchmarkForm';
import type { WeightUnit } from '@/lib/units';
import type { Benchmark } from '@core/benchmark';

export default function BenchmarksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const [benchmarks, setBenchmarks] = useState<Benchmark[] | null>(null);

  const reload = useCallback(async () => {
    setBenchmarks(await listBenchmarks());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const active = benchmarks?.filter((b) => b.status === 'active') ?? [];
  const archived = benchmarks?.filter((b) => b.status !== 'active') ?? [];
  const isEmpty = benchmarks !== null && active.length === 0 && archived.length === 0;

  function openBenchmark(id: string) {
    router.push({ pathname: '/edit-benchmark', params: { benchmarkId: id } });
  }

  return (
    <Screen scroll>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="label" color={theme.colors.sandstone}>
            Benchmarks
          </Text>
          <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
            Working toward
          </Text>
        </View>
        <Button label="+ New" variant="secondary" onPress={() => router.push('/edit-benchmark')} />
      </View>

      <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[3] }}>
        Goals the app can mirror — a rhythm to keep, a number to move, or both. Tap to edit.
      </Text>

      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
        {benchmarks === null ? null : isEmpty ? (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              No benchmarks yet. Tap "+ New" to set what you're working toward.
            </Text>
          </Card>
        ) : (
          <>
            {active.map((b) => (
              <BenchmarkRow
                key={b.id}
                benchmark={b}
                weightUnit={weightUnit}
                onPress={() => openBenchmark(b.id)}
              />
            ))}

            {archived.length > 0 ? (
              <>
                <Text
                  variant="label"
                  color={theme.colors.textMuted}
                  style={{ marginTop: theme.spacing[4] }}
                >
                  Archived
                </Text>
                {archived.map((b) => (
                  <BenchmarkRow
                    key={b.id}
                    benchmark={b}
                    weightUnit={weightUnit}
                    muted
                    onPress={() => openBenchmark(b.id)}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}

function BenchmarkRow({
  benchmark,
  weightUnit,
  muted,
  onPress,
}: {
  benchmark: Benchmark;
  weightUnit: WeightUnit;
  muted?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  // The tag explains why a benchmark isn't on Today: archived, done, or unpinned.
  const tag =
    benchmark.status === 'achieved'
      ? 'done'
      : benchmark.status !== 'active'
        ? 'archived'
        : !benchmark.pinned
          ? 'not on Today'
          : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Edit ${benchmark.title}`}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: theme.spacing[1] }}>
            <Text variant="body" color={muted ? theme.colors.textMuted : theme.colors.text}>
              {benchmark.title}
            </Text>
            <Text variant="bodySm" color={theme.colors.textMuted}>
              {summarizeBenchmark(benchmark, weightUnit)}
            </Text>
          </View>
          {tag ? (
            <Text variant="dataSm" color={theme.colors.textMuted}>
              {tag}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
