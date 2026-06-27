/**
 * StimulusLedger — weekly training volume by movement pattern, as a stacked bar
 * chart (one bar per ISO week, current + 7 prior). Built on the chart-series
 * palette (sage / sandstone / clay / slate) — earth tones, never green/red
 * (brand kit). Hard-edged bars: the data is unmediated.
 *
 * Tap a week to drill into the sessions that contributed — each rendered through
 * the engine's own reveal() line, so the ledger and Today speak with one voice.
 *
 * Volume load is engine-native kg, like reveal() (quirk 6). Climb/hike/other
 * sessions carry no measurable pattern volume, so weeks heavy on those read
 * lighter than they trained — known gap (see quirks), surfaced honestly rather
 * than faked.
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import type { MovementPattern, ObservationId, ObservationOf } from '@core/observation';
import { reveal, type StimulusLedgerWeek } from '@core/stimulus';
import { useTheme } from '@/theme';
import { Text } from './Text';

// A week needs this many sessions before the per-pattern picture is meaningful
// (acceptance #4). Below it we still show real data — we just say it's thin.
const MEANINGFUL_SESSIONS = 4;

const BAR_AREA_HEIGHT = 170;
const Y_AXIS_WIDTH = 38;
const TOP_PAD = 12;
const BOTTOM_PAD = 22; // week labels
const BAR_FILL = 0.6; // bar width as a fraction of its slot

type StimulusLedgerProps = {
  weeks: StimulusLedgerWeek[];
  sessionsById: Map<ObservationId, ObservationOf<'session'>>;
};

function weekTotalKg(week: StimulusLedgerWeek): number {
  return Object.values(week.byPattern).reduce((sum, p) => sum + p.volumeLoadKg, 0);
}

/** 'YYYY-MM-DD' (a Monday) -> 'M/D'. */
function shortDate(localDate: string): string {
  const [, m, d] = localDate.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function groupThousands(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function StimulusLedger({ weeks, sessionsById }: StimulusLedgerProps) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  // Default the drill-down to the most recent week that has sessions.
  const lastWithSessions = useMemo(() => {
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (weeks[i].sessionIds.length > 0) return i;
    }
    return null;
  }, [weeks]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const activeWeek = selectedWeek ?? lastWithSessions;

  // A stable pattern -> palette-color map, ranked by total volume so the biggest
  // pattern is always series-1. >4 patterns cycle the four series colors; the
  // legend disambiguates (brand kit only defines four chart-series colors).
  const palette = [
    theme.colors.trendLine, // series-1, sage
    theme.colors.sandstone, // series-2, gold
    theme.colors.clay, // series-3, terracotta
    theme.colors.slate, // series-4, cool stone
  ];
  const { patternColor, orderedPatterns } = useMemo(() => {
    const totals = new Map<MovementPattern, number>();
    for (const w of weeks) {
      for (const [pattern, v] of Object.entries(w.byPattern) as [
        MovementPattern,
        { sets: number; volumeLoadKg: number },
      ][]) {
        totals.set(pattern, (totals.get(pattern) ?? 0) + v.volumeLoadKg);
      }
    }
    const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
    const color = new Map<MovementPattern, string>();
    ordered.forEach((p, i) => color.set(p, palette[i % palette.length]));
    return { patternColor: color, orderedPatterns: ordered };
  }, [weeks]);

  const totalSessions = weeks.reduce((n, w) => n + w.sessionIds.length, 0);
  const maxWeekKg = Math.max(0, ...weeks.map(weekTotalKg));

  // ── Whole-window empty state: never hide the component ────────────────────────
  if (totalSessions === 0) {
    return (
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Stimulus ledger</Text>
        <View style={panel(theme)}>
          <Text variant="body" color={theme.colors.textMuted}>
            Log sessions and your weekly volume by movement pattern shows up here.
          </Text>
        </View>
      </View>
    );
  }

  const innerH = BAR_AREA_HEIGHT - TOP_PAD - BOTTOM_PAD;
  const baselineY = TOP_PAD + innerH;
  const plotWidth = Math.max(0, containerWidth - Y_AXIS_WIDTH);
  const slot = plotWidth / weeks.length;
  const barWidth = slot * BAR_FILL;
  const yTicks = maxWeekKg > 0 ? [0, maxWeekKg / 2, maxWeekKg] : [0];

  const noLiftVolume = maxWeekKg === 0;
  const anyMeaningfulWeek = weeks.some((w) => w.sessionIds.length >= MEANINGFUL_SESSIONS);

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text variant="label">Stimulus ledger</Text>
        <Text variant="dataSm" color={theme.colors.textMuted}>
          volume load (kg)
        </Text>
      </View>

      <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row' }}>
        {/* Fixed y-axis strip */}
        <Svg width={Y_AXIS_WIDTH} height={BAR_AREA_HEIGHT}>
          {yTicks.map((v, i) => {
            const y = baselineY - (maxWeekKg > 0 ? (v / maxWeekKg) * innerH : 0);
            return (
              <SvgText
                key={i}
                x={Y_AXIS_WIDTH - 6}
                y={y + 4}
                fontSize={11}
                fontFamily={theme.fonts.data.regular}
                fill={theme.colors.textMuted}
                textAnchor="end"
              >
                {groupThousands(v)}
              </SvgText>
            );
          })}
        </Svg>

        {containerWidth > 0 ? (
          <Svg width={plotWidth} height={BAR_AREA_HEIGHT}>
            {/* baseline */}
            <Line
              x1={0}
              x2={plotWidth}
              y1={baselineY}
              y2={baselineY}
              stroke={theme.colors.border}
              strokeOpacity={0.5}
              strokeWidth={1}
            />

            {weeks.map((week, wi) => {
              const x = wi * slot + (slot - barWidth) / 2;
              const isActive = wi === activeWeek;
              let cursorY = baselineY;

              // Stacked segments, biggest-volume pattern at the bottom.
              const segments = orderedPatterns
                .filter((p) => week.byPattern[p])
                .map((pattern) => {
                  const vol = week.byPattern[pattern].volumeLoadKg;
                  const h = maxWeekKg > 0 ? (vol / maxWeekKg) * innerH : 0;
                  cursorY -= h;
                  return (
                    <Rect
                      key={pattern}
                      x={x}
                      y={cursorY}
                      width={barWidth}
                      height={Math.max(0, h)}
                      fill={patternColor.get(pattern)}
                    />
                  );
                });

              return (
                <React.Fragment key={week.weekStart}>
                  {segments}
                  {/* active-week marker */}
                  {isActive ? (
                    <Rect
                      x={wi * slot + 2}
                      y={baselineY + 3}
                      width={slot - 4}
                      height={2}
                      fill={theme.colors.sandstone}
                    />
                  ) : null}
                  <SvgText
                    x={wi * slot + slot / 2}
                    y={BAR_AREA_HEIGHT - 6}
                    fontSize={11}
                    fontFamily={theme.fonts.data.regular}
                    fill={isActive ? theme.colors.text : theme.colors.textMuted}
                    textAnchor="middle"
                  >
                    {shortDate(week.weekStart)}
                  </SvgText>
                  {/* Full-column tap target, drawn last so the entire column —
                      bar area AND the date label — reliably selects the week,
                      even on empty weeks. */}
                  <Rect
                    x={wi * slot}
                    y={0}
                    width={slot}
                    height={BAR_AREA_HEIGHT}
                    fill="transparent"
                    onPress={() => setSelectedWeek(wi)}
                  />
                </React.Fragment>
              );
            })}
          </Svg>
        ) : null}
      </View>

      {/* Honest caveats */}
      {noLiftVolume ? (
        <Text variant="dataSm" color={theme.colors.textMuted}>
          No lifting volume in this window — bars show weight-training load only.
        </Text>
      ) : !anyMeaningfulWeek ? (
        <Text variant="dataSm" color={theme.colors.textMuted}>
          Patterns sharpen once a week has {MEANINGFUL_SESSIONS}+ sessions.
        </Text>
      ) : null}

      {/* Legend */}
      {orderedPatterns.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3], marginTop: theme.spacing[1] }}>
          {orderedPatterns.map((pattern) => (
            <View key={pattern} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] }}>
              <View style={{ width: 10, height: 10, backgroundColor: patternColor.get(pattern) }} />
              <Text variant="dataSm" color={theme.colors.textSecondary}>
                {pattern}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Drill-down: the sessions that built the selected week */}
      {activeWeek != null ? (
        <WeekDrillDown week={weeks[activeWeek]} sessionsById={sessionsById} />
      ) : null}
    </View>
  );
}

function WeekDrillDown({
  week,
  sessionsById,
}: {
  week: StimulusLedgerWeek;
  sessionsById: Map<ObservationId, ObservationOf<'session'>>;
}) {
  const theme = useTheme();
  const sessions = week.sessionIds
    .map((id) => sessionsById.get(id))
    .filter((s): s is ObservationOf<'session'> => s != null);

  return (
    <View style={{ gap: theme.spacing[2], marginTop: theme.spacing[2] }}>
      <Text variant="label" color={theme.colors.sandstone}>
        Week of {shortDate(week.weekStart)}
      </Text>
      {sessions.length === 0 ? (
        <Text variant="bodySm" color={theme.colors.textMuted}>
          No sessions this week.
        </Text>
      ) : (
        sessions.map((s) => (
          <View
            key={s.id}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing[3] }}
          >
            <Text variant="bodySm" color={theme.colors.text} style={{ flexShrink: 1 }}>
              {reveal(s)}
            </Text>
            <Text variant="dataSm" color={theme.colors.textMuted}>
              {s.payload.modality}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function panel(theme: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 0, // hard edges — data panel (brand kit)
    padding: theme.spacing[4],
    minHeight: 100,
    justifyContent: 'center' as const,
  };
}
