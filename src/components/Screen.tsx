/**
 * Screen — the standard page wrapper. Themed background + safe-area insets +
 * consistent screen-edge padding (space-6). Optionally scrollable.
 */
import React from 'react';
import { View, ScrollView, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
};

export function Screen({ children, scroll, style }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingTop: insets.top + theme.spacing[4],
    paddingHorizontal: theme.spacing[6],
    paddingBottom: theme.spacing[6],
  };

  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.bg }}
        contentContainerStyle={[padding, style]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.bg }, padding, style]}>
      {children}
    </View>
  );
}
