/**
 * flightStats.ts — pure derived stats over a flight track (GeoPoint[]), shared
 * by all Sky activities (paraglide, hang glide, speedfly).
 *
 * Vertical rates and groundspeed are smoothed over a sliding time window:
 * point-to-point GPS deltas are noise (a 1 s altitude blip reads as ±10 m/s),
 * so a rate is only reported when at least `windowSec` of real clock time
 * supports it — vario-style integration, not instantaneous deltas.
 *
 * Honesty: every stat is absent (undefined), never 0, when the track can't
 * support it — no elevations, no timestamps, or a total time spread shorter
 * than the smoothing window. Zero/negative time deltas (out-of-order fixes)
 * are guarded, never divided by.
 */
import type { GeoPoint } from '@core/observation';
import { haversineM } from './geo';

type ElePoint = GeoPoint & { eleM: number };

function withEle(points: GeoPoint[]): ElePoint[] {
  return points.filter((p): p is ElePoint => p.eleM != null);
}

/** Highest recorded altitude (m); absent when no point carries elevation. */
export function maxAltitudeM(points: GeoPoint[]): number | undefined {
  const ele = withEle(points);
  if (ele.length === 0) return undefined;
  return ele.reduce((max, p) => Math.max(max, p.eleM), -Infinity);
}

/** Lowest recorded altitude (m); absent when no point carries elevation. */
export function minAltitudeM(points: GeoPoint[]): number | undefined {
  const ele = withEle(points);
  if (ele.length === 0) return undefined;
  return ele.reduce((min, p) => Math.min(min, p.eleM), Infinity);
}

// Peak vertical rate in the direction `dir` (+1 climb, −1 sink), as a positive
// m/s magnitude, over the smallest sliding windows spanning >= windowSec.
function peakVerticalRateMS(
  points: GeoPoint[],
  windowSec: number,
  dir: 1 | -1
): number | undefined {
  const pts = points.filter((p): p is ElePoint => p.eleM != null && p.tsSec > 0);
  let best: number | undefined;
  let i = 0;
  for (let j = 1; j < pts.length; j++) {
    while (i + 1 < j && pts[j].tsSec - pts[i + 1].tsSec >= windowSec) i++;
    const dt = pts[j].tsSec - pts[i].tsSec;
    if (dt <= 0 || dt < windowSec) continue;
    const rate = ((pts[j].eleM - pts[i].eleM) / dt) * dir;
    if (rate > 0 && (best === undefined || rate > best)) best = rate;
  }
  return best;
}

/**
 * Peak climb rate (m/s), smoothed over a sliding window of at least
 * `windowSec`. Absent when the track never climbs within a window, or can't
 * support one (no elevations, no timestamps, spread < windowSec).
 */
export function maxClimbRateMS(points: GeoPoint[], windowSec = 8): number | undefined {
  return peakVerticalRateMS(points, windowSec, 1);
}

/**
 * Peak sink rate as a positive m/s magnitude, smoothed like maxClimbRateMS.
 * Absent when the track never descends within a window.
 */
export function maxSinkRateMS(points: GeoPoint[], windowSec = 8): number | undefined {
  return peakVerticalRateMS(points, windowSec, -1);
}

/**
 * Peak groundspeed (m/s): along-track distance over a sliding window of at
 * least `windowSec` — raw point-to-point GPS speeds spike on jitter. Absent
 * when fewer than two fixes are timed or the spread is shorter than the window.
 */
export function topSpeedMS(points: GeoPoint[], windowSec = 4): number | undefined {
  const pts = points.filter((p) => p.tsSec > 0);
  if (pts.length < 2) return undefined;
  const cumM: number[] = [0];
  for (let j = 1; j < pts.length; j++) cumM.push(cumM[j - 1] + haversineM(pts[j - 1], pts[j]));
  let best: number | undefined;
  let i = 0;
  for (let j = 1; j < pts.length; j++) {
    while (i + 1 < j && pts[j].tsSec - pts[i + 1].tsSec >= windowSec) i++;
    const dt = pts[j].tsSec - pts[i].tsSec;
    if (dt <= 0 || dt < windowSec) continue;
    const v = (cumM[j] - cumM[i]) / dt;
    if (best === undefined || v > best) best = v;
  }
  return best;
}

/**
 * Net first-to-last elevation change (m), signed — a speedfly run reads
 * negative. Absent unless at least two points carry elevation.
 */
export function elevationDeltaM(points: GeoPoint[]): number | undefined {
  const ele = withEle(points);
  if (ele.length < 2) return undefined;
  return Math.round(ele[ele.length - 1].eleM - ele[0].eleM);
}

/**
 * Largest peak-to-trough cumulative descent (m) — the speedfly "elevation
 * drop": max drawdown of the altitude series. 0 for a track that only climbs
 * (an honest measured zero); absent unless at least two points carry elevation.
 */
export function maxDescentM(points: GeoPoint[]): number | undefined {
  const ele = withEle(points);
  if (ele.length < 2) return undefined;
  let peak = -Infinity;
  let best = 0;
  for (const p of ele) {
    if (p.eleM > peak) peak = p.eleM;
    if (peak - p.eleM > best) best = peak - p.eleM;
  }
  return Math.round(best);
}
