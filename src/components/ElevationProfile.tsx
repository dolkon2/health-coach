/**
 * ElevationProfile — the route's climb drawn as a quiet SVG area chart.
 *
 * A display-only sibling of RoutePreview: the engine holds the GeoPoint[] and
 * this projects the elevation-vs-distance series (elevationProfile()) into a
 * filled area. Absent, never fabricated — when the track carries no altitude
 * (a GPX planned route, a phone with no barometric fix) the component renders
 * nothing rather than a flat fake line (gps-mapping-spec.md; constitution:
 * null ≠ 0). Elevation is shown in metres, the app's convention for climb.
 *
 * The x-axis is real cumulative distance; the chart stretches to fill width
 * (preserveAspectRatio="none") since it's a graph, not a map, so the stroke is
 * pinned with vectorEffect so it stays even under the non-uniform scale.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { GeoPoint } from '@core/observation';
import { useTheme } from '@/theme';
import { elevationGainM } from '@/lib/geo';
import { elevationProfile } from '@/lib/elevationProfile';
import { Text } from './Text';

const VIEW_W = 300;
const VIEW_H = 80;
const PAD_Y = 6;

type ElevationPaths = { line: string; area: string; minEle: number; maxEle: number };

/**
 * Builds the line + area SVG path strings (VIEW_W×VIEW_H space) plus the
 * elevation extent. Exported for tests. Null when there's nothing drawable —
 * fewer than two elevation samples, or a degenerate (zero-length) distance span.
 */
export function elevationPaths(points: GeoPoint[]): ElevationPaths | null {
  const samples = elevationProfile(points);
  if (!samples) return null;

  const first = samples[0].distM;
  const spanX = samples[samples.length - 1].distM - first;
  if (spanX <= 0) return null;

  let minEle = Infinity;
  let maxEle = -Infinity;
  for (const s of samples) {
    if (s.eleM < minEle) minEle = s.eleM;
    if (s.eleM > maxEle) maxEle = s.eleM;
  }
  const spanY = maxEle - minEle;
  const innerH = VIEW_H - PAD_Y * 2;

  const xOf = (d: number) => ((d - first) / spanX) * VIEW_W;
  // Flat terrain (spanY === 0) is real data, not missing — draw it level, not null.
  const yOf = (e: number) =>
    spanY > 0 ? PAD_Y + ((maxEle - e) / spanY) * innerH : VIEW_H / 2;

  const line = samples
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${xOf(s.distM).toFixed(1)} ${yOf(s.eleM).toFixed(1)}`)
    .join(' ');
  // Close the area down to the baseline and back to the start.
  const area = `${line} L${VIEW_W} ${VIEW_H} L0 ${VIEW_H} Z`;

  return { line, area, minEle, maxEle };
}

type ElevationProfileProps = {
  points: GeoPoint[];
  height?: number;
  color?: string;
};

export function ElevationProfile({ points, height = 88, color }: ElevationProfileProps) {
  const theme = useTheme();
  const paths = elevationPaths(points);
  if (!paths) return null;

  const gain = elevationGainM(points);
  const stroke = color ?? theme.colors.olive;
  const caption = [
    gain != null ? `↑ ${gain} m` : null,
    `${Math.round(paths.minEle)}–${Math.round(paths.maxEle)} m`,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Text variant="label">Elevation</Text>
        <Text variant="dataSm" color={theme.colors.textMuted}>
          {caption}
        </Text>
      </View>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        accessibilityLabel="Elevation profile"
      >
        <Path d={paths.area} fill={stroke} fillOpacity={0.14} />
        <Path
          d={paths.line}
          stroke={stroke}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </View>
  );
}
