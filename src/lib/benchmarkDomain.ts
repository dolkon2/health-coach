/**
 * benchmarkDomain.ts — the 2a "grouped-by-domain" list key
 * (benchmarks-templates.md §10.2 — confirmed lean, Dylan 2026-07-11).
 *
 * Keys a benchmark to the resolved dimension's "home turf": the four
 * elements when a session-count dimension names an activity, Body for the
 * Body-dimension outcome metrics, Nutrition for the food-side metrics, and a
 * General catch-all for anything that can't resolve further (a bare
 * "any session" behavior, or a modality-only dimension — several elements
 * share modalities like 'other', so a modality alone can't resolve one
 * honestly). App-layer, not core: it needs the activity registry
 * (src/lib/activity.ts) to map an activity id to its element.
 *
 * A dual-face benchmark groups WHOLE, never split — the behavior face's
 * dimension wins when present (the rhythm you hold is the more concrete
 * "home turf"), else the outcome face's. Composes with benchmarkClassify.ts
 * (@core/benchmarkClassify), which labels each face Compliance/Outcome/Trend
 * for the card badges — domain decides the SECTION, classify decides the
 * BADGE; independent concerns, both per-benchmark-record here (not per-face).
 */
import { activityById, elementOf, ELEMENT_LABELS, ELEMENT_ORDER, type Element } from './activity';
import type { Benchmark, ResolvedDimension } from '@core/benchmark';

export type BenchmarkDomainGroup = { key: string; label: string };

const NUTRITION: BenchmarkDomainGroup = { key: 'nutrition', label: 'Nutrition' };
// Same key as the Body element group (below) — a strength/e1RM goal and a
// calisthenics-session goal read as one domain to the user even though they
// resolve from different dimensions, so both merge into one 'body' section.
const BODY_METRICS: BenchmarkDomainGroup = { key: 'body', label: ELEMENT_LABELS.body };
const GENERAL: BenchmarkDomainGroup = { key: 'general', label: 'General' };

/** Section order for rendering: the four elements, then Nutrition, then the
 *  General catch-all last. Body-metrics groups WITH the Body element — a
 *  strength/e1RM goal and a calisthenics-session goal read as the same
 *  domain to the user, even though they resolve from different dimensions. */
export const BENCHMARK_DOMAIN_ORDER: readonly string[] = [
  ...ELEMENT_ORDER,
  'nutrition',
  'general',
];

function elementGroup(element: Element): BenchmarkDomainGroup {
  if (element === 'body') return { key: 'body', label: ELEMENT_LABELS.body };
  return { key: element, label: ELEMENT_LABELS[element] };
}

function domainForDimension(dim: ResolvedDimension): BenchmarkDomainGroup {
  switch (dim.metric) {
    case 'sessionCount': {
      if (dim.activity) {
        const a = activityById(dim.activity);
        return a ? elementGroup(elementOf(a)) : GENERAL;
      }
      return GENERAL; // bare or modality-only — no single honest element
    }
    case 'bodyweight':
      return elementGroup('body');
    case 'exerciseLoad':
    case 'breathRetention':
    case 'romMeasurement':
    case 'protocolAdherence':
      return BODY_METRICS;
    case 'calories':
    case 'macro':
    case 'loggingConsistency':
    case 'loggingFidelity':
    case 'energyBalance':
      return NUTRITION;
    default:
      return GENERAL;
  }
}

/** The domain a benchmark's card sorts under. */
export function benchmarkDomain(b: Pick<Benchmark, 'behavior' | 'outcome'>): BenchmarkDomainGroup {
  const dim = b.behavior?.dimension ?? b.outcome?.dimension;
  return dim ? domainForDimension(dim) : GENERAL;
}

/** Group + order benchmarks by domain, dropping empty sections. Stable
 *  within a section: caller's own order is preserved (list.tsx sorts pinned
 *  first / createdAt desc before calling this). */
export function groupBenchmarksByDomain<T extends Pick<Benchmark, 'behavior' | 'outcome'>>(
  items: T[]
): Array<{ group: BenchmarkDomainGroup; items: T[] }> {
  const byKey = new Map<string, { group: BenchmarkDomainGroup; items: T[] }>();
  for (const item of items) {
    const group = benchmarkDomain(item);
    const bucket = byKey.get(group.key) ?? { group, items: [] };
    bucket.items.push(item);
    byKey.set(group.key, bucket);
  }
  return BENCHMARK_DOMAIN_ORDER.map((key) => byKey.get(key)).filter(
    (b): b is { group: BenchmarkDomainGroup; items: T[] } => b != null
  );
}
