/**
 * ForecastPanelCard — the Wind and Rain/Shine dashboard cards (F1,
 * forecast-tab.md §2a/§4). Visually distinct from the spot's live-conditions
 * Card (spot detail keeps them in separate sections) — live is "right now",
 * these are "ahead", never merged into one number.
 *
 * Wind: avg+gust header (nearest upcoming hour, not a multi-hour average —
 * a model forecast has no lull, so this is NOT the observed lull/avg/gust
 * three-number convention; that's F2's live-station data), a two-trace
 * hourly graph (avg/gust), gust emphasis past the Windy-Bingen-screenshot
 * threshold rendered as ink weight, never a new hue (gustStep, forecastPanels.ts).
 * Rain/Shine: daily rows with probability AND accumulation together
 * (Wunderground convention), a temp/feels-like hourly graph, and the
 * windowed accumulation headline. Beyond-72h daily rows fade (opacity).
 *
 * Both fold a missing/failed fetch to a quiet "forecast unavailable" line —
 * same convention as current.ts — never a fabricated number.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { HourlyForecastPoint, DailyForecastPoint } from '@core/conditions/forecast';
import { useTheme } from '@/theme';
import {
  windHeader,
  windHeaderLabel,
  gustStep,
  precipWindowHeadline,
  dailyRainShineRows,
  isBeyondFadeHorizon,
} from '@/lib/forecastPanels';
import { Card } from './Card';
import { Text } from './Text';

const VIEW_W = 300;
const VIEW_H = 70;
const PAD_Y = 6;

function xyPaths(
  window: { a: number; b: number }[]
): { lineA: string; lineB: string; min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const { a, b } of window) {
    min = Math.min(min, a, b);
    max = Math.max(max, a, b);
  }
  const spanY = max - min;
  const innerH = VIEW_H - PAD_Y * 2;
  const xOf = (i: number) => (window.length > 1 ? (i / (window.length - 1)) * VIEW_W : 0);
  const yOf = (v: number) => (spanY > 0 ? PAD_Y + ((max - v) / spanY) * innerH : VIEW_H / 2);
  const path = (pick: (p: { a: number; b: number }) => number) =>
    window.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)} ${yOf(pick(p)).toFixed(1)}`).join(' ');
  return { lineA: path((p) => p.a), lineB: path((p) => p.b), min, max };
}

export interface WindChartPaths {
  lineAvg: string;
  lineGust: string;
  minKts: number;
  maxKts: number;
}

/**
 * Dual-trace (avg/gust) SVG path pair over the next `hoursAhead` hours.
 * Only includes hours where BOTH fields are present — a gap in one series
 * would otherwise force a fabricated join. Null when fewer than 2 such hours
 * exist (exported for tests; ElevationProfile's pure-path-builder pattern).
 */
export function windDualLinePaths(
  hourly: HourlyForecastPoint[],
  hoursAhead = 24
): WindChartPaths | null {
  const window = hourly
    .slice(0, hoursAhead)
    .filter((h) => h.windSpeedKts !== undefined && h.windGustKts !== undefined)
    .map((h) => ({ a: h.windSpeedKts!, b: h.windGustKts! }));
  if (window.length < 2) return null;
  const { lineA, lineB, min, max } = xyPaths(window);
  return { lineAvg: lineA, lineGust: lineB, minKts: min, maxKts: max };
}

export interface TempChartPaths {
  lineTemp: string;
  lineFeels: string;
  minC: number;
  maxC: number;
}

/** Dual-trace (temp/feels-like) path pair, same shape/rules as windDualLinePaths. */
export function tempDualLinePaths(
  hourly: HourlyForecastPoint[],
  hoursAhead = 24
): TempChartPaths | null {
  const window = hourly
    .slice(0, hoursAhead)
    .filter((h) => h.tempC !== undefined && h.apparentTempC !== undefined)
    .map((h) => ({ a: h.tempC!, b: h.apparentTempC! }));
  if (window.length < 2) return null;
  const { lineA, lineB, min, max } = xyPaths(window);
  return { lineTemp: lineA, lineFeels: lineB, minC: min, maxC: max };
}

function ForecastMeta({ model, fetchedAtUtc }: { model: string; fetchedAtUtc: string }) {
  const theme = useTheme();
  const stamp = new Date(fetchedAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <Text variant="bodySm" color={theme.colors.textMuted}>
      {model} · fetched {stamp}
    </Text>
  );
}

