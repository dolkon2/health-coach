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
// Side-effect import: registers the background recording task at module
// scope (Map Record M2). Must live at the app root — a task defined any
// later silently never fires on a cold background launch (research §2).
import '@/lib/recording/recordingTask';

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
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      {/* Reflect is now the residual benchmark-keyed tap-in (P8): reached from
          Profile — browsable, or keyed to one benchmark via ?benchmarkId=. */}
      <Stack.Screen name="reflect" options={{ title: 'Reflect' }} />
      <Stack.Screen name="stimulus-ledger" options={{ title: 'Stimulus ledger' }} />
      <Stack.Screen
        name="log-weigh-in"
        options={{ title: 'Log weigh-in', presentation: 'modal' }}
      />
      <Stack.Screen
        name="log-session"
        options={{ title: 'Log session', presentation: 'modal' }}
      />
      <Stack.Screen
        name="log-food"
        options={{ title: 'Log food', presentation: 'modal' }}
      />
      <Stack.Screen
        name="edit-template"
        options={{ title: 'Template', presentation: 'modal' }}
      />
      <Stack.Screen
        name="benchmarks"
        options={{ title: 'Benchmarks', presentation: 'modal' }}
      />
      <Stack.Screen
        name="edit-benchmark"
        options={{ title: 'Benchmark', presentation: 'modal' }}
      />
      <Stack.Screen
        name="body-profile"
        options={{ title: 'Body stats', presentation: 'modal' }}
      />
      <Stack.Screen
        name="gear"
        options={{ title: 'Gear', presentation: 'modal' }}
      />
      <Stack.Screen
        name="spots"
        options={{ title: 'Spots', presentation: 'modal' }}
      />
      <Stack.Screen
        name="spot/[id]"
        options={{ title: 'Spot', presentation: 'modal' }}
      />
    </Stack>
  );
}
