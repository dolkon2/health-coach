/**
 * mapGeom.ts — pure geometry helpers for map rendering (route direction
 * arrows). No native deps, same posture as geo.ts (core) — unit-tested
 * without MapLibre.
 */
import type { LatLng } from '@core/geo';

/** Initial bearing from `a` to `b`, in degrees clockwise from north. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * toDeg + 360) % 360;
}

export type DirectionMark = { point: LatLng; bearingDeg: number };

/**
 * A handful of evenly-spaced points along `points`, each carrying the
 * bearing toward the next point — a route's "direction arrows" (map-tab.md
 * REFRAME AMENDMENT). Fewer than 2 points, or `count &lt;= 0`, yields none —
 * there's nothing honest to point.
 */
export function directionMarks(points: LatLng[], count: number): DirectionMark[] {
  if (points.length < 2 || count <= 0) return [];
  const lastIdx = points.length - 2; // last index that still has a "next" point
  const seen = new Set<number>();
  const marks: DirectionMark[] = [];
  for (let i = 1; i <= count; i++) {
    const raw = Math.round((i / (count + 1)) * (points.length - 1));
    const idx = Math.min(lastIdx, Math.max(0, raw));
    if (seen.has(idx)) continue;
    seen.add(idx);
    marks.push({ point: points[idx], bearingDeg: bearingDeg(points[idx], points[idx + 1]) });
  }
  return marks;
}
