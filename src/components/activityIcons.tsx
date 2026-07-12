/**
 * activityIcons.tsx — maps `Activity.icon` (a name, kept platform-free in
 * lib/activity.ts) to its lucide component. Shared by every activity-tile
 * picker (Training tab, Home's element-picker sheet) so the icon set has one
 * place to update.
 */
import type { ComponentType } from 'react';
import {
  Dumbbell,
  Footprints,
  Bike,
  Mountain,
  Waves,
  Wind,
  Snowflake,
  Flower2,
  Backpack,
  HeartPulse,
  MapPin,
  Activity as ActivityIcon,
} from 'lucide-react-native';
import type { Spot } from '@core/spot';
import { activityById } from '@/lib/activity';

export type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export const ACTIVITY_ICONS: Record<string, IconCmp> = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  bike: Bike,
  mountain: Mountain,
  waves: Waves,
  wind: Wind,
  snowflake: Snowflake,
  flower: Flower2,
  backpack: Backpack,
  'heart-pulse': HeartPulse,
};

/** Unknown icon names fall back to a generic activity mark. */
export function iconFor(name: string): IconCmp {
  return ACTIVITY_ICONS[name] ?? ActivityIcon;
}

/** A spot's pin/sport icon: its tagged sport's icon, else a generic map pin.
 *  Shared by SpotCard (list/Home) and MapSurface's pins so the two never
 *  diverge on the spot→icon rule. */
export function spotIcon(spot: Spot): IconCmp {
  const activity = spot.sport ? activityById(spot.sport) : undefined;
  return activity ? iconFor(activity.icon) : MapPin;
}
