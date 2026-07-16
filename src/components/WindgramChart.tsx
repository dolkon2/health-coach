/**
 * WindgramChart — the Meteo panel's wxtofly-style windgram (F3,
 * forecast-tab.md §2a/§4): daylight hours × altitude, one column per hour,
 * wind arrow per pressure level, lapse-rate shading between adjacent levels,
 * boundary-layer and freezing-level lines, per-level cloud-cover slivers.
 * Custom react-native-svg, not a charting library (house pattern:
 * WeightTrendChart). All geometry lives in exported pure builders returning
 * plain data (null on undrawable input) so the math is testable without a
 * renderer.
 *
 * COLOR EXCEPTION (Dylan, 2026-07-16, F3): lapse shading and the strongest
 * wind step use the element hues as data colors — a deliberate, documented
 * amendment of the tokens.ts monochrome-data rule, for this chart only.
 * The ramp stays inside the four brand element hues (rust/ochre/sky), no
 * new colors and still no green.
 *
 * The y-axis is metres ASL, linear in geopotential height — honest altitude
 * spacing, so the level bands ride each hour's real heights (slightly wavy,
 * like a real windgram). Levels below the model's grid elevation are
 * clipped, never drawn (1000 hPa is underground at a mountain site).
 * Anything missing stays missing: a hole breaks a line, an absent level
 * draws nothing.
 */
import React from 'react';
import { View, ScrollView } from 'react-native';
import Svg, { Path, Rect, Line, Text as SvgText, G } from 'react-native-svg';
import {
  lapseRateCPerKm,
  lapseBucket,
  type LapseBucket,
  type WindgramHour,
  type WindgramSeries,
  type WindgramDayWindow,
  type WindgramModel,
} from '@core/conditions/windgram';
import { useTheme } from '@/theme';
import { GUST_BUILDING_KT, GUST_ELEVATED_KT } from '@/lib/forecastPanels';
import { Text } from './Text';

export const PLOT_HEIGHT = 240;
export const Y_AXIS_WIDTH = 44;
export const CELL_W = 24;
const DAY_GAP = 12;
const SIDE_INSET = 6;
const TOP_PAD = 16; // day labels
const BOTTOM_PAD = 34; // hour labels + CAPE footer
const ARROW_HALF = 5; // arrow shaft half-length, px

/**
 * Wind-speed steps behind the arrow weight ramp — the launchability read.
 * ⚑ Tunable placeholders: the upper anchors ARE GUST_BUILDING_KT /
 * GUST_ELEVATED_KT (imported, so a retune reaches the Wind card and the
 * windgram together); those are themselves flagged placeholders read off
 * one Windy-Bingen screenshot. BARB_MODERATE_KT is this chart's own floor.
 */
export const BARB_MODERATE_KT = 8;
export type BarbStep = 'light' | 'moderate' | 'strong' | 'elevated';
export function barbStep(speedKts: number): BarbStep {
  if (speedKts >= GUST_ELEVATED_KT) return 'elevated';
  if (speedKts >= GUST_BUILDING_KT) return 'strong';
  if (speedKts >= BARB_MODERATE_KT) return 'moderate';
  return 'light';
}

/** Rotation for an up-pointing arrow glyph: meteorological direction is
 *  where the wind blows FROM; the arrow points where the air is GOING. */
export function windArrowAngle(directionFromDeg: number): number {
  return (directionFromDeg + 180) % 360;
}

/**
 * Map a height (m ASL) into plot y. Null outside the domain — a level
 * below the grid floor or above the top is clipped, never clamped to a
 * false position.
 */
export function levelY(
  heightM: number,
  domain: { minM: number; maxM: number },
  plotH = PLOT_HEIGHT,
  topPad = TOP_PAD,
  bottomPad = BOTTOM_PAD
): number | null {
  const span = domain.maxM - domain.minM;
  if (!Number.isFinite(span) || span <= 0) return null;
  if (heightM < domain.minM || heightM > domain.maxM) return null;
  const innerH = plotH - topPad - bottomPad;
  return topPad + ((domain.maxM - heightM) / span) * innerH;
}

