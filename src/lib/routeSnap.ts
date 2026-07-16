/**
 * routeSnap.ts — snap-to-trail/road/waterway for the Explore-2 route builder
 * (map-tab.md REFRAME AMENDMENT, ROUTING REVERSAL). Given two placed points and
 * a per-sport routing *mode*, return the geometry between them:
 *
 *   - 'foot' / 'bike' → Valhalla (config.ts `valhallaRouteUrl()`), pedestrian or
 *     bicycle costing. The engine is swappable at the config layer (Stadia
 *     hosted → self-host) with no change here.
 *   - 'river'         → the OSM waterway line (Overpass), clipped between the two
 *     points — a sibling mechanism, not a road-routing engine.
 *   - 'freeline'      → a straight segment [a, b] (paragliding, and the universal
 *     fallback).
 *
 * BUILD ONLINE / FOLLOW OFFLINE: this runs only while *building* a route (needs
 * signal). The returned geometry is stored locally; *following* a saved route
 * never calls this. Every failure — no key, offline, timeout, no waterway found
 * — degrades to a free-line segment flagged `fellBack: true` (honest, never
 * blocked; the same rule as geocode.ts / the MapTiler endpoints). Snapping never
 * throws.
 *
 * The response decoders (decodePolyline, decodeValhalla, parseOverpassWays,
 * clipWaterway) are pure and exported so they unit-test without a network or an
 * env-dependent key (the geocode.ts "extract the pure parser" precedent).
 */
import { haversineM, type LatLng } from '@core/geo';
import { activityById } from './activity';
import { valhallaRouteUrl, OVERPASS_URL } from './config';
import type { FetchJsonDeps } from './conditions/fetchJson';

/** Per-sport routing mode. Resolved from the activity's modality. */
export type RoutingMode = 'foot' | 'bike' | 'river' | 'freeline';

/** A snapped segment's geometry (inclusive of both endpoints) plus whether we
 *  *wanted* to snap but fell back to a straight line — drives per-segment honesty
 *  labeling. `fellBack` is always false for an intended 'freeline' segment. */
export type SnapResult = { coords: LatLng[]; fellBack: boolean };

/** Deps for testability: inject `fetchImpl` to mock the network, and
 *  `valhallaUrl`/`overpassUrl` to exercise the happy path without env keys.
 *  Pass `valhallaUrl: null` to force the no-engine (free-line) path. */
export type SnapDeps = FetchJsonDeps & {
  valhallaUrl?: string | null;
  overpassUrl?: string;
};

/**
 * Which routing mode a route for this activity should use. Keyed on the
 * activity's engine *modality* (activity.ts), the finest discriminator we have:
 * run/hike → foot, ride → bike, paddle (kayak/whitewater/canoe/sup/row) → river.
 * Everything else — paragliding & the rest of Sky, surf/swim/wind on Water, snow
 * 'other', climb, Body — is free-line. Unknown ids fall back to free-line.
 */
export function routingModeForActivity(activityId: string): RoutingMode {
  const a = activityById(activityId);
  if (!a) return 'freeline';
  switch (a.modality) {
    case 'run':
    case 'hike':
      return 'foot';
    case 'ride':
      return 'bike';
    case 'paddle':
      return 'river';
    default:
      return 'freeline';
  }
}

// ─── Pure decoders / geometry (network-free, unit-tested directly) ───────────

/**
 * Decode a Google/Valhalla encoded polyline. Valhalla uses 6 digits of
 * precision (Google's classic format is 5) — pass `precision` accordingly.
 * Standard algorithm: 5-bit chunks, zig-zag signed deltas.
 */
export function decodePolyline(str: string, precision = 6): LatLng[] {
  const factor = Math.pow(10, precision);
  const coords: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push({ lat: lat / factor, lng: lng / factor });
  }
  return coords;
}

type ValhallaShape = { trip?: { legs?: Array<{ shape?: string }> } };

/**
 * Valhalla `/route` JSON → the concatenated leg geometry, or null if the
 * response carried no usable shape. Leg shapes are precision-6 polylines; a
 * two-location request has a single leg.
 */
export function decodeValhalla(json: unknown, precision = 6): LatLng[] | null {
  const legs = (json as ValhallaShape | null)?.trip?.legs;
  if (!Array.isArray(legs)) return null;
  const out: LatLng[] = [];
  for (const leg of legs) {
    if (typeof leg?.shape !== 'string') continue;
    const decoded = decodePolyline(leg.shape, precision);
    // Legs share an endpoint node; drop the duplicate first vertex on joins.
    for (let i = 0; i < decoded.length; i++) {
      if (out.length > 0 && i === 0) continue;
      out.push(decoded[i]);
    }
  }
  return out.length >= 2 ? out : null;
}

type OverpassJson = { elements?: Array<{ type?: string; geometry?: Array<{ lat?: number; lon?: number }> }> };

/** Overpass `out geom` response → each `way`'s polyline as LatLng[] (Overpass
 *  positions are {lat, lon}). Ways with fewer than 2 usable vertices are
 *  dropped. */
export function parseOverpassWays(json: unknown): LatLng[][] {
  const els = (json as OverpassJson | null)?.elements;
  if (!Array.isArray(els)) return [];
  const ways: LatLng[][] = [];
  for (const el of els) {
    if (el?.type !== 'way' || !Array.isArray(el.geometry)) continue;
    const line: LatLng[] = [];
    for (const p of el.geometry) {
      if (typeof p?.lat === 'number' && typeof p?.lon === 'number') line.push({ lat: p.lat, lng: p.lon });
    }
    if (line.length >= 2) ways.push(line);
  }
  return ways;
}

