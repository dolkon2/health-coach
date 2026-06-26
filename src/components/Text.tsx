/**
 * Text — the type system. One component, all brand-kit variants.
 *
 * Display = identity (headers, hero stats), always uppercase. Body = utility.
 * Data = honesty (every value the user might compare), tabular mono. Keeping
 * these registers distinct is a brand-kit rule, not a preference.
 */
import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme';
import type { TypeVariant } from '@/theme/tokens';

type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: string; // any theme color; defaults to the variant's natural color
  align?: 'left' | 'center' | 'right';
};

export function Text({
  variant = 'body',
  color,
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();

  // Sensible default colors per register.
  const defaultColor =
    variant === 'label' || variant === 'bodySm' || variant === 'dataSm'
      ? theme.colors.textSecondary
      : theme.colors.text;

  return (
    <RNText
      style={[
        theme.type[variant],
        { color: color ?? defaultColor },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}
