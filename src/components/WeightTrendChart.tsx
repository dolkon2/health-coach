/**
 * WeightTrendChart — the hero of Reflect. A custom SVG trend chart, not a
 * charting library: the brand-kit fidelity rules (opacity + stroke style per
 * capture confidence) and the confidence band are the visual differentiator and
 * don't retrofit onto an off-the-shelf chart (phase-1-build-spec open question).
 *
 * Layers, back to front: confidence band (fill), grid, smoothed EWMA trend line
 * (tier-2, sage), raw weigh-in dots (tier-1, --color-text, styled by fidelity).
 * The y-axis is a fixed left strip; the plot lives in a horizontal ScrollView so
 * you can swipe back in time. Tap a dot to read that day's value below the plot.
 *
 * Hard edges, no border-radius — the data is unmediated (brand kit).
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, ScrollView } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import type { WeightTrendPoint } from '@core/trend';
import { dayKey } from '@core/timeline';
import type { ObservationOf } from '@core/observation';
import { useTheme } from '@/theme';
import { kgToDisplay, type WeightUnit } from '@/lib/units';
import { Text } from './Text';
import { FidelityIndicator, fidelityLevel } from './FidelityIndicator';

// The smoothed curve is only honest after enough readings (acceptance #3).
export const MIN_WEIGH_INS = 7;

const PLOT_HEIGHT = 200;
const Y_AXIS_WIDTH = 38;
const PX_PER_DAY = 6; // wider than the viewport when dense -> horizontal scroll
const TOP_PAD = 14;
const BOTTOM_PAD = 22; // room for x-axis date labels
const SIDE_INSET = 10; // keep edge dots off the plot boundary
const DAY_MS = 86_400_000;

// Confidence-band half-width (kg). Presentational, not engine truth: it narrows
// as the engine's confidence climbs and widens across sparse stretches (big
// gaps between weigh-ins), so the band reads "less sure here". Tunable.
const BAND_MIN_KG = 0.15;
const BAND_CONF_SPAN_KG = 0.8; // added at zero confidence, removed at full
const BAND_GAP_K_KG = 0.07; // per day since the previous reading
const BAND_GAP_CAP_DAYS = 14;

type WeightTrendChartProps = {
  points: WeightTrendPoint[];
  raw: ObservationOf<'weighIn'>[];
  weightUnit: WeightUnit;
  /** A benchmark outcome threshold (kg). Drawn as a dashed sandstone line —
   *  the user's own mark on the mirror, always inside the y-domain so the
   *  distance to it is visible. Absent ⇒ the chart is exactly as before. */
  targetKg?: number;
};

function bandHalfWidthKg(confidence: number, gapDays: number): number {
  const gap = Math.min(gapDays, BAND_GAP_CAP_DAYS) * BAND_GAP_K_KG;
  return BAND_MIN_KG + (1 - confidence) * BAND_CONF_SPAN_KG + gap;
}

