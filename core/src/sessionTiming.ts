/**
 * sessionTiming.ts — derive a gym session's duration from its set timestamps.
 *
 * Duration is not declared; it falls out of structure (planning/phase-4-training-
 * plan.md, Pass 3). A session lived set-by-set carries a `completedAt` on each set,
 * and the span between the first and last is the working duration. A session
 * batch-entered after the fact has clustered (or absent) timestamps — the span
 * doesn't reflect real elapsed time, so we report the duration as *unknown* (null)
 * with low fidelity rather than fabricate a tiny number. Constitution: null ≠ 0,
 * and fidelity is honest about how the data was captured.
 */
import type { ISOInstant } from './observation';

export type DerivedDuration = {
  /** Whole minutes between first and last completed set, or null when unknowable. */
  durationMin: number | null;
  /** 0..1 capture precision implied by how the sets were timestamped. */
  fidelity: number;
};

/**
 * Below this span the timestamps are "clustered" — entered in a burst, not lived —
 * so the duration is treated as unknown. Two minutes is comfortably longer than the
 * few seconds a batch entry takes, and shorter than any real working set sequence.
 */
export const CLUSTER_THRESHOLD_MIN = 2;

const LIVE_FIDELITY = 0.95; // a real lived spread — the most honest gym capture
const BATCH_FIDELITY = 0.6; // clustered or too few stamps — logged after the fact

/** Derive duration + fidelity from the `completedAt` spread of a set list. */
export function deriveSessionDuration(
  sets: ReadonlyArray<{ completedAt?: ISOInstant }>
): DerivedDuration {
  const stampsMs = sets
    .map((s) => s.completedAt)
    .filter((t): t is ISOInstant => typeof t === 'string' && t.length > 0)
    .map((t) => Date.parse(t))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);

  // Need two real stamps to measure a span at all.
  if (stampsMs.length < 2) return { durationMin: null, fidelity: BATCH_FIDELITY };

  const spanMin = (stampsMs[stampsMs.length - 1] - stampsMs[0]) / 60000;

  if (spanMin < CLUSTER_THRESHOLD_MIN) {
    return { durationMin: null, fidelity: BATCH_FIDELITY };
  }

  // A lived spread. High but not perfect — it omits warm-up/setup before set one.
  return { durationMin: Math.round(spanMin), fidelity: LIVE_FIDELITY };
}
