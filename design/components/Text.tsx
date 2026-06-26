import React from 'react';
import { Text as RNText, StyleSheet, TextStyle } from 'react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';

type Variant =
  | 'displayXl' | 'displayLg' | 'displayMd'
  | 'body' | 'bodySm'
  | 'label'
  | 'dataLg' | 'data' | 'dataSm';

interface TextProps {
  children: React.ReactNode;
  variant?: Variant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: TextStyle;
  numberOfLines?: number;
}

export function Text({
  children,
  variant = 'body',
  color,
  align = 'left',
  style,
  numberOfLines,
}: TextProps) {
  return (
    <RNText
      style={[
        styles[variant],
        color ? { color } : undefined,
        { textAlign: align },
        style,
      ]}
      numberOfLines={numberOfLines}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  displayXl: {
    fontFamily: `${typography.fontFamily.display}_700Bold`,
    ...typography.display.xl,
    color: colors.text,
    textTransform: 'uppercase',
  },
  displayLg: {
    fontFamily: `${typography.fontFamily.display}_700Bold`,
    ...typography.display.lg,
    color: colors.text,
    textTransform: 'uppercase',
  },
  displayMd: {
    fontFamily: `${typography.fontFamily.display}_600SemiBold`,
    ...typography.display.md,
    color: colors.text,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: `${typography.fontFamily.body}_400Regular`,
    ...typography.body.base,
    color: colors.text,
  },
  bodySm: {
    fontFamily: `${typography.fontFamily.body}_400Regular`,
    ...typography.body.sm,
    color: colors.textSecondary,
  },
  label: {
    fontFamily: `${typography.fontFamily.body}_500Medium`,
    ...typography.label.base,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  dataLg: {
    fontFamily: `${typography.fontFamily.data}_500Medium`,
    ...typography.data.lg,
    color: colors.text,
  },
  data: {
    fontFamily: `${typography.fontFamily.data}_400Regular`,
    ...typography.data.base,
    color: colors.textSecondary,
  },
  dataSm: {
    fontFamily: `${typography.fontFamily.data}_400Regular`,
    ...typography.data.sm,
    color: colors.textMuted,
  },
});
