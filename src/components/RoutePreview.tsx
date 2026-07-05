/**
 * RoutePreview — the imported route drawn as a quiet SVG trace.
 *
 * This is the sparse first rung of the map-display ladder (gps-mapping-spec.md:
 * "the map can ship sparse and get gorgeous later") — the actual recorded line,
 * no tiles, no fabrication. The engine never renders a pixel; this component
 * projects the stored GeoPoint[] and nothing else. A real map (MapLibre) is a
 * later, additive upgrade; the same gpsPath feeds it.
 *
 * Projection: equirectangular with cos(mid-latitude) longitude correction —
 * plenty for a thumbnail at activity scale — fitted to the viewBox preserving
 * the route's aspect ratio. Long tracks are thinned to ≤ MAX_DRAW_POINTS for
 * an SVG path the UI thread parses happily.
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { GeoPoint } from '@core/observation';
import { useTheme } from '@/theme';

const VIEW_W = 100;
const VIEW_H = 56;
const PAD = 6;
const MAX_DRAW_POINTS = 400;

/**
 * Projects a route into an SVG path string for a VIEW_W×VIEW_H viewBox.
 * Exported for tests. Returns null when there's nothing drawable (<2 points
 * or a degenerate bounding box — e.g. a treadmill "route" of identical points).
 */
export function routePathD(points: GeoPoint[]): string | null {
  if (points.length < 2) return null;

  const drawn: GeoPoint[] = [];
  const stride = Math.max(1, Math.ceil(points.length / MAX_DRAW_POINTS));
  for (let i = 0; i < points.length; i += stride) drawn.push(points[i]);
  if (drawn[drawn.length - 1] !== points[points.length - 1]) {
    drawn.push(points[points.length - 1]);
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of drawn) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const lngScale = Math.cos(midLatRad);
  const spanX = (maxLng - minLng) * lngScale;
  const spanY = maxLat - minLat;
  if (spanX <= 0 && spanY <= 0) return null;

  // One scale for both axes (aspect preserved), fitted to the padded box.
  const innerW = VIEW_W - PAD * 2;
  const innerH = VIEW_H - PAD * 2;
  const scale = Math.min(
    spanX > 0 ? innerW / spanX : Infinity,
    spanY > 0 ? innerH / spanY : Infinity
  );
  const offsetX = (innerW - spanX * scale) / 2 + PAD;
  const offsetY = (innerH - spanY * scale) / 2 + PAD;

  const parts: string[] = [];
  for (let i = 0; i < drawn.length; i++) {
    const p = drawn[i];
    const x = offsetX + (p.lng - minLng) * lngScale * scale;
    // SVG y grows downward; latitude grows upward.
    const y = offsetY + (maxLat - p.lat) * scale;
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(' ');
}

type RoutePreviewProps = {
  path: GeoPoint[];
  /** Rendered height in px; width fills the container at the viewBox aspect. */
  height?: number;
  color?: string;
};

export function RoutePreview({ path, height = 84, color }: RoutePreviewProps) {
  const theme = useTheme();
  const d = routePathD(path);
  if (!d) return null;

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      accessibilityLabel="Route trace"
    >
      <Path
        d={d}
        stroke={color ?? theme.colors.sandstone}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
