/**
 * Spot detail — a minimal tap-in for now: name, sport, notes, and live
 * conditions (weather always, gauge when the sport resolves one). Full P3
 * (session log beneath, edit/rename/re-tag, gauge-link search affordance)
 * is a later pass — this stub exists so the list's and Home's "tap → spot
 * detail" routing (pinned-spots-spec.md, home-tab.md §5) has somewhere real
 * to land rather than a dead route, per the P1/P2 scope this session built.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { Screen, Text, Card } from '@/components';
import { iconFor } from '@/components/activityIcons';
import { useTheme } from '@/theme';
import { getSpot } from '@/storage/spots';
import { fetchCurrentForSpot, type CurrentConditions } from '@/lib/conditions/current';
import { spotHeadlineReading, updatedAtLabel } from '@/lib/spotHeadline';
import { feedForSport } from '@core/conditions/feedForSport';
import { activityById } from '@/lib/activity';
import type { Spot } from '@core/spot';

export default function SpotDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null | undefined>(undefined);
  const [current, setCurrent] = useState<CurrentConditions | undefined>(undefined);

  const reload = useCallback(async () => {
    if (!id) return;
    const s = await getSpot(id);
    setSpot(s);
    if (s) setCurrent(await fetchCurrentForSpot(s));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (spot === undefined) return <Screen scroll>{null}</Screen>;
  if (spot === null) {
    return (
      <Screen scroll>
        <Text variant="body" color={theme.colors.textMuted}>
          This spot no longer exists.
        </Text>
      </Screen>
    );
  }

  const activity = spot.sport ? activityById(spot.sport) : undefined;
  const Icon = activity ? iconFor(activity.icon) : MapPin;
  const feed = feedForSport(spot.sport);
  const headline = spotHeadlineReading(feed, current);
  const stamp = updatedAtLabel(current, Date.now());

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
        <Icon size={24} color={theme.colors.accent} strokeWidth={1.5} />
        <View style={{ flex: 1 }}>
          <Text variant="displayMd">{spot.name}</Text>
          {activity ? (
            <Text variant="label" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[1] }}>
              {activity.label}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: theme.spacing[6] }}>
        <Card style={{ gap: theme.spacing[1] }}>
          <Text variant="label" color={theme.colors.textSecondary}>
            Conditions
          </Text>
          <Text variant="dataLg">{headline}</Text>
          {stamp ? (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              {stamp}
            </Text>
          ) : null}
          {feed === 'gauge' && !spot.gaugeSiteId ? (
            <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[1] }}>
              No gauge linked yet.
            </Text>
          ) : null}
        </Card>
      </View>

      {spot.notes ? (
        <View style={{ marginTop: theme.spacing[6] }}>
          <Text variant="label" color={theme.colors.textSecondary}>
            Notes
          </Text>
          <Text variant="body" style={{ marginTop: theme.spacing[2] }}>
            {spot.notes}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing[8] }}>
        <Text variant="bodySm" color={theme.colors.textMuted}>
          Session history and editing for this spot are coming in a later pass.
        </Text>
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
