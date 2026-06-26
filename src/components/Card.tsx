/**
 * Card — a surface container. Separation comes from the surface-color step,
 * not drop shadow (brand kit). `flat` removes the border for chart/data panels
 * that want hard, unmediated edges.
 */
import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme';

type CardProps = ViewProps & {
  raised?: boolean; // use the raised surface step (modals, active states)
  flat?: boolean; // no border (data panels / charts)
};

export function Card({ raised, flat, style, children, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: raised ? theme.colors.surfaceRaised : theme.colors.surface,
          borderRadius: theme.radius.md,
          padding: theme.spacing[4],
          borderWidth: flat ? 0 : 1,
          borderColor: theme.colors.border,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
