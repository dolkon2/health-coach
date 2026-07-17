/**
 * Route detail — map-hero + efforts list (routes-spec P1/P2; map-tab.md §5:
 * "efforts-under-a-route are a scoped filtered view, not the logbook").
 * "Start session on this route" is the follow deep-link (routes-spec M4):
 * Record opens with the route preloaded as a muted guide line — no map
 * dependency here, Map owns the actual recording.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import type { ObservationOf } from '@core/observation';
import { routeDistanceM } from '@core/route';
import type { Route } from '@core/route';
import { Screen, Text, Card, Button, RouteMap } from '@/components';
import { iconFor } from '@/components/activityIcons';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { getRoute } from '@/storage/routes';
import { listSessionsForRoute } from '@/storage/observations';
import { activityById, elementOf } from '@/lib/activity';
import { formatDistance, type DistanceUnit } from '@/lib/units';
import { formatDurationClock } from '@/lib/date';

export default function RouteDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { distanceUnit } = useSettings();
  const [route, setRoute] = useState<Route | null | undefined>(undefined);
  const [efforts, setEfforts] = useState<ObservationOf<'session'>[]>([]);

  const reload = useCallback(async () => {
    if (!id) return;
    const r = await getRoute(id);
    setRoute(r);
    if (r) setEfforts(await listSessionsForRoute(r.id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (route === undefined) return <Screen scroll>{null}</Screen>;
  if (route === null) {
    return (
      <Screen scroll>
        <Text variant="body" color={theme.colors.textMuted}>
          This route no longer exists.
        </Text>
      </Screen>
    );
  }

  const activity = activityById(route.activityId);
  const Icon = activity ? iconFor(activity.icon) : undefined;
  const tint = theme.colors.element[activity ? elementOf(activity) : 'body'];
  const distanceM = routeDistanceM(route.points);

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
        {Icon ? <Icon size={24} color={tint} strokeWidth={1.5} /> : null}
        <View style={{ flex: 1 }}>
          <Text variant="displayMd">{route.name}</Text>
          {activity ? (
            <Text variant="label" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[1] }}>
              {activity.label}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: theme.spacing[5] }}>
        <RouteMap path={route.points} height={220} />
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing[6], marginTop: theme.spacing[4] }}>
        <View>
          <Text variant="label" color={theme.colors.textMuted}>
            Distance
          </Text>
          <Text variant="dataLg">{distanceM > 0 ? formatDistance(distanceM, distanceUnit) : '—'}</Text>
        </View>
        <View>
          <Text variant="label" color={theme.colors.textMuted}>
            Source
          </Text>
          <Text variant="dataLg">{sourceLabel(route.source)}</Text>
        </View>
      </View>

      {route.notes ? (
        <View style={{ marginTop: theme.spacing[6] }}>
          <Text variant="label" color={theme.colors.textSecondary}>
            Notes
          </Text>
          <Text variant="body" style={{ marginTop: theme.spacing[2] }}>
            {route.notes}
          </Text>
        </View>
      ) : null}

      {activity ? (
        <Button
          label="Start session on this route"
          style={{ marginTop: theme.spacing[6] }}
          onPress={() =>
            router.push({
              pathname: '/map',
              params: { routeId: route.id, activity: activity.id },
            })
          }
        />
      ) : null}

      <View style={{ marginTop: theme.spacing[8] }}>
        <Text variant="label" color={theme.colors.textSecondary}>
          Sessions on this route
        </Text>
        {efforts.length === 0 ? (
          <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
            No sessions have followed this route yet.
          </Text>
        ) : (
          <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[2] }}>
            {efforts.map((o) => (
              <EffortRow key={o.id} observation={o} distanceUnit={distanceUnit} />
            ))}
          </View>
        )}
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}

function sourceLabel(source: Route['source']): string {
  switch (source) {
    case 'gpx':
      return 'Imported';
    case 'session':
      return 'From a session';
    case 'snapped':
      return 'Snapped to trail';
    case 'river':
      return 'Snapped to river';
    case 'plotted':
      return 'Plotted';
  }
}

function EffortRow({
  observation,
  distanceUnit,
}: {
  observation: ObservationOf<'session'>;
  distanceUnit: DistanceUnit;
}) {
  const theme = useTheme();
  const date = new Date(observation.occurredAt).toLocaleDateString();
  const durationMin = observation.payload.durationMin;
  const distanceM = observation.payload.endurance?.distanceM;
  return (
    <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body">{date}</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        {durationMin != null ? (
          <Text variant="bodySm" color={theme.colors.textMuted}>
            {formatDurationClock(durationMin * 60)}
          </Text>
        ) : null}
        {distanceM != null && distanceM > 0 ? (
          <Text variant="bodySm" color={theme.colors.textMuted}>
            {formatDistance(distanceM, distanceUnit)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
