import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../tokens/colors';
import { spacing, borderRadius } from '../tokens/spacing';

interface CardProps {
  children: React.ReactNode;
  raised?: boolean;
  style?: ViewStyle;
}

export function Card({ children, raised = false, style }: CardProps) {
  return (
    <View style={[styles.card, raised && styles.raised, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
  },
  raised: {
    backgroundColor: colors.surfaceRaised,
  },
});
