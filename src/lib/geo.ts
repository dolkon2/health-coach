/**
 * geo.ts — pure geospatial primitives shared by the GPS logging surfaces.
 *
 * Distance, elevation gain, and storage thinning live here so the two ways a
 * route enters the app — a file import (gpxImport.ts) and a live capture
 * (gpsTrack.ts) — compute them the exact same way and can never drift. No React,
 * no platform, no network (matches lib/session.ts): the track is the source of
 * truth and everything derived from it is honest arithmetic on the points.
 */
import type { GeoPoint } from '@core/observation';

export const EARTH_RADIUS_M = 6371000;

/** Above this, a stored path is evenly thinned to ~half the cap. Callers compute
 * stats on the FULL set first; only the stored geometry is thinned. Typical
 * recorded tracks (smart-recording watches, Slopes, a phone at 2 s cadence) are
 * 1–4k points. */
export const MAX_STORED_POINTS = 4000;

/** Great-circle distance between two points, in metres. */
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Hysteresis elevation gain: only counts a climb once it clears the threshold,
 * so GPS elevation jitter doesn't inflate the number. Absent (undefined) when no
 * point carries elevation — never a fabricated 0 (constitution: null ≠ 0). */
export function elevationGainM(points: GeoPoint[], thresholdM = 3): number | undefined {
  let ref: number | null = null;
  let gain = 0;
  let sawEle = false;
  for (const p of points) {
    if (p.eleM == null) continue;
    sawEle = true;
    if (ref === null) {
      ref = p.eleM;
      continue;
    }
    const d = p.eleM - ref;
    if (d >= thresholdM) {
      gain += d;
      ref = p.eleM;
    } else if (d <= -thresholdM) {
      ref = p.eleM;
    }
  }
  return sawEle ? Math.round(gain) : undefined;
}

/** Cumulative along-track distance (m), one entry per point, `out[0] === 0`.
 * The shared prefix sum behind every sliding-window speed calc (topSpeedMS,
 * flightDetector's smoothing) — computed once so distance-over-a-window is an
 * O(1) subtraction instead of a re-summed loop. */
export function cumulativeDistanceM(points: GeoPoint[]): number[] {
  const cum = new Array<number>(points.length).fill(0);
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + haversineM(points[i - 1], points[i]);
  return cum;
}

/** Evenly thin a path to ≤ MAX_STORED_POINTS for storage, always keeping the
 * final point so the trace ends where the activity actually ended. */
export function thinTrack(points: GeoPoint[]): GeoPoint[] {
  if (points.length <= MAX_STORED_POINTS) return points;
  const stride = Math.ceil(points.length / (MAX_STORED_POINTS / 2));
  const out: GeoPoint[] = [];
  for (let i = 0; i < points.length; i += stride) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}
