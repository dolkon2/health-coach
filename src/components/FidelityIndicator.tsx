/**
 * FidelityIndicator — the product's signature visual element.
 *
 * A small signal-strength bar showing capture confidence. Three segments:
 * filled in sandstone, empty in border color. Always visible on food-log
 * entries and any AI-estimated value. Confidence is a visual property, not
 * metadata (constitution, north star). See planning/brand-kit.md.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { tierOf } from '@core/nutrition/fidelity';

export type FidelityLevel = 'high' | 'mid' | 'low';

const FILLED: Record<FidelityLevel, number> = { high: 3, mid: 2, low: 1 };

export function FidelityIndicator({ level }: { level: FidelityLevel }) {
  const theme = useTheme();
  const filled = FILLED[level];

  return (
    <View style={styles.row}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: 6 + i * 3,
            borderRadius: 1,
            backgroundColor: i < filled ? theme.colors.accent : theme.colors.border,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
});

/**
 * Map a 0..1 fidelity to a discrete level. The tier boundaries live in ONE place
 * now — core's `tierOf` (HIGH/MID/LOW). This just lowercases them for the legacy
 * segmented-bar API, so the 0.8/0.4 numbers are no longer duplicated here.
 */
export function fidelityLevel(value: number): FidelityLevel {
  const tier = tierOf(value);
  return tier === 'HIGH' ? 'high' : tier === 'MID' ? 'mid' : 'low';
}