/** Daylight slices: the hours of each day window, sunrise ≤ t ≤ sunset.
 *  Empty days (no hourly data inside the window) are dropped. */
export function dayColumns(
  hours: WindgramHour[],
  days: WindgramDayWindow[]
): Array<{ day: WindgramDayWindow; hours: WindgramHour[] }> {
  return days
    .map((day) => ({
      day,
      hours: hours.filter(
        (h) => h.timeEpochSec >= day.sunriseEpochSec && h.timeEpochSec <= day.sunsetEpochSec
      ),
    }))
    .filter((d) => d.hours.length > 0);
}

export interface WindgramColumn {
  x: number; // left edge
  timeEpochSec: number;
  model: WindgramModel;
  /** Which day group this column belongs to — lines break across groups. */
  dayIndex: number;
  /** Lapse shading between adjacent levels, ground up. */
  bands: Array<{ yTop: number; yBot: number; bucket: LapseBucket }>;
  /** One arrow per drawable level. */
  arrows: Array<{ y: number; angleDeg: number; step: BarbStep }>;
  /** Per-level cloud-cover slivers (right edge of the cell). */
  clouds: Array<{ yTop: number; yBot: number; opacity: number }>;
  capeJkg?: number;
}

export interface WindgramGeometry {
  svgWidth: number;
  svgHeight: number;
  domain: { minM: number; maxM: number };
  columns: WindgramColumn[];
  /** First column x of each day group, for the day label. */
  dayLabels: Array<{ x: number; timeEpochSec: number }>;
  /** x of each between-days separator line. */
  daySeparators: number[];
  yTicks: Array<{ y: number; meters: number }>;
  /** Grid-elevation baseline; null when the response carried no elevation. */
  gridY: number | null;
  gridElevationM: number | null;
  /** Boundary-layer top polyline (grid elevation + BL height), breaks on
   *  holes; null when grid elevation is unknown (an AGL height without a
   *  ground reference has no honest place on an ASL axis). */
  blLine: string | null;
  /** Freezing-level polyline, breaks on holes and out-of-domain hours. */
  freezingLine: string | null;
  /** x of the HRRR→GFS downgrade boundary; null when only one model is
   *  visible among the drawn columns. */
  hrrrBoundaryX: number | null;
}

/**
 * The composed windgram geometry: daylight columns laid out day-group by
 * day-group, everything positioned in pixel space. Null when fewer than 2
 * drawable columns exist — one lone hour is not a windgram.
 */
