/**
 * skySegmentStats.ts — derived stats over a SkyBlock's segments, shared by the
 * sky logging surface's display and the USHPA ledger adapter.
 *
 * Parakiting's honest split (sky-research-track-b.md §5 resolved flag 3):
 * session duration and airtime are shown as two SEPARATE numbers, never
 * conflated — ground-kiting time is active practice, not a pause, but it
 * isn't flight either.
 */
import type { GeoPoint } from '@core/observation';
import type { SkySegment } from '@core/observation';

function segmentDurationSec(track: GeoPoint[], seg: Pick<SkySegment, 'startIdx' | 'endIdx'>): number {
  return track[seg.endIdx].tsSec - track[seg.startIdx].tsSec;
}

/** Sum of every 'air' segment's duration. 0 (a legitimate measured zero, not
 * an absence) when there are no air segments — the track exists, it's just
 * all ground. */
export function totalAirtimeSec(track: GeoPoint[], segments: SkySegment[]): number {
  return segments
    .filter((s) => s.kind === 'air')
    .reduce((sum, s) => sum + segmentDurationSec(track, s), 0);
}

export function airSegmentCount(segments: SkySegment[]): number {
  return segments.filter((s) => s.kind === 'air').length;
}

/** Absent (not 0) when there are no air segments — there is no "longest" of
 * an empty set. */
export function longestAirSegmentSec(track: GeoPoint[], segments: SkySegment[]): number | undefined {
  const durations = segments.filter((s) => s.kind === 'air').map((s) => segmentDurationSec(track, s));
  return durations.length > 0 ? Math.max(...durations) : undefined;
}