function Unavailable({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Card flat style={{ gap: theme.spacing[1] }}>
      <Text variant="label" color={theme.colors.textSecondary}>
        {title}
      </Text>
      <Text variant="bodySm" color={theme.colors.textMuted}>
        Forecast unavailable.
      </Text>
    </Card>
  );
}

export type WindForecastCardProps = {
  hourly: HourlyForecastPoint[];
  model: string;
  fetchedAtUtc: string;
};

export function WindForecastCard({ hourly, model, fetchedAtUtc }: WindForecastCardProps) {
  const theme = useTheme();
  const header = windHeader(hourly);
  if (!header) return <Unavailable title="Wind" />;

  const chart = windDualLinePaths(hourly);
  const step = gustStep(header.gustKts);
  // Gust emphasis without a new hue (tokens.ts is deliberately monochrome,
  // no green/red anywhere) — 'elevated'/'building' read as bolder ink,
  // 'calm' as the card's normal weight.
  const headerWeight = step === 'elevated' ? ('700' as const) : step === 'building' ? ('600' as const) : undefined;

  return (
    <Card flat style={{ gap: theme.spacing[2] }}>
      <Text variant="label" color={theme.colors.textSecondary}>
        Wind
      </Text>
      <Text variant="dataLg" style={headerWeight ? { fontWeight: headerWeight } : undefined}>
        {windHeaderLabel(header)}
      </Text>
      {chart ? (
        <View>
          <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
            <Path d={chart.lineAvg} stroke={theme.colors.textMuted} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />
            <Path d={chart.lineGust} stroke={theme.colors.accent} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />
          </Svg>
          <Text variant="bodySm" color={theme.colors.textMuted}>
            avg (grey) · gust (dark) — next {Math.min(hourly.length, 24)} h
          </Text>
        </View>
      ) : null}
      <ForecastMeta model={model} fetchedAtUtc={fetchedAtUtc} />
    </Card>
  );
}

export type RainShineForecastCardProps = {
  hourly: HourlyForecastPoint[];
  daily: DailyForecastPoint[];
  model: string;
  fetchedAtUtc: string;
  /** Injectable for tests; defaults to Date.now(). */
  nowEpochSec?: number;
};

export function RainShineForecastCard({
  hourly,
  daily,
  model,
  fetchedAtUtc,
  nowEpochSec,
}: RainShineForecastCardProps) {
  const theme = useTheme();
  const rows = dailyRainShineRows(daily);
  if (rows.length === 0 && hourly.length === 0) return <Unavailable title="Rain / Shine" />;

  const headline = precipWindowHeadline(hourly, 24);
  const chart = tempDualLinePaths(hourly);
  const now = nowEpochSec ?? Math.floor(Date.now() / 1000);

  return (
    <Card flat style={{ gap: theme.spacing[2] }}>
      <Text variant="label" color={theme.colors.textSecondary}>
        Rain / Shine
      </Text>
      {headline ? (
        <Text variant="dataLg">{headline}</Text>
      ) : (
        <Text variant="bodySm" color={theme.colors.textMuted}>
          Not enough hourly data for a windowed total.
        </Text>
      )}
      {chart ? (
        <View>
          <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
            <Path d={chart.lineFeels} stroke={theme.colors.textMuted} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />
            <Path d={chart.lineTemp} stroke={theme.colors.accent} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />
          </Svg>
          <Text variant="bodySm" color={theme.colors.textMuted}>
            feels-like (grey) · actual (dark) — next {Math.min(hourly.length, 24)} h
          </Text>
        </View>
      ) : null}
      {rows.map((row) => {
        const faded = isBeyondFadeHorizon(row.dateEpochSec, now);
        const date = new Date(row.dateEpochSec * 1000).toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        return (
          <View
            key={row.dateEpochSec}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              opacity: faded ? 0.45 : 1,
            }}
          >
            <Text variant="bodySm">{date}</Text>
            <Text variant="dataSm">
              {row.probabilityPct !== undefined ? `${Math.round(row.probabilityPct)}%` : '—'}
              {' / '}
              {row.accumulationLabel ?? '—'}
              {row.tempMaxC !== undefined && row.tempMinC !== undefined
                ? ` · ${Math.round(row.tempMaxC)}°/${Math.round(row.tempMinC)}°C`
                : ''}
            </Text>
          </View>
        );
      })}
      <ForecastMeta model={model} fetchedAtUtc={fetchedAtUtc} />
    </Card>
  );
}
