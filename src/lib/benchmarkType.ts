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

const BEHAVIOR: BenchmarkTypeGroup = { key: 'behavior', label: 'Behavior' };
const OUTCOME: BenchmarkTypeGroup = { key: 'outcome', label: 'Outcome' };
const BOTH: BenchmarkTypeGroup = { key: 'both', label: 'Both' };

/** Section order for rendering: Behavior, then Outcome, then Both — the
 *  Benchmark type's own face order (behavior before outcome), dual-face last
 *  as the richer/rarer case. */
export const BENCHMARK_TYPE_ORDER: readonly BenchmarkTypeKey[] = ['behavior', 'outcome', 'both'];

/** The type group a benchmark's card sorts under. */
export function benchmarkTypeGroup(b: Pick<Benchmark, 'behavior' | 'outcome'>): BenchmarkTypeGroup {
  if (b.behavior && b.outcome) return BOTH;
  if (b.behavior) return BEHAVIOR;
  return OUTCOME;
}

/** Group + order benchmarks by face-type, dropping empty sections. Stable
 *  within a section: caller's own order is preserved (list.tsx sorts pinned
 *  first / createdAt desc before calling this) — same contract as
 *  groupBenchmarksByDomain. */
export function groupBenchmarksByType<T extends Pick<Benchmark, 'behavior' | 'outcome'>>(
  items: T[]
): Array<{ group: BenchmarkTypeGroup; items: T[] }> {
  const byKey = new Map<BenchmarkTypeKey, { group: BenchmarkTypeGroup; items: T[] }>();
  for (const item of items) {
    const group = benchmarkTypeGroup(item);
    const bucket = byKey.get(group.key) ?? { group, items: [] };
    bucket.items.push(item);
    byKey.set(group.key, bucket);
  }
  return BENCHMARK_TYPE_ORDER.map((key) => byKey.get(key)).filter(
    (b): b is { group: BenchmarkTypeGroup; items: T[] } => b != null
  );
}
