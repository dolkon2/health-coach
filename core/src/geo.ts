/**
 * geo.ts (core) — pure geospatial primitives with zero platform dependencies.
 *
 * The single haversine implementation for the whole product: the app-side
 * lib/geo.ts re-exports it (a second copy could drift and give two different
 * distances for the same track). Points here are plain {lat,lng} so both the
 * app's GeoPoint (which extends it structurally) and bare coordinates work.
 *
 * pointInMultiPolygon is the zone lookup for frozen conditions (E3): given a
 * session's location, which avalanche-forecast polygon contains it. GeoJSON
 * positions are [lng, lat] — the reverse of every other lat/lng pair in this
 * codebase — so the function takes lat/lng args and reads coordinates in
 * GeoJSON order internally, keeping the flip in exactly one place.
 */

export const EARTH_RADIUS_M = 6371000;

/** The minimal point shape the geo primitives need. GeoPoint satisfies it. */
export type LatLng = { lat: number; lng: number };

/** Great-circle distance between two points, in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Great-circle distance in kilometres (SNOTEL station-distance fidelity note). */
export function haversineKm(a: LatLng, b: LatLng): number {
  return haversineM(a, b) / 1000;
}

/**
 * Ray-casting point-in-ring test (even-odd rule). `ring` is a GeoJSON linear
 * ring: positions are **[lng, lat]**. Tolerates both closed (first === last)
 * and unclosed rings — the wrap-around edge of a closed ring is zero-length
 * and never crosses the ray.
 */
function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Is (lat, lng) inside a GeoJSON MultiPolygon's `coordinates`
 * (polygon → ring → position, positions in **[lng, lat]** order)?
 *
 * Even-odd across each polygon's rings, so holes fall out for free: a point
 * inside a polygon's outer ring AND inside one of its holes crosses an even
 * number of rings and reads outside. A Polygon geometry is the degenerate
 * one-polygon case — callers wrap its coordinates in an array.
 */
export function pointInMultiPolygon(
  lat: number,
  lng: number,
  coordinates: number[][][][]
): boolean {
  for (const polygon of coordinates) {
    let crossings = 0;
    for (const ring of polygon) {
      if (pointInRing(lat, lng, ring)) crossings++;
    }
    if (crossings % 2 === 1) return true;
  }
  return false;
}
