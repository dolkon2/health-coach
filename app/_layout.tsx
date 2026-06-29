/**
 * Root layout. Loads fonts, installs the ThemeProvider and safe-area context,
 * and defines the navigation stack: the tab bar, plus Settings and the two log
 * modals layered on top.
 *
 * No splash, no onboarding, no auth — Phase 1 is the minimum useful loop.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, fontMap, darkColors, useTheme } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontMap);

  useEffect(() => {
    if (fontError) {
      console.warn('[fonts] failed to load', fontError);
    }
  }, [fontError]);

  // Hold on a themed background until fonts are ready (avoids a flash of
  // fallback type). Render nothing else — no splash screen by design.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: darkColors.bg }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialScheme="dark">
          <StatusBar style="light" />
          <ThemedStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.bg },
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontFamily: theme.fonts.display.semibold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen
        name="log-weigh-in"
        options={{ title: 'Log weigh-in', presentation: 'modal' }}
      />
      <Stack.Screen
        name="log-session"
        options={{ title: 'Log session', presentation: 'modal' }}
      />
      <Stack.Screen
        name="templates"
        options={{ title: 'Library', presentation: 'modal' }}
      />
      <Stack.Screen
        name="edit-template"
        options={{ title: 'Template', presentation: 'modal' }}
      />
    </Stack>
  );
}
