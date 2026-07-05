/**
 * elevationProfile.ts — derive an elevation-vs-distance series from a GeoPoint[].
 *
 * A pure companion to geo.ts / gpsTrack.ts: it reuses the same haversine so the
 * profile's x-axis (cumulative distance) can never drift from the distance the
 * rest of the app reports. No React, no platform, no network — the track is the
 * source of truth and the profile is honest arithmetic on it.
 *
 * Honesty (gps-mapping-spec.md, constitution): elevation is *absent*, not zero,
 * when the track carries none — a GPX planned route or a phone with no
 * barometric altimeter yields `null`, never a fabricated flat line. Distance
 * accumulates across every fix (so the x-axis is the real distance travelled),
 * but a sample is emitted only where a fix actually has `eleM`.
 */
import type { GeoPoint } from '@core/observation';
import { haversineM } from './geo';

export type ElevationSample = {
  distM: number; // cumulative distance from the first fix, in metres
  eleM: number; // elevation at this fix
};

/**
 * Cumulative-distance-vs-elevation samples for the points that carry elevation.
 * Returns `null` (absent) when fewer than two fixes have `eleM` — there is
 * nothing to draw, and we never invent a value (null ≠ 0). The returned
 * distances span the full path, not just the elevation-bearing stretch.
 */
export function elevationProfile(points: GeoPoint[]): ElevationSample[] | null {
  if (points.length < 2) return null;
  const samples: ElevationSample[] = [];
  let cumM = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) cumM += haversineM(points[i - 1], points[i]);
    const eleM = points[i].eleM;
    if (eleM != null) samples.push({ distM: cumM, eleM });
  }
  return samples.length >= 2 ? samples : null;
}
