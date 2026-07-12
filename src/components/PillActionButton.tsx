/**
 * PillActionButton — the persistent footer action's quiet pill treatment:
 * a small solid glyph + label on a bordered surface fill, matching the
 * mockup's `LogBar`/`TrainingActionBar` exactly. Deliberately NOT the shared
 * `Button` component's variants (2026-07-12, Dylan) — used wherever a
 * screen's primary action lives in a `Screen footer` (Home's Log Session /
 * Log Food, Training's Log Body Session / Create Route, Nutrition's Log
 * food) so all three read as one consistent system without resizing
 * `Button` itself, which is shared by every other screen in the app.
 *
 * The glyph identifies the ACTION, not the screen: `DiamondGlyph` for any
 * "start a session" action (Log Session, Log Body Session, and — per the
 * mockup's own precedent — Create Route, which reuses the same generic
 * action glyph rather than a route-specific one), `TriangleGlyph` for any
 * "log food" action, wherever it appears.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/theme';

export function PillActionButton({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[2],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing[3] + 1,
      }}
    >
      {icon}
      <Text variant="label" color={theme.colors.textSecondary}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A small filled diamond (rotated square) — any "start a session" action. */
export function DiamondGlyph({ color }: { color: string }) {
  return (
    <View
      style={{ width: 10, height: 10, backgroundColor: color, transform: [{ rotate: '45deg' }] }}
    />
  );
}

/** A small filled triangle (border trick) — any "log food" action. */
export function TriangleGlyph({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: 5.5,
        borderRightWidth: 5.5,
        borderBottomWidth: 9.5,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }}
    />
  );
}
