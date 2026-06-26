import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../tokens/colors';

type Level = 'high' | 'mid' | 'low';

interface FidelityIndicatorProps {
  level: Level;
}

const segmentCounts: Record<Level, number> = { high: 3, mid: 2, low: 1 };

export function FidelityIndicator({ level }: FidelityIndicatorProps) {
  const filled = segmentCounts[level];

  return (
    <View style={styles.container}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.segment,
            { height: 6 + i * 3 },
            i < filled ? styles.filled : styles.empty,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  segment: {
    width: 4,
    borderRadius: 1,
  },
  filled: {
    backgroundColor: colors.sandstone,
  },
  empty: {
    backgroundColor: colors.border,
  },
});