function nearestVertexIdx(way: LatLng[], p: LatLng): number {
  let best = 0;
  let bestD = haversineM(p, way[0]);
  for (let i = 1; i < way.length; i++) {
    const d = haversineM(p, way[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Clip an OSM waterway line between put-in `a` and take-out `b`. Picks the way
 * whose nearest vertices to a and b are jointly closest, then returns the
 * sub-polyline between those vertices oriented a→b. Returns null (→ free-line
 * fallback) when the best way is farther than `maxSnapM` from either point, or
 * the clip degenerates to a single vertex — the two points aren't on a mapped
 * river, so we don't fabricate a course.
 */
export function clipWaterway(
  ways: LatLng[][],
  a: LatLng,
  b: LatLng,
  maxSnapM = 200
): LatLng[] | null {
  let best: { way: LatLng[]; ia: number; ib: number; da: number; db: number; cost: number } | null = null;
  for (const way of ways) {
    if (way.length < 2) continue;
    const ia = nearestVertexIdx(way, a);
    const ib = nearestVertexIdx(way, b);
    const da = haversineM(a, way[ia]);
    const db = haversineM(b, way[ib]);
    const cost = da + db;
    if (best === null || cost < best.cost) best = { way, ia, ib, da, db, cost };
  }
  if (!best || best.da > maxSnapM || best.db > maxSnapM) return null;
  const { way, ia, ib } = best;
  const slice = ia <= ib ? way.slice(ia, ib + 1) : way.slice(ib, ia + 1).reverse();
  return slice.length >= 2 ? slice : null;
}

/** [south, west, north, east] bbox around a→b, padded so the river line nearby
 *  is caught even when the two points are close together. */
export function overpassBBox(a: LatLng, b: LatLng, padDeg = 0.01): [number, number, number, number] {
  return [
    Math.min(a.lat, b.lat) - padDeg,
    Math.min(a.lng, b.lng) - padDeg,
    Math.max(a.lat, b.lat) + padDeg,
    Math.max(a.lng, b.lng) + padDeg,
  ];
}

/** Overpass QL for every `waterway` way in the a→b bounding box, with geometry. */
export function buildOverpassQuery(a: LatLng, b: LatLng): string {
  const [s, w, n, e] = overpassBBox(a, b);
  return `[out:json][timeout:25];way["waterway"](${s},${w},${n},${e});out geom;`;
}

function valhallaBody(a: LatLng, b: LatLng, mode: 'foot' | 'bike') {
  return {
    locations: [
      { lat: a.lat, lon: a.lng },
      { lat: b.lat, lon: b.lng },
    ],
    costing: mode === 'bike' ? 'bicycle' : 'pedestrian',
    directions_options: { units: 'kilometers' },
  };
}

// ─── Network (POST + timeout + null-on-failure; mirrors fetchJson) ───────────

async function postJson(
  url: string,
  body: string,
  headers: Record<string, string>,
  deps: SnapDeps | undefined,
  timeoutMs: number
): Promise<unknown> {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (deps?.signal) {
    if (deps.signal.aborted) controller.abort();
    else deps.signal.addEventListener('abort', onAbort);
  }
  try {
    const res = await fetchImpl(url, { method: 'POST', body, headers, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    if (deps?.signal) deps.signal.removeEventListener('abort', onAbort);
  }
}

async function snapValhalla(a: LatLng, b: LatLng, mode: 'foot' | 'bike', deps?: SnapDeps): Promise<SnapResult> {
  const url = deps?.valhallaUrl !== undefined ? deps.valhallaUrl : valhallaRouteUrl();
  if (!url) return { coords: [a, b], fellBack: true };
  const json = await postJson(url, JSON.stringify(valhallaBody(a, b, mode)), { 'Content-Type': 'application/json' }, deps, 8000);
  const decoded = decodeValhalla(json);
  return decoded ? { coords: decoded, fellBack: false } : { coords: [a, b], fellBack: true };
}

async function snapRiver(a: LatLng, b: LatLng, deps?: SnapDeps): Promise<SnapResult> {
  const url = deps?.overpassUrl ?? OVERPASS_URL;
  const body = `data=${encodeURIComponent(buildOverpassQuery(a, b))}`;
  const json = await postJson(url, body, { 'Content-Type': 'application/x-www-form-urlencoded' }, deps, 25000);
  const clipped = clipWaterway(parseOverpassWays(json), a, b);
  return clipped ? { coords: clipped, fellBack: false } : { coords: [a, b], fellBack: true };
}

/**
 * Snap the segment from `a` to `b` for the given routing `mode`. Always
 * resolves (never throws): a snapping failure returns the straight segment with
 * `fellBack: true`. A 'freeline' segment is the straight line with
 * `fellBack: false` (intended, not a fallback).
 */
export async function snapSegment(a: LatLng, b: LatLng, mode: RoutingMode, deps?: SnapDeps): Promise<SnapResult> {
  switch (mode) {
    case 'freeline':
      return { coords: [a, b], fellBack: false };
    case 'river':
      return snapRiver(a, b, deps);
    case 'foot':
    case 'bike':
      return snapValhalla(a, b, mode, deps);
  }
}
