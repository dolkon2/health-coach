/**
 * SpotCard — one spot's card, shared by the Spots list (app/spots.tsx) and
 * Home's Pinned Spots glance module (H4, home-tab.md §3): pin/sport icon,
 * title, headline live reading (weather always; gauge/wind/swell when the
 * sport resolves one), and an honest "updated Xm ago" stamp. Null-honest —
 * a still-loading or failed fetch renders '—', never a fabricated reading.
 *
 * The icon tints with the spot's element (mirrors RouteCard.tsx's identical
 * pattern) rather than a separate dot — 2026-07-12, closing the gap where
 * Home's Spots/Benchmarks rows read as plain monochrome against the design
 * system's element-identity convention.
 */
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { Card } from './Card';
import { spotIcon } from './activityIcons';
import { useTheme } from '@/theme';
import { activityById, elementOf } from '@/lib/activity';
import { feedForSport } from '@core/conditions/feedForSport';
import { spotHeadlineReading, updatedAtLabel } from '@/lib/spotHeadline';
import type { CurrentConditions } from '@/lib/conditions/current';
import type { Spot } from '@core/spot';

export type SpotCardProps = {
  spot: Spot;
  current: CurrentConditions | undefined;
  onPress: () => void;
};

export function SpotCard({ spot, current, onPress }: SpotCardProps) {
  const theme = useTheme();
  const Icon = spotIcon(spot);
  const activity = spot.sport ? activityById(spot.sport) : undefined;
  const tint = theme.colors.element[activity ? elementOf(activity) : 'body'];
  const feed = feedForSport(spot.sport);
  const headline = spotHeadlineReading(feed, current);
  const stamp = updatedAtLabel(current, Date.now());

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${spot.name}`}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
          <Icon size={20} color={tint} strokeWidth={1.5} />
          <View style={{ flex: 1, gap: theme.spacing[1] }}>
            <Text variant="body">{spot.name}</Text>
            {stamp ? (
              <Text variant="bodySm" color={theme.colors.textMuted}>
                {stamp}
              </Text>
            ) : null}
          </View>
          <Text variant="dataSm">{headline}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
