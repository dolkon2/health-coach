/**
 * BenchmarkRhythm — the behavior face over time: the last N windows as
 * factual counts, hard-edged bars (the data is unmediated).
 *
 * The mirror's rules, rendered (benchmarks-spec.md v0.4, "Consistency
 * counters"):
 *  - Bars are ONE color — a bar that hits target never changes hue; the
 *    palette never grades. The dashed accent line at target height is the
 *    user's own mark, same grammar as the trend chart's target line.
 *  - The in-progress window renders at reduced opacity — it isn't a verdict
 *    yet — and its label says "now".
 *  - The revealed run reads back beneath as plain words, only when it exists:
 *    a run of 0 simply isn't shown, no drama either way.
 *  - Windows before the benchmark existed still count — history is revealed,
 *    not started at the moment of intent.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme';
import type { WindowCount } from '@/lib/benchmarkReflect';
import { Text } from './Text';

const BAR_AREA_HEIGHT = 96;
const TOP_PAD = 10;
const BOTTOM_PAD = 20; // window labels
const BAR_FILL = 0.55;

type BenchmarkRhythmProps = {
  counts: WindowCount[]; // oldest → newest, current window last
  run: number; // consecutive complete windows at target
  window: 'week' | 'month';
};

/** ISO instant → 'M/D' for the window's opening day. */
function shortDate(iso: string): string {
  const d = iso.slice(0, 10).split('-');
  return `${Number(d[1])}/${Number(d[2])}`;
}

export function BenchmarkRhythm({ counts, run, window }: BenchmarkRhythmProps) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const unit = window === 'week' ? 'week' : 'month';
  const target = counts.length > 0 ? counts[0].target : 0;
  const maxCount = Math.max(target, ...counts.map((c) => c.count));

  const innerH = BAR_AREA_HEIGHT - TOP_PAD - BOTTOM_PAD;
  const baselineY = TOP_PAD + innerH;
  const slot = containerWidth > 0 ? containerWidth / counts.length : 0;
  const barWidth = slot * BAR_FILL;
  const hOf = (count: number) => (maxCount > 0 ? (count / maxCount) * innerH : 0);
  const targetY = baselineY - hOf(target);

  return (
    <View
      style={{ gap: theme.spacing[2] }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Text variant="label">Rhythm</Text>
      {containerWidth > 0 ? (
        <Svg width={containerWidth} height={BAR_AREA_HEIGHT}>
          {/* Baseline */}
          <Line
            x1={0}
            x2={containerWidth}
            y1={baselineY}
            y2={baselineY}
            stroke={theme.colors.border}
            strokeWidth={1}
          />

          {/* Bars — one color, in-progress window hazed (not a verdict yet) */}
          {counts.map((c, i) => {
            const x = i * slot + (slot - barWidth) / 2;
            const h = hOf(c.count);
            return (
              <React.Fragment key={c.fromIso}>
                {c.count > 0 ? (
                  <Rect
                    x={x}
                    y={baselineY - h}
                    width={barWidth}
                    height={h}
                    fill={theme.colors.trendLine}
                    opacity={c.complete ? 0.9 : 0.45}
                  />
                ) : null}
                <SvgText
                  x={x + barWidth / 2}
                  y={BAR_AREA_HEIGHT - 6}
                  fontSize={10}
                  fontFamily={theme.fonts.numbers.regular}
                  fill={theme.colors.textMuted}
                  textAnchor="middle"
                >
                  {(c.current ?? !c.complete) ? 'now' : shortDate(c.fromIso)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Target — the user's own mark, dashed accent (chart grammar) */}
          {target > 0 ? (
            <Line
              x1={0}
              x2={containerWidth}
              y1={targetY}
              y2={targetY}
              stroke={theme.colors.accent}
              strokeWidth={1}
              strokeDasharray="6 4"
              strokeOpacity={0.7}
            />
          ) : null}
        </Svg>
      ) : (
        <View style={{ height: BAR_AREA_HEIGHT }} />
      )}

      {/* The revealed run — plain words, shown only when it exists. */}
      {run > 0 ? (
        <Text variant="dataSm" color={theme.colors.textSecondary}>
          {run} {unit}
          {run === 1 ? '' : 's'} running at target
        </Text>
      ) : null}
    </View>
  );
}