export function windgramGeometry(series: WindgramSeries): WindgramGeometry | null {
  const groups = dayColumns(series.hours, series.days);
  const allHours = groups.flatMap((g) => g.hours);
  if (allHours.length < 2) return null;

  // Altitude domain: grid elevation (or the lowest drawable level) up to the
  // highest level height seen across the drawn hours.
  let minLevelM = Infinity;
  let maxLevelM = -Infinity;
  for (const h of allHours) {
    for (const l of h.levels) {
      if (l.heightM === undefined) continue;
      minLevelM = Math.min(minLevelM, l.heightM);
      maxLevelM = Math.max(maxLevelM, l.heightM);
    }
  }
  if (!Number.isFinite(minLevelM) || !Number.isFinite(maxLevelM)) return null;
  const gridElevationM = series.gridElevationM ?? null;
  const minM = gridElevationM !== null ? Math.max(gridElevationM, minLevelM) : minLevelM;
  const domain = { minM, maxM: maxLevelM };
  if (domain.maxM - domain.minM <= 0) return null;

  const columns: WindgramColumn[] = [];
  const dayLabels: WindgramGeometry['dayLabels'] = [];
  const daySeparators: number[] = [];
  let x = SIDE_INSET;
  for (let g = 0; g < groups.length; g++) {
    if (g > 0) {
      daySeparators.push(x - DAY_GAP / 2);
    }
    dayLabels.push({ x, timeEpochSec: groups[g].hours[0].timeEpochSec });
    for (const hour of groups[g].hours) {
      const drawable = hour.levels.filter((l) => l.heightM !== undefined);

      const bands: WindgramColumn['bands'] = [];
      for (let i = 0; i < drawable.length - 1; i++) {
        const lower = drawable[i];
        const upper = drawable[i + 1];
        if (lower.tempC === undefined || upper.tempC === undefined) continue;
        const rate = lapseRateCPerKm(
          { tempC: lower.tempC, heightM: lower.heightM! },
          { tempC: upper.tempC, heightM: upper.heightM! }
        );
        if (rate === null) continue;
        // Clamp only the band EDGES to the domain (the layer straddling the
        // grid floor is real; its underground part just isn't drawn).
        const topM = Math.min(upper.heightM!, domain.maxM);
        const botM = Math.max(lower.heightM!, domain.minM);
        if (topM <= botM) continue;
        const yTop = levelY(topM, domain);
        const yBot = levelY(botM, domain);
        if (yTop === null || yBot === null) continue;
        bands.push({ yTop, yBot, bucket: lapseBucket(rate) });
      }

      const arrows: WindgramColumn['arrows'] = [];
      const clouds: WindgramColumn['clouds'] = [];
      for (let i = 0; i < drawable.length; i++) {
        const l = drawable[i];
        const y = levelY(l.heightM!, domain);
        if (y === null) continue;
        if (l.windSpeedKts !== undefined && l.windDirectionDeg !== undefined) {
          arrows.push({
            y,
            angleDeg: windArrowAngle(l.windDirectionDeg),
            step: barbStep(l.windSpeedKts),
          });
        }
        if (l.cloudCoverPct !== undefined) {
          // Sliver spans the midpoints toward the neighbouring levels.
          const below = i > 0 ? drawable[i - 1].heightM! : domain.minM;
          const above = i < drawable.length - 1 ? drawable[i + 1].heightM! : domain.maxM;
          const botM = Math.max((l.heightM! + below) / 2, domain.minM);
          const topM = Math.min((l.heightM! + above) / 2, domain.maxM);
          const yTop = levelY(topM, domain);
          const yBot = levelY(botM, domain);
          if (yTop !== null && yBot !== null && yBot > yTop) {
            clouds.push({ yTop, yBot, opacity: l.cloudCoverPct / 100 });
          }
        }
      }

      const column: WindgramColumn = {
        x,
        timeEpochSec: hour.timeEpochSec,
        model: hour.model,
        dayIndex: g,
        bands,
        arrows,
        clouds,
      };
      if (hour.capeJkg !== undefined) column.capeJkg = hour.capeJkg;
      columns.push(column);
      x += CELL_W;
    }
    x += DAY_GAP;
  }
  const svgWidth = x - DAY_GAP + SIDE_INSET;

  // Lines across columns, positioned at column centers, breaking on holes
  // AND on day boundaries — a segment bridging the overnight gap would
  // fabricate a trend through hours the chart deliberately doesn't draw.
  // columns[i] was built from allHours[i] (same flatten order), so the
  // correspondence is by index, not a timestamp search.
  function lineAcross(pick: (h: WindgramHour) => number | undefined): string | null {
    const segments: string[] = [];
    let drawing = false;
    let prevDay = -1;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col.dayIndex !== prevDay) drawing = false;
      prevDay = col.dayIndex;
      const m = pick(allHours[i]);
      const y = m !== undefined ? levelY(m, domain) : null;
      if (y === null) {
        drawing = false; // a hole (or out-of-domain hour) breaks the line
        continue;
      }
      segments.push(`${drawing ? 'L' : 'M'}${(col.x + CELL_W / 2).toFixed(1)} ${y.toFixed(1)}`);
      drawing = true;
    }
    return segments.length > 0 ? segments.join(' ') : null;
  }

  const blLine =
    gridElevationM !== null
      ? lineAcross((h) => (h.blHeightM !== undefined ? gridElevationM + h.blHeightM : undefined))
      : null;
  const freezingLine = lineAcross((h) => h.freezingLevelM);

  // Downgrade boundary: where the forecast passes the parser's
  // hrrrEndEpochSec (the LAST HRRR hour) — not the first per-hour model
  // flip, which a single transient HRRR hole mid-run would trigger early,
  // mislabeling genuine HRRR columns beyond it. Drawn only when both sides
  // of the boundary are actually on the chart.
  let hrrrBoundaryX: number | null = null;
  const hrrrEnd = series.hrrrEndEpochSec;
  if (hrrrEnd !== undefined && columns[0].timeEpochSec <= hrrrEnd) {
    const firstBeyond = columns.find((c) => c.timeEpochSec > hrrrEnd);
    if (firstBeyond) hrrrBoundaryX = firstBeyond.x - 1;
  }

  const yTicks: WindgramGeometry['yTicks'] = [];
  for (let m = Math.ceil(domain.minM / 1000) * 1000; m <= domain.maxM; m += 1000) {
    const y = levelY(m, domain);
    if (y !== null) yTicks.push({ y, meters: m });
  }

  return {
    svgWidth,
    svgHeight: PLOT_HEIGHT,
    domain,
    columns,
    dayLabels,
    daySeparators,
    yTicks,
    gridY: gridElevationM !== null ? levelY(Math.max(gridElevationM, domain.minM), domain) : null,
    gridElevationM,
    blLine,
    freezingLine,
    hrrrBoundaryX,
  };
}

