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
import type { LatLng } from '@core/geo';
import { useTheme } from '@/theme';

const VIEW_W = 100;
const VIEW_H = 56;
const PAD = 6;
const MAX_DRAW_POINTS = 400;

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number; lngScale: number };

function boundsOf(pointSets: LatLng[][]): Bounds | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const points of pointSets) {
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
  }
  if (!Number.isFinite(minLat)) return null; // no points at all
  const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
  return { minLat, maxLat, minLng, maxLng, lngScale: Math.cos(midLatRad) };
}

/** Thin to ≤ MAX_DRAW_POINTS, always keeping the true endpoint. */
function thinForDraw(points: LatLng[]): LatLng[] {
  const drawn: LatLng[] = [];
  const stride = Math.max(1, Math.ceil(points.length / MAX_DRAW_POINTS));
  for (let i = 0; i < points.length; i += stride) drawn.push(points[i]);
  if (drawn[drawn.length - 1] !== points[points.length - 1]) {
    drawn.push(points[points.length - 1]);
  }
  return drawn;
}

/** Projects a thinned point set into a path string against a shared `bounds`
 *  (so two lines drawn against the same bounds stay spatially comparable). */
function projectPath(points: LatLng[], bounds: Bounds): string | null {
  const { minLat, maxLat, minLng, maxLng, lngScale } = bounds;
  const spanX = (maxLng - minLng) * lngScale;
  const spanY = maxLat - minLat;
  if (spanX <= 0 && spanY <= 0) return null;

  const innerW = VIEW_W - PAD * 2;
  const innerH = VIEW_H - PAD * 2;
  const scale = Math.min(
    spanX > 0 ? innerW / spanX : Infinity,
    spanY > 0 ? innerH / spanY : Infinity
  );
  const offsetX = (innerW - spanX * scale) / 2 + PAD;
  const offsetY = (innerH - spanY * scale) / 2 + PAD;

  const parts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = offsetX + (p.lng - minLng) * lngScale * scale;
    // SVG y grows downward; latitude grows upward.
    const y = offsetY + (maxLat - p.lat) * scale;
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(' ');
}

/**
 * Projects a route into an SVG path string for a VIEW_W×VIEW_H viewBox.
 * Exported for tests. Returns null when there's nothing drawable (<2 points
 * or a degenerate bounding box — e.g. a treadmill "route" of identical points).
 */
export function routePathD(points: LatLng[]): string | null {
  if (points.length < 2) return null;
  const drawn = thinForDraw(points);
  const bounds = boundsOf([drawn]);
  return bounds ? projectPath(drawn, bounds) : null;
}

/**
 * Projects a live trace AND a muted guide route into the SAME bounding box,
 * so the two lines stay spatially comparable (route-follow, routes-spec M4) —
 * two independent routePathD() calls would each fill the viewBox on their
 * own scale and lose the "how far off the guide am I" relationship.
 */
export function routeGuidePathsD(
  livePoints: LatLng[],
  guidePoints: LatLng[]
): { live: string | null; guide: string | null } {
  const liveDrawn = livePoints.length >= 2 ? thinForDraw(livePoints) : [];
  const guideDrawn = guidePoints.length >= 2 ? thinForDraw(guidePoints) : [];
  const bounds = boundsOf([liveDrawn, guideDrawn]);
  if (!bounds) return { live: null, guide: null };
  return {
    live: liveDrawn.length >= 2 ? projectPath(liveDrawn, bounds) : null,
    guide: guideDrawn.length >= 2 ? projectPath(guideDrawn, bounds) : null,
  };
}

type RoutePreviewProps = {
  path: LatLng[];
  /** Rendered height in px; width fills the container at the viewBox aspect. */
  height?: number;
  color?: string;
  /** A muted second line under `path` — the followed route (routes-spec M4).
   *  Drawn first (behind), dashed, in a quiet tone. */
  guidePath?: LatLng[];
};

export function RoutePreview({ path, height = 84, color, guidePath }: RoutePreviewProps) {
  const theme = useTheme();
  const hasGuide = guidePath != null && guidePath.length >= 2;
  const { live: liveD, guide: guideD } = hasGuide
    ? routeGuidePathsD(path, guidePath)
    : { live: routePathD(path), guide: null };
  if (!liveD && !guideD) return null;

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      accessibilityLabel="Route trace"
    >
      {guideD ? (
        <Path
          d={guideD}
          stroke={theme.colors.textMuted}
          strokeWidth={1.6}
          strokeDasharray="3,3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
      {liveD ? (
        <Path
          d={liveD}
          stroke={color ?? theme.colors.accent}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
    </Svg>
  );
}
