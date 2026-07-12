/**
 * RouteCard — a route row for the Training shelf and the full Routes list
 * (training-tab.md §3 C): name, activity icon, distance, an SVG RoutePreview
 * thumbnail (never a GL map per row), effort count when >0.
 */
import { Pressable, View } from 'react-native';
import { Map as MapIcon } from 'lucide-react-native';
import type { Route } from '@core/route';
import { routeDistanceM } from '@core/route';
import { Text } from './Text';
import { RoutePreview } from './RoutePreview';
import { iconFor } from './activityIcons';
import { useTheme } from '@/theme';
import { activityById, elementOf } from '@/lib/activity';
import { formatDistance, type DistanceUnit } from '@/lib/units';

export type RouteCardProps = {
  route: Route;
  distanceUnit: DistanceUnit;
  /** Sessions that followed this route; undefined while still loading (no
   *  count shown rather than a fabricated 0). */
  effortCount?: number;
  onPress: () => void;
};

export function RouteCard({ route, distanceUnit, effortCount, onPress }: RouteCardProps) {
  const theme = useTheme();
  const activity = activityById(route.activityId);
  const Icon = activity ? iconFor(activity.icon) : MapIcon;
  const tint = theme.colors.element[activity ? elementOf(activity) : 'body'];
  const distanceM = routeDistanceM(route.points);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open route ${route.name}`}
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        padding: theme.spacing[4],
        gap: theme.spacing[2],
        backgroundColor: theme.colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
        <Icon size={18} color={tint} strokeWidth={1.75} />
        <Text variant="body" style={{ flex: 1 }}>
          {route.name}
        </Text>
      </View>
      <RoutePreview path={route.points} height={64} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodySm" color={theme.colors.textMuted}>
          {distanceM > 0 ? formatDistance(distanceM, distanceUnit) : '—'}
        </Text>
        {effortCount != null && effortCount > 0 ? (
          <Text variant="bodySm" color={theme.colors.textMuted}>
            {effortCount} {effortCount === 1 ? 'session' : 'sessions'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
