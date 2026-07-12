/**
 * activityIcons.tsx — maps `Activity.icon` (a name, kept platform-free in
 * lib/activity.ts) to its rendered component. Shared by every activity-tile
 * picker (Training tab, Home's element-picker sheet) so the icon set has one
 * place to update.
 *
 * 2026-07-12: `icon` now names one of the 28 brand glyphs in
 * `activityGlyphs.tsx` (the design system's own geometric icon vocabulary)
 * instead of a lucide icon — see that file for the shape defs. `iconFor()`
 * keeps its exact prior signature so no consumer needed to change.
 */
import type { ComponentType } from 'react';
import { MapPin } from 'lucide-react-native';
import type { Spot } from '@core/spot';
import { activityById } from '@/lib/activity';
import { ActivityGlyph, GLYPH_KEYS, isGlyphKey, type GlyphKey } from './activityGlyphs';

export type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type GlyphIconProps = { size?: number; color?: string; strokeWidth?: number };

function makeGlyphIcon(key: GlyphKey): IconCmp {
  return function GlyphIcon({ size, color, strokeWidth }: GlyphIconProps) {
    return <ActivityGlyph glyphKey={key} size={size} color={color} strokeWidth={strokeWidth} />;
  };
}

// Built once at module load — stable component references per key, so an
// icon's identity doesn't change across renders (avoids remount churn a
// fresh-closure-per-call approach would cause).
const GLYPH_COMPONENTS: Record<GlyphKey, IconCmp> = Object.fromEntries(
  GLYPH_KEYS.map((key) => [key, makeGlyphIcon(key)])
) as Record<GlyphKey, IconCmp>;

/** Unknown icon names fall back to a generic activity mark (hike). */
export function iconFor(name: string): IconCmp {
  return GLYPH_COMPONENTS[isGlyphKey(name) ? name : 'hike'];
}

/** A spot's pin/sport icon: its tagged sport's icon, else a generic map pin.
 *  Shared by SpotCard (list/Home) and MapSurface's pins so the two never
 *  diverge on the spot→icon rule. */
export function spotIcon(spot: Spot): IconCmp {
  const activity = spot.sport ? activityById(spot.sport) : undefined;
  return activity ? iconFor(activity.icon) : MapPin;
}
