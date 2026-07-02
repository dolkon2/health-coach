/**
 * gpxImport.ts — client-side GPX parsing for the file-import path
 * (wearable-ingestion-spec.md Addendum, Layer 2: gate-free route enrichment).
 *
 * A GPX exported from Garmin Connect, Slopes, Gaia, AllTrails, CalTopo, etc. is
 * parsed entirely on-device into the stats the GPS logging surface needs plus the
 * route geometry (`GeoPoint[]` — the schema's existing `gpsPath` field). Nothing
 * touches the network; the file is the source of truth and everything derived
 * from it is frozen at import time.
 *
 * Honesty rules:
 * - distance/elevation/duration are computed from the FULL point set, before any
 *   downsampling for storage.
 * - per-<trkseg> distance (a segment is a continuous recording span — pauses
 *   split segments, and the gap between them is not travelled distance).
 * - a timestampless file (a planned route rather than a recorded activity) yields
 *   no duration and no start time — absent, never fabricated (null ≠ 0).
 */
import { XMLParser } from 'fast-xml-parser';
import type { GeoPoint } from '@core/observation';

export type GpxImportResult = {
  name?: string; // <trk><name> or <metadata><name>
  points: GeoPoint[]; // flattened across segments; downsampled if huge (see MAX_STORED_POINTS)
  pointCount: number; // original count, before downsampling
  distanceM: number; // haversine, summed per segment, full-resolution points
  elevationGainM?: number; // 3 m hysteresis accumulator; absent if no <ele>
  durationMin?: number; // last valid <time> − first; absent if untimed
  startTime?: string; // ISO of the first timestamped point
};

/** Above this, the stored path is evenly thinned to ~half the cap. Stats are
 * computed first, on everything; only the stored geometry is thinned. Typical
 * recorded GPX (smart-recording watches, Slopes) is 1–4k points. */
const MAX_STORED_POINTS = 4000;

const EARTH_RADIUS_M = 6371000;

function haversineM(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

type RawPt = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parsePoint(pt: RawPt): GeoPoint | null {
  const lat = Number(pt.lat);
  const lng = Number(pt.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const p: GeoPoint = { lat, lng, tsSec: 0 };
  const ele = Number(pt.ele);
  if (pt.ele != null && Number.isFinite(ele)) p.eleM = ele;
  if (typeof pt.time === 'string') {
    const ms = Date.parse(pt.time);
    if (Number.isFinite(ms)) p.tsSec = Math.floor(ms / 1000);
  }
  return p;
}

/** Hysteresis elevation gain: only counts climbs once they clear the threshold,
 * so GPS elevation jitter doesn't inflate the number. */
function elevationGain(points: GeoPoint[], thresholdM = 3): number | undefined {
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

function thin(points: GeoPoint[]): GeoPoint[] {
  if (points.length <= MAX_STORED_POINTS) return points;
  const stride = Math.ceil(points.length / (MAX_STORED_POINTS / 2));
  const out: GeoPoint[] = [];
  for (let i = 0; i < points.length; i += stride) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/**
 * Parses a GPX document. Throws with a user-facing message when the file isn't
 * GPX or contains no usable points. Prefers recorded tracks (<trk>); falls back
 * to a planned route (<rte>) so a routes-only file still imports as geometry.
 */
export function parseGpx(xml: string): GpxImportResult {
  let doc: Record<string, unknown>;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      isArray: (name) => ['trk', 'trkseg', 'trkpt', 'rte', 'rtept'].includes(name),
      parseTagValue: false,
      parseAttributeValue: false,
    });
    doc = parser.parse(xml);
  } catch {
    throw new Error('Not a readable GPX file.');
  }

  const gpx = doc?.gpx as Record<string, unknown> | undefined;
  if (!gpx) throw new Error('Not a GPX file.');

  // Segments of full-resolution points; distance never bridges a segment gap.
  const segments: GeoPoint[][] = [];
  let name: string | undefined;

  for (const trk of asArray(gpx.trk as RawPt | RawPt[])) {
    if (name === undefined && typeof trk.name === 'string' && trk.name.trim()) {
      name = trk.name.trim();
    }
    for (const seg of asArray(trk.trkseg as RawPt | RawPt[])) {
      const pts = asArray(seg.trkpt as RawPt | RawPt[])
        .map(parsePoint)
        .filter((p): p is GeoPoint => p !== null);
      if (pts.length > 0) segments.push(pts);
    }
  }

  if (segments.length === 0) {
    for (const rte of asArray(gpx.rte as RawPt | RawPt[])) {
      if (name === undefined && typeof rte.name === 'string' && rte.name.trim()) {
        name = rte.name.trim();
      }
      const pts = asArray(rte.rtept as RawPt | RawPt[])
        .map(parsePoint)
        .filter((p): p is GeoPoint => p !== null);
      if (pts.length > 0) segments.push(pts);
    }
  }

  if (name === undefined) {
    const meta = gpx.metadata as RawPt | undefined;
    if (meta && typeof meta.name === 'string' && meta.name.trim()) name = meta.name.trim();
  }

  const all = segments.flat();
  if (all.length < 2) throw new Error('No track points found in this file.');

  let distanceM = 0;
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) distanceM += haversineM(seg[i - 1], seg[i]);
  }

  const timed = all.filter((p) => p.tsSec > 0);
  const startSec = timed.length > 0 ? timed[0].tsSec : null;
  const endSec = timed.length > 0 ? timed[timed.length - 1].tsSec : null;
  const durationMin =
    startSec !== null && endSec !== null && endSec > startSec
      ? (endSec - startSec) / 60
      : undefined;

  const gain = elevationGain(all);

  return {
    ...(name !== undefined ? { name } : {}),
    points: thin(all),
    pointCount: all.length,
    distanceM: Math.round(distanceM),
    ...(gain !== undefined ? { elevationGainM: gain } : {}),
    ...(durationMin !== undefined ? { durationMin } : {}),
    ...(startSec !== null ? { startTime: new Date(startSec * 1000).toISOString() } : {}),
  };
}
