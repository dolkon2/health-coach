/**
 * appSettings.ts — the persisted app-settings shape (settings store, key
 * 'appSettings').
 *
 * Display preferences only: none of these change what's stored — weights stay
 * kg, distances stay metres (units.ts). The stored JSON may be a subset of
 * this type (saved before newer fields existed), so readers merge over
 * DEFAULT_SETTINGS instead of trusting the blob to be complete.
 */
import type { WeightUnit, DistanceUnit } from './units';
import type { NutritionFocus } from './foodLog';

export type Settings = {
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  nutritionFocus: NutritionFocus; // display-only: which macro renders large in food UI
  restTimerSec: number; // default between-sets rest; the gym timer starts from this.
  defaultPoolLengthM: number; // remembered pool length; the swim form prefills it.
  // Sky dimension — descriptive-only, never part of the USHPA ledger math
  // (core/src/ushpaLedger.ts). Absent until the user sets them; no default
  // rating is ever fabricated.
  ushpaNumber?: string;
  ushpaRating?: string;
};

export const DEFAULT_SETTINGS: Settings = {
  weightUnit: 'lb', // Dylan logs in pounds; storage stays kg (see units.ts).
  distanceUnit: 'km', // endurance distance; storage stays metres (see units.ts).
  nutritionFocus: 'calories', // the hero number; a lens over the data, never a gate on it.
  restTimerSec: 120, // 2 min between sets.
  defaultPoolLengthM: 25, // a 25 m pool is the common default.
};

/** Fill gaps in a stored blob with defaults — a save from an older app version
 *  stays valid as fields get added. Null (never saved) is all defaults. */
export function withDefaults(stored: Partial<Settings> | null): Settings {
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}
