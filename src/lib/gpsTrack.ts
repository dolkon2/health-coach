/**
 * gpsTrack.ts — turn a live-captured GeoPoint[] into the stats the GPS logging
 * surface stores. The in-app counterpart to gpxImport.ts (a file import): both
 * lean on the same geo primitives (lib/geo.ts) so a recorded route and an
 * imported one are measured identically and can never drift.
 *
 * Honesty rules mirror the import path:
 * - distance is summed haversine over consecutive fixes, on the FULL set, before
 *   the stored geometry is thinned.
 * - duration comes only from the fix timestamps; if they don't span, it's 0, and
 *   the caller leaves the session's duration to the user rather than fabricating.
 * - elevation gain uses the same hysteresis filter; absent when no fix has one.
 *
 * Pass 1 records a single continuous span (start → stop, no pause), so every
 * consecutive pair counts. Pause/resume — which would split segments the way a
 * GPX <trkseg> does — is a Pass 2 refinement (planning/gps-mapping-spec.md).
 */
import type { GeoPoint } from '@core/observation';
import { elevationGainM, haversineM, thinTrack } from './geo';

export type TrackSummary = {
  points: GeoPoint[]; // thinned for storage (the stats below are full-resolution)
  pointCount: number; // fixes captured, before thinning
  distanceM: number; // haversine over consecutive fixes
  elevationGainM?: number; // 3 m hysteresis; absent if no fix carried altitude
  durationSec: number; // last fix − first; 0 when the fixes don't span time
  startTime?: string; // ISO of the first fix — becomes the session's occurredAt
};

export function summarizeTrack(points: GeoPoint[]): TrackSummary {
  let distanceM = 0;
  for (let i = 1; i < points.length; i++) distanceM += haversineM(points[i - 1], points[i]);

  const timed = points.filter((p) => p.tsSec > 0);
  const startSec = timed.length > 0 ? timed[0].tsSec : null;
  const endSec = timed.length > 0 ? timed[timed.length - 1].tsSec : null;
  const durationSec =
    startSec !== null && endSec !== null && endSec > startSec ? endSec - startSec : 0;

  const gain = elevationGainM(points);

  return {
    points: thinTrack(points),
    pointCount: points.length,
    distanceM: Math.round(distanceM),
    ...(gain !== undefined ? { elevationGainM: gain } : {}),
    durationSec,
    ...(startSec !== null ? { startTime: new Date(startSec * 1000).toISOString() } : {}),
  };
}
