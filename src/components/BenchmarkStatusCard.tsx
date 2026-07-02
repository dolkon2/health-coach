/**
 * BenchmarkStatusCard — one pinned benchmark, at a glance (Phase 5 Pass 3).
 *
 * Up to two lines, one per face, behavior first: the behavior line is the
 * number the user OWNS this window ("2/4 this week" — a factual count, no
 * flame, no celebration, resets without drama); the outcome line is what the
 * mirror OBSERVES ("82.4 kg · ↓ 0.6 kg over 14 days"), reported plainly even
 * when it moves against the wish. No green/red — the palette never grades
 * (benchmarks-spec.md v0.4, "Three surfaces" / "Consistency counters").
 * Tap opens the benchmarks list — the managing surface.
 */
import { Pressable } from 'react-native';
import { Card } from './Card';
import { Text } from './Text';
import { useTheme } from '@/theme';
import {
  behaviorLine,
  outcomeLine,
  type BehaviorStatus,
  type OutcomeStatus,
} from '@/lib/benchmarkStatus';
import type { WeightUnit } from '@/lib/units';
import type { Benchmark } from '@core/benchmark';

export type BenchmarkStatusCardProps = {
  benchmark: Benchmark;
  behavior: BehaviorStatus | null;
  outcome: OutcomeStatus | null;
  weightUnit: WeightUnit;
  onPress: () => void;
};

export function BenchmarkStatusCard({
  benchmark,
  behavior,
  outcome,
  weightUnit,
  onPress,
}: BenchmarkStatusCardProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Benchmark: ${benchmark.title}`}
    >
      <Card style={{ gap: theme.spacing[1] }}>
        <Text variant="label" color={theme.colors.textSecondary}>
          {benchmark.title}
        </Text>
        {behavior ? <Text variant="data">{behaviorLine(behavior)}</Text> : null}
        {outcome ? (
          <Text
            variant={behavior ? 'dataSm' : 'data'}
            color={behavior ? theme.colors.textSecondary : theme.colors.text}
          >
            {outcomeLine(outcome, weightUnit)}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
