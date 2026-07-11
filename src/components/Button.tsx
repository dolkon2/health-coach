/**
 * Button — primary actions. Sandstone fill for the main CTA; quieter variants
 * for everything else. Labels use the body font, uppercase, tracked.
 */
import React from 'react';
import {
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

const PADDING: Record<Size, { v: number; h: number }> = {
  sm: { v: 8, h: 16 },
  md: { v: 12, h: 24 },
  lg: { v: 16, h: 32 },
};

const LABEL_SIZE: Record<Size, number> = { sm: 11, md: 13, lg: 15 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const bg: Record<Variant, string> = {
    primary: theme.colors.accent,
    secondary: theme.colors.surfaceRaised,
    outline: 'transparent',
    ghost: 'transparent',
  };
  const fg: Record<Variant, string> = {
    primary: theme.colors.bg,
    secondary: theme.colors.text,
    outline: theme.colors.accent,
    ghost: theme.colors.accent,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg[variant],
          borderRadius: theme.radius.md,
          paddingVertical: PADDING[size].v,
          paddingHorizontal: PADDING[size].h,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: theme.colors.borderStrong,
          opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? theme.colors.bg : theme.colors.accent}
          size="small"
        />
      ) : (
        <Text
          variant="label"
          color={fg[variant]}
          style={{ fontSize: LABEL_SIZE[size], fontFamily: theme.fonts.body.semibold }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
