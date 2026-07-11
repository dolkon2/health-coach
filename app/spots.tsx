/**
 * Spots — the Pinned Spots list (pinned-spots-spec.md P2, "the mode home").
 * Reached from Training's "Spots →" header link (thin/temporary mount —
 * re-homes into the Templates ↔ Pinned Spots top swap once the tab shell
 * lands, per the spec). Every spot's sport tag resolves its conditions feed
 * automatically (feedForSport.ts); the headline reading is a LIVE fetch
 * (conditions/current.ts — never the session-freeze store), cached ~10min,
 * pull-to-refresh bypasses it.
 *
 * Grouped by sport, untagged last. Sort within a group: createdAt desc —
 * "most-recently-visited" (the spec's stated sort) needs a sessions-at-spot
 * query that doesn't exist yet (P3's listSessionsForSpot); this list uses
 * the honest fallback until that lands, not a fabricated visit ordering.
 */
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, SpotCard } from '@/components';
import { useTheme } from '@/theme';
import { listSpots } from '@/storage/spots';
import { fetchCurrentForSpots, type CurrentConditions } from '@/lib/conditions/current';
import { sortSpotsByRecency } from '@/lib/spotHeadline';
import { activityById } from '@/lib/activity';
import type { Spot } from '@core/spot';

const UNTAGGED_GROUP_KEY = '__untagged';

export default function SpotsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [current, setCurrent] = useState<Record<string, CurrentConditions>>({});
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async (bypassCache = false) => {
    const list = await listSpots();
    setSpots(list);
    setCurrent(await fetchCurrentForSpots(list, { bypassCache }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await reload(true);
    } finally {
      setRefreshing(false);
    }
  }

  const groups = useMemo(() => {
    if (!spots) return [];
    const byKey = new Map<string, { key: string; label: string; spots: Spot[] }>();
    for (const s of spots) {
      const key = s.sport ?? UNTAGGED_GROUP_KEY;
      const label = s.sport ? (activityById(s.sport)?.label ?? s.sport) : 'Untagged';
      const bucket = byKey.get(key) ?? { key, label, spots: [] };
      bucket.spots.push(s);
      byKey.set(key, bucket);
    }
    // Untagged always last (per the spec), alphabetical otherwise — one
    // comparator, not two independent sort passes.
    const sorted = [...byKey.values()].sort((a, b) => {
      if (a.key === UNTAGGED_GROUP_KEY || b.key === UNTAGGED_GROUP_KEY) {
        return a.key === UNTAGGED_GROUP_KEY ? 1 : -1;
      }
      return a.label.localeCompare(b.label);
    });
    for (const g of sorted) g.spots = sortSpotsByRecency(g.spots);
    return sorted;
  }, [spots]);

  const isEmpty = spots !== null && spots.length === 0;

  function openSpot(id: string) {
    router.push({ pathname: '/spot/[id]', params: { id } });
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Text variant="label" color={theme.colors.accent}>
        Spots
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        Your places
      </Text>

      <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[3] }}>
        Is it runnable, is it windy — your go-to places with live conditions. Spots
        are created while logging a Water or Wind session for now — the map pin
        picker and save-as-spot flows are a later pass.
      </Text>

      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[5] }}>
        {spots === null ? null : isEmpty ? (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              No spots yet. Pin one from the map, or save one from a logged session.
            </Text>
          </Card>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={{ gap: theme.spacing[3] }}>
              <Text variant="label" color={theme.colors.textMuted}>
                {group.label}
              </Text>
              {group.spots.map((s) => (
                <SpotCard key={s.id} spot={s} current={current[s.id]} onPress={() => openSpot(s.id)} />
              ))}
            </View>
          ))
        )}
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