// ── Rendering ────────────────────────────────────────────────────────────────

const ARROW_STYLE: Record<BarbStep, { strokeWidth: number; opacity: number }> = {
  light: { strokeWidth: 1, opacity: 0.45 },
  moderate: { strokeWidth: 1.5, opacity: 0.65 },
  strong: { strokeWidth: 2, opacity: 0.85 },
  elevated: { strokeWidth: 2.5, opacity: 1 },
};

// Exported so the card's legend (WindgramLegend, ForecastPanelCard.tsx) is
// generated from the exact values the chart draws with — a legend that
// drifts from its chart lies.
export const LAPSE_OPACITY: Record<LapseBucket, number> = {
  unstable: 0.3,
  conditional: 0.22,
  stable: 0.12,
  inverted: 0.08,
};

// Labels are rendered in the SPOT's local time (series.utcOffsetSeconds,
// falling back to UTC when absent), never the viewing device's — the columns
// are sliced by the spot's own daylight, and a Gorge windgram read from New
// York must not claim midnight thermals. Trick: shift the epoch by the
// spot's offset and format with timeZone:'UTC'. Formatters are module-level
// singletons — Intl.DateTimeFormat construction is one of the costliest
// std-lib calls on Hermes and this runs per label per render.
const HOUR_FORMAT = new Intl.DateTimeFormat([], { hour: 'numeric', timeZone: 'UTC' });
const DAY_FORMAT = new Intl.DateTimeFormat([], {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function spotLocalHourLabel(timeEpochSec: number, utcOffsetSeconds = 0): string {
  return HOUR_FORMAT.format(new Date((timeEpochSec + utcOffsetSeconds) * 1000));
}

export function spotLocalDayLabel(timeEpochSec: number, utcOffsetSeconds = 0): string {
  return DAY_FORMAT.format(new Date((timeEpochSec + utcOffsetSeconds) * 1000));
}

export type WindgramChartProps = { series: WindgramSeries };

// memo: the parent spot screen re-renders on unrelated state (picker
// open/close, each fetch landing) and this tree is ~1,000+ SVG elements —
// `series` is a stable state reference, so memo holds between fetches.
export const WindgramChart = React.memo(function WindgramChart({ series }: WindgramChartProps) {
  const theme = useTheme();
  const geo = React.useMemo(() => windgramGeometry(series), [series]);

  if (!geo) {
    return (
      <Text variant="bodySm" color={theme.colors.textMuted}>
        Not enough pressure-level hours for a windgram.
      </Text>
    );
  }

  // The approved F3 color exception: element hues as the lapse ramp.
  const lapseFill: Record<LapseBucket, string> = {
    unstable: theme.colors.element.body, // rust — super-adiabatic
    conditional: theme.colors.element.earth, // ochre — the soaring band
    stable: theme.colors.element.sky, // hazy blue
    inverted: theme.colors.element.sky, // + hatch, below
  };

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* Fixed y-axis strip — altitude, metres ASL. */}
      <Svg width={Y_AXIS_WIDTH} height={PLOT_HEIGHT}>
        {geo.yTicks.map((t) => (
          <SvgText
            key={t.meters}
            x={Y_AXIS_WIDTH - 6}
            y={t.y + 4}
            fontSize={10}
            fontFamily={theme.fonts.numbers.regular}
            fill={theme.colors.textMuted}
            textAnchor="end"
          >
            {t.meters >= 1000 ? `${(t.meters / 1000).toFixed(1)}k` : `${t.meters}`}
          </SvgText>
        ))}
        {geo.gridY !== null && geo.gridElevationM !== null ? (
          <SvgText
            x={Y_AXIS_WIDTH - 6}
            y={Math.min(geo.gridY + 12, PLOT_HEIGHT - BOTTOM_PAD)}
            fontSize={9}
            fontFamily={theme.fonts.numbers.regular}
            fill={theme.colors.textSecondary}
            textAnchor="end"
          >
            ▲{Math.round(geo.gridElevationM)}m
          </SvgText>
        ) : null}
      </Svg>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={geo.svgWidth} height={PLOT_HEIGHT}>
          {/* Altitude grid */}
          {geo.yTicks.map((t) => (
            <Line
              key={t.meters}
              x1={0}
              x2={geo.svgWidth}
              y1={t.y}
              y2={t.y}
              stroke={theme.colors.border}
              strokeOpacity={0.3}
              strokeWidth={1}
            />
          ))}

          {/* Lapse shading + clouds + arrows, column by column */}
          {geo.columns.map((col, colIdx) => (
            <G key={col.timeEpochSec}>
              {col.bands.map((b, i) => (
                <G key={i}>
                  <Rect
                    x={col.x}
                    y={b.yTop}
                    width={CELL_W}
                    height={b.yBot - b.yTop}
                    fill={lapseFill[b.bucket]}
                    fillOpacity={LAPSE_OPACITY[b.bucket]}
                  />
                  {b.bucket === 'inverted' ? (
                    // An inversion is qualitatively different, not just
                    // "less" — hatch it so it never reads as faint-stable.
                    <Path
                      d={hatchPath(col.x, b.yTop, CELL_W, b.yBot - b.yTop)}
                      stroke={theme.colors.textMuted}
                      strokeWidth={0.5}
                      strokeOpacity={0.5}
                    />
                  ) : null}
                </G>
              ))}
              {col.clouds.map((c, i) => (
                <Rect
                  key={i}
                  x={col.x + CELL_W - 4}
                  y={c.yTop}
                  width={3}
                  height={c.yBot - c.yTop}
                  fill={theme.colors.textMuted}
                  fillOpacity={c.opacity}
                />
              ))}
              {col.arrows.map((a, i) => {
                const style = ARROW_STYLE[a.step];
                const color = a.step === 'elevated' ? theme.colors.element.body : theme.colors.text;
                return (
                  <G
                    key={i}
                    transform={`translate(${col.x + CELL_W / 2}, ${a.y}) rotate(${a.angleDeg})`}
                  >
                    <Path
                      d={`M0 ${ARROW_HALF} L0 ${-ARROW_HALF} M0 ${-ARROW_HALF} l-3 3 M0 ${-ARROW_HALF} l3 3`}
                      stroke={color}
                      strokeWidth={style.strokeWidth}
                      strokeOpacity={style.opacity}
                      fill="none"
                    />
                  </G>
                );
              })}
              {/* Hour + CAPE footer, every third column to stay legible */}
              {colIdx % 3 === 0 ? (
                <>
                  <SvgText
                    x={col.x + CELL_W / 2}
                    y={PLOT_HEIGHT - 20}
                    fontSize={9}
                    fontFamily={theme.fonts.numbers.regular}
                    fill={theme.colors.textMuted}
                    textAnchor="middle"
                  >
                    {spotLocalHourLabel(col.timeEpochSec, series.utcOffsetSeconds)}
                  </SvgText>
                  {col.capeJkg !== undefined ? (
                    <SvgText
                      x={col.x + CELL_W / 2}
                      y={PLOT_HEIGHT - 8}
                      fontSize={8}
                      fontFamily={theme.fonts.numbers.regular}
                      fill={theme.colors.textMuted}
                      fillOpacity={0.8}
                      textAnchor="middle"
                    >
                      {Math.round(col.capeJkg)}
                    </SvgText>
                  ) : null}
                </>
              ) : null}
            </G>
          ))}

          {/* Grid-elevation baseline */}
          {geo.gridY !== null ? (
            <Line
              x1={0}
              x2={geo.svgWidth}
              y1={geo.gridY}
              y2={geo.gridY}
              stroke={theme.colors.text}
              strokeWidth={1.5}
            />
          ) : null}

          {/* Boundary-layer top — solid ink */}
          {geo.blLine ? (
            <Path d={geo.blLine} stroke={theme.colors.accent} strokeWidth={2} fill="none" />
          ) : null}

          {/* Freezing level — dashed */}
          {geo.freezingLine ? (
            <Path
              d={geo.freezingLine}
              stroke={theme.colors.textSecondary}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              fill="none"
            />
          ) : null}

          {/* Day separators + labels */}
          {geo.daySeparators.map((sx) => (
            <Line
              key={sx}
              x1={sx}
              x2={sx}
              y1={0}
              y2={PLOT_HEIGHT - BOTTOM_PAD + 6}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
          ))}
          {geo.dayLabels.map((d) => (
            <SvgText
              key={d.timeEpochSec}
              x={d.x}
              y={11}
              fontSize={10}
              fontFamily={theme.fonts.numbers.regular}
              fill={theme.colors.textSecondary}
              textAnchor="start"
            >
              {spotLocalDayLabel(d.timeEpochSec, series.utcOffsetSeconds)}
            </SvgText>
          ))}

          {/* HRRR→GFS downgrade boundary — always visible when both models
              are on the chart (honest-gap labeling, forecast-tab.md §3). */}
          {geo.hrrrBoundaryX !== null ? (
            <>
              <Line
                x1={geo.hrrrBoundaryX}
                x2={geo.hrrrBoundaryX}
                y1={0}
                y2={PLOT_HEIGHT - BOTTOM_PAD + 6}
                stroke={theme.colors.text}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <SvgText
                x={geo.hrrrBoundaryX + 4}
                y={TOP_PAD + 10}
                fontSize={9}
                fontFamily={theme.fonts.numbers.regular}
                fill={theme.colors.textSecondary}
              >
                GFS →
              </SvgText>
            </>
          ) : null}
        </Svg>
      </ScrollView>
    </View>
  );
});

/** Thin horizontal hatch strokes across an inversion band. */
function hatchPath(x: number, y: number, w: number, h: number): string {
  const lines: string[] = [];
  for (let yy = y + 2; yy < y + h; yy += 3) {
    lines.push(`M${x.toFixed(1)} ${yy.toFixed(1)} h${w}`);
  }
  return lines.join(' ');
}
