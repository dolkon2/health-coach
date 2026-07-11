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
  Activity as ActivityIcon,
} from 'lucide-react-native';

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
