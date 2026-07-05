/**
 * Splits — per-km / per-mile pace, drawn as a quiet rhythm of bars.
 *
 * Display-only over the pure splits() series (lib/splits.ts): the engine owns
 * the arithmetic, this only lays it out. Renders nothing when splits() is null —
 * an untimed track (planned GPX, no timestamps) has no pace, and a routeless or
 * untimed session is complete, not broken (gps-mapping-spec.md; constitution:
 * absent, never fabricated). Bar length ∝ speed, scaled to the fastest split, so
 * the fast stretches read at a glance without any leaderboard.
 */
import React from 'react';
import { View } from 'react-native';
import type { GeoPoint } from '@core/observation';
import { useTheme } from '@/theme';
import { splits, type Split } from '@/lib/splits';
import { metersToDisplay, type DistanceUnit } from '@/lib/units';
import { Text } from './Text';

/** Seconds → "m:ss". */
function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type SplitsProps = {
  points: GeoPoint[];
  unit: DistanceUnit;
};

export function Splits({ points, unit }: SplitsProps) {
  const theme = useTheme();
  const rows = splits(points, unit);
  if (!rows) return null;

  // Fastest (lowest) pace anchors the bars — that split's bar is full width.
  const fastestPace = Math.min(...rows.map((r) => r.paceSecPerUnit));

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Text variant="label">Splits</Text>
      <View style={{ gap: theme.spacing[1] }}>
        {rows.map((r) => (
          <SplitRow key={r.index} split={r} unit={unit} fastestPace={fastestPace} />
        ))}
      </View>
    </View>
  );
}

function SplitRow({
  split,
  unit,
  fastestPace,
}: {
  split: Split;
  unit: DistanceUnit;
  fastestPace: number;
}) {
  const theme = useTheme();
  // Full splits read as their unit number; the trailing partial shows its length.
  const label = split.isPartial
    ? `${metersToDisplay(split.distanceM, unit).toFixed(2)} ${unit}`
    : String(split.index);
  const frac =
    split.paceSecPerUnit > 0 ? Math.min(1, fastestPace / split.paceSecPerUnit) : 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
      <Text variant="dataSm" color={theme.colors.textSecondary} style={{ width: 52 }}>
        {label}
      </Text>
      <View
        style={{ flex: 1, height: 6, backgroundColor: theme.colors.border }}
        accessibilityLabel={`Split ${split.index} pace ${clock(split.paceSecPerUnit)} per ${unit}`}
      >
        <View
          style={{
            width: `${Math.round(frac * 100)}%`,
            height: 6,
            backgroundColor: theme.colors.sandstone,
          }}
        />
      </View>
      <Text
        variant="dataSm"
        color={theme.colors.text}
        style={{ width: 72, textAlign: 'right' }}
      >
        {clock(split.paceSecPerUnit)} /{unit}
      </Text>
    </View>
  );
}
