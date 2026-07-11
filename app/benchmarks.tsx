/**
 * Benchmarks — the goal layer's management surface (Phase 5 Pass 2; List
 * container v2 per benchmarks-templates.md B3/§10.2 — Dylan's confirmed lean,
 * 2026-07-11: grouped by domain (2a) with per-face type badges from the
 * decision-proof classifier, never a user-picked type).
 *
 * Reached from Home's "Benchmarks →" and Training's Progress & tools. Active
 * benchmarks group by domain (Earth/Water/Sky/Body/Nutrition/General — the
 * resolved dimension's "home turf", benchmarkDomain.ts); each card carries
 * Compliance/Outcome/Trend badges (benchmarkClassify.ts) as metadata, never
 * structure — a dual-face benchmark stays whole in one section. Search
 * appears only past the same ≥10-item clutter threshold Training's library
 * uses. Tap opens the detail sheet (B2) rather than jumping straight to
 * Structured entry; "+ New" still pushes /edit-benchmark, the only door to
 * creation this surface owns (benchmarks are otherwise created contextually).
 * Archived benchmarks stay a flat muted section at the bottom, ungrouped —
 * the domain lens is for what's active and being worked, same as before.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, Button, Field, BenchmarkDetailSheet } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useExpenditure } from '@/hooks/useExpenditure';
import { listBenchmarks } from '@/storage/benchmarks';
import { summarizeBenchmark } from '@/lib/benchmarkForm';
import { groupBenchmarksByDomain } from '@/lib/benchmarkDomain';
import { benchmarkLabels, BENCHMARK_FACE_LABEL } from '@core/benchmarkClassify';
import type { WeightUnit } from '@/lib/units';
import type { Benchmark } from '@core/benchmark';

const SEARCH_THRESHOLD = 10;

export default function BenchmarksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const [benchmarks, setBenchmarks] = useState<Benchmark[] | null>(null);
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  // The detail sheet needs these for its outcome faces; this screen has no
  // other use for them, but the sheet no longer fetches its own (BenchmarkDetailSheet.tsx).
  const { points: trendPoints } = useWeightTrend();
  const { measured } = useExpenditure(trendPoints);

  const reload = useCallback(async () => {
    setBenchmarks(await listBenchmarks());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const all = benchmarks ?? [];
  const isEmpty = benchmarks !== null && all.length === 0;
  const showSearch = all.length >= SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((b) => b.title.toLowerCase().includes(q));
  }, [all, search]);

  const active = useMemo(
    () =>
      [...filtered.filter((b) => b.status === 'active')].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [filtered]
  );
  const archived = useMemo(
    () =>
      [...filtered.filter((b) => b.status !== 'active')].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      ),
    [filtered]
  );

  // The pluggable group-by wrapper: 2a today, swappable for a 2b (by-type)
  // grouping function later without touching the card/search/states below.
  const groupedActive = useMemo(() => groupBenchmarksByDomain(active), [active]);

  function openBenchmark(id: string) {
    setDetailId(id);
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
          <Text variant="label" color={theme.colors.accent}>
            Benchmarks
          </Text>
          <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
            Working toward
          </Text>
        </View>
        <Button label="+ New" variant="secondary" onPress={() => router.push('/edit-benchmark')} />
      </View>

      <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[3] }}>
        Goals the app can mirror — a rhythm to keep, a number to move, or both. Tap to open.
      </Text>

      {showSearch ? (
        <Field
          value={search}
          onChangeText={setSearch}
          placeholder="Search benchmarks"
          keyboardType="default"
          style={{ marginTop: theme.spacing[4] }}
        />
      ) : null}

      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
        {benchmarks === null ? null : isEmpty ? (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              No benchmarks yet. Tap "+ New" to set what you're working toward.
            </Text>
          </Card>
        ) : active.length === 0 && archived.length === 0 ? (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              No benchmarks match your search.
            </Text>
          </Card>
        ) : (
          <>
            {groupedActive.map(({ group, items }) => (
              <View key={group.key} style={{ gap: theme.spacing[3] }}>
                <Text variant="label" color={theme.colors.textMuted}>
                  {group.label}
                </Text>
                {items.map((b) => (
                  <BenchmarkRow
                    key={b.id}
                    benchmark={b}
                    weightUnit={weightUnit}
                    onPress={() => openBenchmark(b.id)}
                  />
                ))}
              </View>
            ))}

            {archived.length > 0 ? (
              <View style={{ gap: theme.spacing[3], marginTop: theme.spacing[2] }}>
                <Text variant="label" color={theme.colors.textMuted}>
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
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={{ height: theme.spacing[10] }} />

      <BenchmarkDetailSheet
        benchmarkId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={reload}
        trendPoints={trendPoints}
        measured={measured}
      />
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
  const labels = benchmarkLabels(benchmark);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${benchmark.title}`}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: theme.spacing[1] }}>
            <Text variant="body" color={muted ? theme.colors.textMuted : theme.colors.text}>
              {benchmark.title}
            </Text>
            <Text variant="bodySm" color={theme.colors.textMuted}>
              {summarizeBenchmark(benchmark, weightUnit)}
            </Text>
            {labels.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: theme.spacing[1], marginTop: theme.spacing[1] }}>
                {labels.map((l) => (
                  <Text key={l} variant="label" color={theme.colors.textMuted}>
                    {BENCHMARK_FACE_LABEL[l]}
                    {l !== labels[labels.length - 1] ? ' ·' : ''}
                  </Text>
                ))}
              </View>
            ) : null}
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
