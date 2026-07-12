/**
 * Tab bar — the locked five: Home · Training · Map · Nutrition · Social
 * (master-plan.md §2). Reflect left the bar with this swap; P8 retired its
 * temporary Settings door — the residual benchmark tap-in is now reached from
 * Profile. Map and Social are new (Social ships as a quiet placeholder —
 * social-tab.md S0).
 *
 * The top-right carries the shell-standard header cluster — avatar (→ Profile)
 * and gear (→ Settings) — on every tab (locked #1, profile-settings.md §2).
 * Neither is a tab, and neither ever badges: an unread dot on a persistent
 * header control is a push mechanism wearing an icon.
 *
 * Active = accent, inactive = text-muted (brand kit).
 */
import type { ReactNode } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  Apple,
  CalendarDays,
  Dumbbell,
  MapPin,
  Settings,
  User,
  Users,
} from 'lucide-react-native';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
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
        headerRight: () => <HeaderCluster />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <CalendarDays size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color }) => (
            <Dumbbell size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          // Full-bleed: the map runs under a transparent, floating header so the
          // avatar+gear cluster sits over it (map-tab.md §2). The sport-arm
          // control renders as an in-screen overlay.
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          tabBarIcon: ({ color }) => (
            <MapPin size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarIcon: ({ color }) => (
            <Apple size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => (
            <Users size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
    </Tabs>
  );
}

/**
 * The persistent top-right pair: avatar (→ Profile) then gear (→ Settings).
 * Shared by every tab via `headerRight`. Icon-only, never badged. Both controls
 * carry a bordered surface circle so they stay legible over the Map tab's
 * transparent, full-bleed basemap (a bare glyph washes out on bright tiles).
 */
function HeaderCluster() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[6],
      }}
    >
      <ClusterButton label="Your profile" onPress={() => router.push('/profile')}>
        <User size={16} color={theme.colors.textMuted} strokeWidth={1.5} />
      </ClusterButton>
      <ClusterButton label="Settings" onPress={() => router.push('/settings')}>
        <Settings size={16} color={theme.colors.textMuted} strokeWidth={1.5} />
      </ClusterButton>
    </View>
  );
}

/** A round, bordered header control — the shared chrome for avatar + gear. */
function ClusterButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={label}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}
