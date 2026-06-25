import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../tokens/colors';
import { spacing, borderRadius, shadow } from '../tokens/spacing';

type Elevation = 'flat' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  elevation?: Elevation;
  style?: ViewStyle;
}

export function Card({ children, elevation = 'sm', style }: CardProps) {
  return (
    <View style={[styles.card, elevation !== 'flat' && shadow[elevation], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.border,
  },
});
