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
            backgroundColor: i < filled ? theme.colors.sandstone : theme.colors.border,
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

/** Map a 0..1 fidelity number to a discrete level (data-model thresholds). */
export function fidelityLevel(value: number): FidelityLevel {
  if (value >= 0.8) return 'high';
  if (value >= 0.4) return 'mid';
  return 'low';
}
