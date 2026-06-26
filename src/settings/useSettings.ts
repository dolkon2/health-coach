/**
 * useSettings — a stub settings hook (Pass 3).
 *
 * Real persisted settings (a Settings screen writing to storage) come later.
 * For now this returns fixed defaults so the rest of the app can read units
 * from one place instead of hard-coding them. When settings get persisted,
 * only this file changes — every caller keeps working.
 */
import type { WeightUnit, DistanceUnit } from '@/lib/units';

export type Settings = {
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
};

const DEFAULTS: Settings = {
  weightUnit: 'lb', // Dylan logs in pounds; storage stays kg (see units.ts).
  distanceUnit: 'km', // endurance distance; storage stays metres (see units.ts).
};

export function useSettings(): Settings {
  return DEFAULTS;
}