/** 'YYYY-MM-DD' -> 'M/D' for x-axis ticks. */
function shortDate(localDate: string): string {
  const [, m, d] = localDate.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function WeightTrendChart({ points, raw, weightUnit, targetKg }: WeightTrendChartProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Geometry is computed in display units so axis labels are the plotted values.
  const model = useMemo(() => {
    if (raw.length < MIN_WEIGH_INS || containerWidth === 0) return null;

    const rawPts = raw.map((o) => {
      const date = dayKey(o.occurredAt);
      return {
        id: o.id,
        ms: Date.parse(date),
        value: kgToDisplay(o.payload.weightKg, weightUnit),
        level: fidelityLevel(o.fidelity),
        date,
      };
    });

    const trendPts = points.map((p, i) => {
      const gapDays = i === 0 ? 0 : (Date.parse(p.date) - Date.parse(points[i - 1].date)) / DAY_MS;
      const half = kgToDisplay(bandHalfWidthKg(p.confidence, gapDays), weightUnit);
      return { ms: Date.parse(p.date), value: kgToDisplay(p.trendKg, weightUnit), half };
    });

    const allMs = [...rawPts, ...trendPts].map((p) => p.ms);
    const minMs = Math.min(...allMs);
    const maxMs = Math.max(...allMs);
    const spanMs = Math.max(DAY_MS, maxMs - minMs);
    const spanDays = spanMs / DAY_MS;

    const plotWidth = Math.max(
      containerWidth - Y_AXIS_WIDTH - SIDE_INSET * 2,
      spanDays * PX_PER_DAY
    );
    const svgWidth = plotWidth + SIDE_INSET * 2;
    const innerH = PLOT_HEIGHT - TOP_PAD - BOTTOM_PAD;

    // Y domain spans dots, trend, band, and any benchmark target, padded so
    // nothing sits on the edge. Including the target stretches the view to
    // show the honest distance between where you are and the line you drew.
    const target = targetKg != null ? kgToDisplay(targetKg, weightUnit) : null;
    const lo = Math.min(
      ...rawPts.map((p) => p.value),
      ...trendPts.map((p) => p.value - p.half),
      ...(target != null ? [target] : [])
    );
    const hi = Math.max(
      ...rawPts.map((p) => p.value),
      ...trendPts.map((p) => p.value + p.half),
      ...(target != null ? [target] : [])
    );
    const pad = Math.max(0.3, (hi - lo) * 0.12);
    const yMin = lo - pad;
    const yMax = hi + pad;

    const xOf = (ms: number) => SIDE_INSET + ((ms - minMs) / spanMs) * plotWidth;
    const yOf = (v: number) => TOP_PAD + ((yMax - v) / (yMax - yMin)) * innerH;

    const trendLine = trendPts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.ms).toFixed(1)} ${yOf(p.value).toFixed(1)}`)
      .join(' ');

    const bandPath =
      trendPts.length >= 2
        ? `M ${trendPts
            .map((p) => `${xOf(p.ms).toFixed(1)} ${yOf(p.value + p.half).toFixed(1)}`)
            .join(' L ')} L ${[...trendPts]
            .reverse()
            .map((p) => `${xOf(p.ms).toFixed(1)} ${yOf(p.value - p.half).toFixed(1)}`)
            .join(' L ')} Z`
        : null;

    // ~4 y-ticks, and x-ticks roughly every two weeks.
    const yTicks = Array.from({ length: 4 }, (_, i) => yMin + ((yMax - yMin) * i) / 3);
    const xStepDays = Math.max(7, Math.round(spanDays / 5));
    const xTicks = trendPts.filter((_, i) => {
      const daysFromStart = (trendPts[i].ms - minMs) / DAY_MS;
      return i === trendPts.length - 1 || Math.round(daysFromStart) % xStepDays === 0;
    });

    return {
      rawPts,
      trendLine,
      bandPath,
      xOf,
      yOf,
      yMin,
      yMax,
      yTicks,
      xTicks,
      plotWidth,
      svgWidth,
      targetY: target != null ? yOf(target) : null,
    };
  }, [points, raw, weightUnit, containerWidth, targetKg]);

  const selected = useMemo(() => {
    if (raw.length === 0) return null;
    const pick = selectedId ? raw.find((o) => o.id === selectedId) : raw[raw.length - 1];
    return pick ?? raw[raw.length - 1];
  }, [raw, selectedId]);

  // ── Honest empty state: never hide the component, say what's missing ──────────
  if (raw.length < MIN_WEIGH_INS) {
    return (
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Weight trend</Text>
        <View style={emptyPanel(theme)}>
          <Text variant="body" color={theme.colors.textMuted}>
            Not enough data yet — log at least {MIN_WEIGH_INS} weigh-ins for a smoothed
            trend.
          </Text>
          <Text variant="dataSm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[1] }}>
            {raw.length}/{MIN_WEIGH_INS} logged
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text variant="label">Weight trend</Text>
        {selected ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
            <Text variant="dataSm" color={theme.colors.textMuted}>
              {shortDate(dayKey(selected.occurredAt))}
            </Text>
            <Text variant="data" color={theme.colors.text}>
              {kgToDisplay(selected.payload.weightKg, weightUnit).toFixed(1)} {weightUnit}
            </Text>
            <FidelityIndicator level={fidelityLevel(selected.fidelity)} />
          </View>
        ) : null}
      </View>

      <View
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        style={{ flexDirection: 'row' }}
      >
        {/* Fixed y-axis strip — stays put while the plot scrolls. */}
        <Svg width={Y_AXIS_WIDTH} height={PLOT_HEIGHT}>
          {model?.yTicks.map((v, i) => (
            <SvgText
              key={i}
              x={Y_AXIS_WIDTH - 6}
              y={model.yOf(v) + 4}
              fontSize={11}
              fontFamily={theme.fonts.data.regular}
              fill={theme.colors.textMuted}
              textAnchor="end"
            >
              {v.toFixed(1)}
            </SvgText>
          ))}
        </Svg>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {model ? (
            <Svg width={model.svgWidth} height={PLOT_HEIGHT}>
              {/* Grid */}
              {model.yTicks.map((v, i) => (
                <Line
                  key={i}
                  x1={0}
                  x2={model.svgWidth}
                  y1={model.yOf(v)}
                  y2={model.yOf(v)}
                  stroke={theme.colors.border}
                  strokeOpacity={0.3}
                  strokeWidth={1}
                />
              ))}

              {/* Benchmark target — the user's own mark on the mirror. Dashed
                  sandstone, behind the data: the trend crosses IT, not the
                  other way round. No label; the outcome line states the
                  distance in words. */}
              {model.targetY != null ? (
                <Line
                  x1={0}
                  x2={model.svgWidth}
                  y1={model.targetY}
                  y2={model.targetY}
                  stroke={theme.colors.accent}
                  strokeWidth={1}
                  strokeDasharray="6 4"
                  strokeOpacity={0.7}
                />
              ) : null}

              {/* Confidence band (fidelity-aware fill) */}
              {model.bandPath ? (
                <Path d={model.bandPath} fill={theme.colors.trendLine} fillOpacity={0.15} />
              ) : null}

              {/* Smoothed EWMA trend line — tier-2, sage, 2px */}
              <Path
                d={model.trendLine}
                stroke={theme.colors.trendLine}
                strokeWidth={2}
                fill="none"
              />

              {/* x-axis date ticks (scroll with the data) */}
              {model.xTicks.map((p, i) => (
                <SvgText
                  key={i}
                  x={model.xOf(p.ms)}
                  y={PLOT_HEIGHT - 6}
                  fontSize={11}
                  fontFamily={theme.fonts.data.regular}
                  fill={theme.colors.textMuted}
                  textAnchor="middle"
                >
                  {shortDate(new Date(p.ms).toISOString().slice(0, 10))}
                </SvgText>
              ))}

              {/* Raw weigh-in dots — tier-1, styled by fidelity (brand-kit table) */}
              {model.rawPts.map((p) => {
                const isSel = selected?.id === p.id;
                const dot = dotStyle(p.level, theme.colors.text);
                return (
                  <G key={p.id}>
                    {/* enlarged invisible hit target */}
                    <Circle
                      cx={model.xOf(p.ms)}
                      cy={model.yOf(p.value)}
                      r={14}
                      fill="transparent"
                      onPress={() => setSelectedId(p.id)}
                    />
                    <Circle
                      cx={model.xOf(p.ms)}
                      cy={model.yOf(p.value)}
                      r={isSel ? 5 : 3}
                      fill={isSel ? theme.colors.accent : dot.fill}
                      stroke={isSel ? theme.colors.accent : dot.stroke}
                      strokeWidth={dot.strokeWidth}
                      strokeDasharray={dot.strokeDasharray}
                      opacity={isSel ? 1 : dot.opacity}
                    />
                  </G>
                );
              })}
            </Svg>
          ) : (
            <View style={{ width: 1, height: PLOT_HEIGHT }} />
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// ── Fidelity → dot styling. The infrastructure for hollow/dotted lower-fidelity
// dots is in place even though every manual weigh-in is currently high (0.95);
// the day a photo-of-a-scale source lands, its dots render hollow/dashed for free.
function dotStyle(level: 'high' | 'mid' | 'low', color: string) {
  switch (level) {
    case 'high': // solid filled — weighed/scale
      return { fill: color, stroke: 'none', strokeWidth: 0, strokeDasharray: undefined, opacity: 1 };
    case 'mid': // hollow ring — text entry / estimate
      return { fill: 'transparent', stroke: color, strokeWidth: 1.5, strokeDasharray: undefined, opacity: 0.7 };
    case 'low': // dotted ring — photo / AI guess
      return { fill: 'transparent', stroke: color, strokeWidth: 1.5, strokeDasharray: '2 2', opacity: 0.45 };
  }
}

function emptyPanel(theme: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 0, // hard edges — data panel (brand kit)
    padding: theme.spacing[4],
    minHeight: 120,
    justifyContent: 'center' as const,
  };
}
