/**
 * splits.ts — per-km / per-mile splits derived from a timed GeoPoint[].
 *
 * Pure sibling of geo.ts / elevationProfile.ts: distance is the same haversine
 * the rest of the app uses, and time comes only from the fix timestamps, so a
 * split's pace can never drift from the reported distance and duration.
 *
 * Honesty (gps-mapping-spec.md, constitution): splits are *absent*, not zero,
 * for an untimed track — a planned GPX route with no <time> has no pace to
 * report, so this returns `null` rather than inventing one (null ≠ 0). A unit
 * boundary that falls mid-segment has its crossing time interpolated within that
 * segment (proportional to distance); the trailing sub-unit stretch is reported
 * as a `partial` split, its pace projected to a full unit for comparison.
 */
import type { GeoPoint } from '@core/observation';
import { haversineM } from './geo';
import { displayToMeters, type DistanceUnit } from './units';

export type Split = {
  index: number; // 1-based split number
  distanceM: number; // a full unit, or the remainder for the trailing partial
  durationSec: number; // clock time to cover this split
  paceSecPerUnit: number; // durationSec projected to a full km/mi (comparable)
  isPartial: boolean; // true for the trailing sub-unit remainder
};

/**
 * Splits for `points` at the given unit, or `null` when the track isn't timed
 * (fewer than two fixes carry a timestamp) or covers no distance.
 */
export function splits(points: GeoPoint[], unit: DistanceUnit): Split[] | null {
  const timed = points.filter((p) => p.tsSec > 0);
  if (timed.length < 2) return null;

  const unitM = displayToMeters(1, unit); // 1000 (km) or 1609.344 (mi)

  // Boundary marks in (cumulative distance, time) space: the start, each unit
  // crossing (time interpolated within the straddling segment), and the end.
  const marks: Array<{ distM: number; tsSec: number }> = [
    { distM: 0, tsSec: timed[0].tsSec },
  ];

  let cumM = 0;
  let nextBoundary = unitM;
  for (let i = 1; i < timed.length; i++) {
    const a = timed[i - 1];
    const b = timed[i];
    const segM = haversineM(a, b);
    const segStart = cumM;
    const segEnd = cumM + segM;
    while (segM > 0 && nextBoundary <= segEnd) {
      const frac = (nextBoundary - segStart) / segM;
      marks.push({ distM: nextBoundary, tsSec: a.tsSec + frac * (b.tsSec - a.tsSec) });
      nextBoundary += unitM;
    }
    cumM = segEnd;
  }

  // Trailing remainder past the last full boundary (> 1 m avoids a float sliver).
  const lastMark = marks[marks.length - 1];
  if (cumM - lastMark.distM > 1) {
    marks.push({ distM: cumM, tsSec: timed[timed.length - 1].tsSec });
  }
  if (marks.length < 2) return null; // no distance covered

  const out: Split[] = [];
  for (let i = 1; i < marks.length; i++) {
    const distanceM = marks[i].distM - marks[i - 1].distM;
    const durationSec = marks[i].tsSec - marks[i - 1].tsSec;
    out.push({
      index: i,
      distanceM,
      durationSec,
      paceSecPerUnit: distanceM > 0 ? (durationSec * unitM) / distanceM : 0,
      isPartial: distanceM < unitM - 0.5,
    });
  }
  return out;
}
