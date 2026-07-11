/**
 * Screen — the standard page wrapper. Themed background + consistent
 * screen-edge padding (space-6). Optionally scrollable.
 *
 * `footer` renders a non-scrolling row pinned to the bottom of the screen's
 * own content area — just above the tab bar boundary — for a persistent
 * primary action (Training's "Log Body Session", rework Session 4; the same
 * mechanism is meant for the Routes shelf's "Log Route Session" at Session
 * 9). Scrollable content gets extra bottom padding so the footer never
 * covers the last item. No `insets.bottom` on the footer itself: every
 * current caller is a tab screen, and the tab bar already reserves the
 * home-indicator safe area below it — a screen that uses `footer` outside a
 * tab navigator (flush with the physical bottom edge) would need to add its
 * own bottom inset.
 */
import React from 'react';
import { View, ScrollView, RefreshControl, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  footer?: React.ReactNode;
  /** Pull-to-refresh — only meaningful with `scroll`. Omit both to skip it. */
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Screen({ children, scroll, style, footer, refreshing, onRefresh }: ScreenProps) {
  const theme = useTheme();

  const padding: ViewStyle = {
    paddingTop: theme.spacing[4],
    paddingHorizontal: theme.spacing[6],
    paddingBottom: footer ? theme.spacing[10] : theme.spacing[6],
  };

  const content = scroll ? (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={[padding, style]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={theme.colors.accent} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, backgroundColor: theme.colors.bg }, padding, style]}>
      {children}
    </View>
  );

  if (!footer) return content;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {content}
      <View
        style={{
          paddingHorizontal: theme.spacing[6],
          paddingTop: theme.spacing[3],
          paddingBottom: theme.spacing[3],
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.bg,
        }}
      >
        {footer}
      </View>
    </View>
  );
}
