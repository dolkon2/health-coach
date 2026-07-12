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
import { Settings, User } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/theme';

/**
 * Tab icons — the brand's own geometric vocabulary (ring, diamond, dot-path,
 * triangle, two-circles), ported from the design system's `TabBar.jsx`
 * reference / `ui_kits/mobile-app`'s own tab bar (2026-07-12), replacing the
 * generic lucide set (calendar/dumbbell/pin/apple/people) this shipped with
 * originally. Shape carries identity; color stays the tab's active/inactive
 * tint, never an element hue.
 */
function HomeTabIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={7} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}
function TrainingTabIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M9 2 L16 9 L9 16 L2 9 Z" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
function MapTabIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={16} viewBox="0 0 16 13">
      <Circle cx={2} cy={9} r={1.6} fill={color} />
      <Circle cx={7} cy={6} r={1.6} fill={color} />
      <Circle cx={12} cy={8} r={1.6} fill={color} />
      <Path d="M1 11 L7 4 L15 2" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
function NutritionTabIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={16} viewBox="0 0 14 12">
      <Path d="M7 0.5 L13.5 11.5 L0.5 11.5 Z" fill={color} />
    </Svg>
  );
}
function SocialTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={16} viewBox="0 0 18 13">
      <Circle cx={6} cy={6.5} r={4} fill="none" stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={6.5} r={4} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

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
          tabBarIcon: ({ color }) => <HomeTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: ({ color }) => <TrainingTabIcon color={color} />,
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
          tabBarIcon: ({ color }) => <MapTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarIcon: ({ color }) => <NutritionTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color }) => <SocialTabIcon color={color} />,
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
