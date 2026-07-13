/**
 * benchmarkGroup.ts — a user-built grouping of benchmarks (v0.5, Phase 4 B4).
 *
 * Groups ship empty; membership is a many-to-many relational fact
 * (src/storage/benchmarkGroups.ts), never carried on this type. `paused` is
 * the group's own toggle: pausing drops its members from Home's glance and
 * Reflect's browse lens without touching any member benchmark's own
 * status/pinned lifecycle (benchmarks-templates.md §5, "Group pause → members
 * leave Home glance and Reflect framing; nothing archived, no history
 * closed"). No celebration on resume — this is bookkeeping, not a streak.
 */
import type { ISOInstant } from './observation';

export type BenchmarkGroup = {
  id: string;
  createdAt: ISOInstant;
  title: string; // user's own words, same register as Benchmark.title
  paused: boolean;
};
