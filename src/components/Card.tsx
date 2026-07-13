/**
 * Card — a surface container. Separation comes from the card border + a light
 * shadow on top (design system: hairline-border-first elevation — see
 * planning/design-system/tokens/radius-shadow.css). `surface`/`surfaceRaised`
 * are both white in the light kit, so `raised` no longer differs by fill —
 * it lifts the card with `theme.shadow.sm` instead. `flat` removes the border
 * for chart/data panels that want hard, unmediated edges.
 */
import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme';

type CardProps = ViewProps & {
  raised?: boolean; // lift with a light shadow (modals, active states)
  flat?: boolean; // no border (data panels / charts)
};

export function Card({ raised, flat, style, children, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.md,
          padding: theme.spacing[4],
          borderWidth: flat ? 0 : 1,
          borderColor: theme.colors.border,
        },
        raised ? theme.shadow.sm : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
