/**
 * swim.ts — pure derivations over per-length swim data (contract §6).
 *
 * A wearable hands us facts: one `SwimLength` per pool length, offset-timed from
 * the session start. Everything a swimmer actually talks about — sets, SWOLF,
 * pace per 100 — falls out of those facts at read time and is NEVER stored
 * (same posture as sessionTiming.ts / splits.ts: derive, don't declare).
 *
 * Honesty (constitution): null ≠ 0 throughout. A length without a stroke count
 * has no SWOLF (never fabricate one); lengths without distance simply don't
 * contribute to pace or set distance, and a set with NO measured distance omits
 * `distanceM` rather than reporting 0.
 */
import type { SwimLength, SwimStroke } from './observation';

/**
 * Inter-length gap below which consecutive lengths are one continuous set.
 * Open-turn rest at the wall is a few seconds; a real between-sets rest is
 * rarely under 15. ⚑ Judgment call — tune with real pool data.
 */
export const DEFAULT_REST_GAP_S = 15;

/** A contiguous block of lengths — derived at read time, never stored. */
export type SwimSet = {
  lengths: SwimLength[];
  /** Offset of the first length from session start. */
  startSec: number;
  /** Span from first length start to last length end, INCLUDING intra-set gaps. */
  durationS: number;
  /**
   * Sum of the lengths that carry a measured distance. Omitted (not 0) when no
   * length in the set has one — null ≠ 0.
   */
  distanceM?: number;
  /** Number of lengths in the set. */
  reps: number;
  /**
   * Most frequent stroke among lengths that report one, ignoring 'unknown'.
   * Ties break toward the stroke seen first. Omitted when nothing is known.
   */
  dominantStroke?: SwimStroke | 'kickboard';
};

/**
 * Cluster lengths into sets: consecutive lengths whose gap
 * (`next.startSec − (prev.startSec + prev.durationS)`) is under `restGapS`
 * belong to the same set. Input is sorted by `startSec` defensively (the
 * caller's array is not mutated).
 */
export function clusterSets(
  lengths: SwimLength[],
  restGapS: number = DEFAULT_REST_GAP_S
): SwimSet[] {
  const sorted = [...lengths].sort((a, b) => a.startSec - b.startSec);
  if (sorted.length === 0) return [];

  const groups: SwimLength[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const gapS = sorted[i].startSec - (prev.startSec + prev.durationS);
    if (gapS < restGapS) {
      groups[groups.length - 1].push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }

  return groups.map((group) => {
    const first = group[0];
    const last = group[group.length - 1];

    // Distance: sum only what was measured; a set with no measured lengths has
    // no distance at all (omit, never 0).
    const measured = group.filter((l) => l.distanceM != null);
    const distanceM =
      measured.length > 0
        ? measured.reduce((sum, l) => sum + (l.distanceM as number), 0)
        : undefined;

    const dominant = dominantStroke(group);

    return {
      lengths: group,
      startSec: first.startSec,
      durationS: last.startSec + last.durationS - first.startSec,
      ...(distanceM !== undefined ? { distanceM } : {}),
      reps: group.length,
      ...(dominant !== undefined ? { dominantStroke: dominant } : {}),
    };
  });
}

/** Most frequent non-'unknown' stroke in the group; ties → first seen. */
function dominantStroke(group: SwimLength[]): SwimStroke | 'kickboard' | undefined {
  const counts = new Map<SwimStroke | 'kickboard', number>();
  for (const l of group) {
    if (l.stroke === undefined || l.stroke === 'unknown') continue;
    counts.set(l.stroke, (counts.get(l.stroke) ?? 0) + 1);
  }
  let best: SwimStroke | 'kickboard' | undefined;
  let bestCount = 0;
  for (const [stroke, count] of counts) {
    // Strict > keeps the first-seen stroke on ties (Map preserves insertion order).
    if (count > bestCount) {
      best = stroke;
      bestCount = count;
    }
  }
  return best;
}

/**
 * SWOLF for one length: seconds + strokes. A length without a stroke count has
 * no SWOLF — null, never a fabricated number (null ≠ 0).
 */
export function swolfPerLength(l: SwimLength): number | null {
  if (l.strokes == null) return null;
  return l.durationS + l.strokes;
}

/**
 * Pace in seconds per 100 m over the lengths that carry a measured distance,
 * optionally restricted to one stroke. Lengths without distance contribute
 * nothing; when none have distance the pace is null (never a guess).
 *
 * 'kickboard' lengths are EXCLUDED unless explicitly filtered for — kick pace
 * isn't swim pace, and blending them would flatter nothing and distort
 * everything. When a stroke filter is given, lengths with no stroke recorded
 * don't match it.
 */
export function pacePer100(
  lengths: SwimLength[],
  stroke?: SwimStroke | 'kickboard' | 'unknown'
): number | null {
  const eligible = lengths.filter((l) => {
    if (l.distanceM == null || l.distanceM <= 0) return false;
    if (stroke !== undefined) return l.stroke === stroke;
    return l.stroke !== 'kickboard';
  });
  if (eligible.length === 0) return null;

  const totalDistM = eligible.reduce((sum, l) => sum + (l.distanceM as number), 0);
  if (totalDistM <= 0) return null;
  const totalDurS = eligible.reduce((sum, l) => sum + l.durationS, 0);

  return (totalDurS / totalDistM) * 100;
}
