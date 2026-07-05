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
import { elevationGainM, haversineM, thinTrack } from './geo';

export type GpxImportResult = {
  name?: string; // <trk><name> or <metadata><name>
  points: GeoPoint[]; // flattened across segments; downsampled if huge (see MAX_STORED_POINTS)
  pointCount: number; // original count, before downsampling
  distanceM: number; // haversine, summed per segment, full-resolution points
  elevationGainM?: number; // 3 m hysteresis accumulator; absent if no <ele>
  // Present only when the gain came from a recorded <trk> (⚑ E-9: device
  // unknowable from a file — 'gps' understates). A planned <rte>'s elevations
  // are route-planner/terrain-model output no device ever measured, so its
  // gain carries no label at all — 'gps' there would overstate.
  elevationGainSource?: 'gps';
  durationMin?: number; // last valid <time> − first; absent if untimed
  startTime?: string; // ISO of the first timestamped point
};

type RawPt = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parsePoint(pt: RawPt, kind: 'trkpt' | 'rtept'): GeoPoint | null {
  const lat = Number(pt.lat);
  const lng = Number(pt.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const p: GeoPoint = { lat, lng, tsSec: 0 };
  // Some exporters emit an empty <ele></ele> (or <ele/>) for fixes without
  // altitude; the parser yields '' and Number('') is 0 — a fabricated
  // sea-level reading that would also wreck the hysteresis gain. Only a
  // non-empty numeric string is a reading (null ≠ 0).
  const eleRaw = typeof pt.ele === 'string' ? pt.ele.trim() : '';
  const ele = Number(eleRaw);
  if (eleRaw !== '' && Number.isFinite(ele)) {
    p.eleM = ele;
    // A recorded track's <ele> is labeled 'gps': the recording device is
    // unknowable from the file, so we understate rather than claim barometric
    // (⚑ E-9). A planned route's <rtept> elevation is planner/terrain-model
    // output no device ever measured — the reading is kept but NO source is
    // stamped ('gps' would overstate). No <ele> → no eleSource at all — never
    // a label without a reading.
    if (kind === 'trkpt') p.eleSource = 'gps';
  }
  if (typeof pt.time === 'string') {
    const ms = Date.parse(pt.time);
    if (Number.isFinite(ms)) p.tsSec = Math.floor(ms / 1000);
  }
  return p;
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
        .map((pt) => parsePoint(pt, 'trkpt'))
        .filter((p): p is GeoPoint => p !== null);
      if (pts.length > 0) segments.push(pts);
    }
  }

  // Whether the geometry is a recorded track (<trk>) or the planned-route
  // fallback (<rte>) decides the gain's provenance label below.
  const recorded = segments.length > 0;

  if (segments.length === 0) {
    for (const rte of asArray(gpx.rte as RawPt | RawPt[])) {
      if (name === undefined && typeof rte.name === 'string' && rte.name.trim()) {
        name = rte.name.trim();
      }
      const pts = asArray(rte.rtept as RawPt | RawPt[])
        .map((pt) => parsePoint(pt, 'rtept'))
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

  const gain = elevationGainM(all);

  return {
    ...(name !== undefined ? { name } : {}),
    points: thinTrack(all),
    pointCount: all.length,
    distanceM: Math.round(distanceM),
    ...(gain !== undefined
      ? { elevationGainM: gain, ...(recorded ? { elevationGainSource: 'gps' as const } : {}) }
      : {}),
    ...(durationMin !== undefined ? { durationMin } : {}),
    ...(startSec !== null ? { startTime: new Date(startSec * 1000).toISOString() } : {}),
  };
}
