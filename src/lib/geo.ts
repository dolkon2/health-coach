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
import { haversineM } from '@core/geo';

// The haversine itself moved to core (E3: the conditions clients need it and
// core can't import from the app). Re-exported so every existing call site —
// gpsTrack, gpxImport, splits, elevationProfile — keeps the single copy.
export { EARTH_RADIUS_M, haversineM } from '@core/geo';

/** Above this, a stored path is evenly thinned to ~half the cap. Callers compute
 * stats on the FULL set first; only the stored geometry is thinned. Typical
 * recorded tracks (smart-recording watches, Slopes, a phone at 2 s cadence) are
 * 1–4k points. */
export const MAX_STORED_POINTS = 4000;

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
