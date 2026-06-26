/**
 * Tab bar — two tabs in Phase 1: Today and Reflect. Settings is a gear icon in
 * the top-right, not a tab (the four-tab IA is the destination; we only have
 * two tabs' worth of data yet).
 *
 * Active = sandstone, inactive = text-muted (brand kit).
 */
import { Tabs, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { CalendarDays, LineChart, Settings } from 'lucide-react-native';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.sandstone,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.body.medium,
          fontSize: 11,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTitle: '',
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            style={{ paddingHorizontal: theme.spacing[6] }}
          >
            <Settings size={22} color={theme.colors.textMuted} strokeWidth={1.5} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <CalendarDays size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="reflect"
        options={{
          title: 'Reflect',
          tabBarIcon: ({ color }) => (
            <LineChart size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
    </Tabs>
  );
}
