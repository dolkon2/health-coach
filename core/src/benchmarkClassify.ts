/**
 * benchmarkClassify.ts — the decision-proof face classifier
 * (benchmarks-templates.md §4, §10.1 option B — the leaned choice).
 *
 * A pure derivation, no schema, no storage: Outcome / Compliance / Trend map
 * one-to-one onto shipped structure (behavior face → Compliance; outcome face
 * with a `target` threshold → Outcome; outcome face direction-only → Trend).
 * Returns PER-FACE labels — a dual-face benchmark is Compliance *and*
 * Outcome/Trend, never forced to pick one primary face. This is the load-
 * bearing prerequisite for 2b's grouping key and any future column backfill;
 * it also keeps benchmarks-templates.md ⚑1 closed by construction — the user
 * still never picks a type anywhere, this only reads back what the faces
 * already say.
 */
import type { Benchmark, BehaviorFace, OutcomeFace } from './benchmark';

export type BenchmarkFaceType = 'compliance' | 'outcome' | 'trend';

/** Display label per face type — the single source both the list (§B3) and
 *  the detail sheet (§B2) render, so a wording change can't drift between them. */
export const BENCHMARK_FACE_LABEL: Record<BenchmarkFaceType, string> = {
  compliance: 'Compliance',
  outcome: 'Outcome',
  trend: 'Trend',
};

/** Every behavior face is Compliance — the rhythm you hold, regardless of
 *  which measure shape (count/magnitude/days/share) it's built from. */
export function classifyBehaviorFace(_face: BehaviorFace): 'compliance' {
  return 'compliance';
}

/** A threshold target makes it Outcome (a number to move toward); direction
 *  only (no target) makes it Trend (a number to watch move). */
export function classifyOutcomeFace(face: OutcomeFace): 'outcome' | 'trend' {
  return face.target != null ? 'outcome' : 'trend';
}

export type BenchmarkClassification = {
  behavior?: 'compliance';
  outcome?: 'outcome' | 'trend';
};

/** Per-face classification of a benchmark. Either key absent when that face
 *  itself is absent — never a fabricated label for a face that isn't there. */
export function classifyBenchmark(b: Pick<Benchmark, 'behavior' | 'outcome'>): BenchmarkClassification {
  return {
    ...(b.behavior ? { behavior: classifyBehaviorFace(b.behavior) } : {}),
    ...(b.outcome ? { outcome: classifyOutcomeFace(b.outcome) } : {}),
  };
}

/** The flat set of labels a benchmark carries — one for behavior-only or
 *  outcome-only, two (distinct) for a dual-face benchmark. Order:
 *  behavior's label first, then outcome's, matching the faces' own order
 *  on the Benchmark type. */
export function benchmarkLabels(b: Pick<Benchmark, 'behavior' | 'outcome'>): BenchmarkFaceType[] {
  const c = classifyBenchmark(b);
  return [c.behavior, c.outcome].filter((x): x is BenchmarkFaceType => x != null);
}
