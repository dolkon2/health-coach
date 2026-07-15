/**
 * benchmarkType.ts — the by-type list key (2b), added alongside 2a
 * (benchmarks-templates.md §10.2 / phase4-session-playbook.md R4, resolved
 * 2026-07-14: "both, via a tab" — this does NOT replace benchmarkDomain.ts's
 * by-domain grouping, it's a second organization mode selected by a tab on
 * the same list container).
 *
 * Buckets by which face(s) a benchmark carries — Behavior-only, Outcome-only,
 * or Both — not by benchmarkClassify.ts's finer per-face Compliance/Outcome/
 * Trend split (that stays the card badge, unchanged by this view). A dual-face
 * benchmark groups whole into "Both", same "never split a record" rule
 * benchmarkDomain.ts uses. Every benchmark has at least one face (the storage
 * boundary enforces it), so there is no fourth "neither" bucket.
 */
import type { Benchmark } from '@core/benchmark';

export type BenchmarkTypeKey = 'behavior' | 'outcome' | 'both';

export type BenchmarkTypeGroup = { key: BenchmarkTypeKey; label: string };

/** The three groups, keyed and ordered for rendering: Behavior, then
 *  Outcome, then Both — the Benchmark type's own face order (behavior before
 *  outcome), dual-face last as the richer/rarer case. A closed, exhaustive
 *  set (unlike benchmarkDomain.ts's open-ended, switch-resolved keys), so a
 *  plain keyed record needs no Map or possibly-undefined lookup. */
export const BENCHMARK_TYPE_GROUPS: Record<BenchmarkTypeKey, BenchmarkTypeGroup> = {
  behavior: { key: 'behavior', label: 'Behavior' },
  outcome: { key: 'outcome', label: 'Outcome' },
  both: { key: 'both', label: 'Both' },
};

export const BENCHMARK_TYPE_ORDER: readonly BenchmarkTypeKey[] = ['behavior', 'outcome', 'both'];

/** The type group a benchmark's card sorts under. */
export function benchmarkTypeGroup(b: Pick<Benchmark, 'behavior' | 'outcome'>): BenchmarkTypeGroup {
  if (b.behavior && b.outcome) return BENCHMARK_TYPE_GROUPS.both;
  if (b.behavior) return BENCHMARK_TYPE_GROUPS.behavior;
  return BENCHMARK_TYPE_GROUPS.outcome;
}

/** Group + order benchmarks by face-type, dropping empty sections. Stable
 *  within a section: caller's own order is preserved (list.tsx sorts pinned
 *  first / createdAt desc before calling this) — same contract as
 *  groupBenchmarksByDomain. */
export function groupBenchmarksByType<T extends Pick<Benchmark, 'behavior' | 'outcome'>>(
  items: T[]
): Array<{ group: BenchmarkTypeGroup; items: T[] }> {
  const byKey: Record<BenchmarkTypeKey, T[]> = { behavior: [], outcome: [], both: [] };
  for (const item of items) {
    byKey[benchmarkTypeGroup(item).key].push(item);
  }
  return BENCHMARK_TYPE_ORDER.filter((key) => byKey[key].length > 0).map((key) => ({
    group: BENCHMARK_TYPE_GROUPS[key],
    items: byKey[key],
  }));
}
