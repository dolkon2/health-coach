import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { colors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { spacing, borderRadius } from '../tokens/spacing';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.bg : colors.sandstone}
          size="small"
        />
      ) : (
        <Text style={[styles.label, labelVariantStyles[variant], labelSizeStyles[size]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    flexDirection: 'row',
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: `${typography.fontFamily.body}_600SemiBold`,
    letterSpacing: typography.label.base.letterSpacing,
    textTransform: 'uppercase',
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.sandstone },
  secondary: { backgroundColor: colors.surfaceRaised },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.borderStrong },
  ghost: { backgroundColor: 'transparent' },
});

const sizeStyles = StyleSheet.create({
  sm: { paddingVertical: spacing[2], paddingHorizontal: spacing[4] },
  md: { paddingVertical: spacing[3], paddingHorizontal: spacing[6] },
  lg: { paddingVertical: spacing[4], paddingHorizontal: spacing[8] },
});

const labelVariantStyles = StyleSheet.create({
  primary: { color: colors.bg },
  secondary: { color: colors.text },
  outline: { color: colors.sandstone },
  ghost: { color: colors.sandstone },
});

const labelSizeStyles = StyleSheet.create({
  sm: { fontSize: 11 },
  md: { fontSize: 13 },
  lg: { fontSize: 15 },
});
