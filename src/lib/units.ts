/**
 * units.ts — weight unit conversion + display.
 *
 * Storage is always kg (the engine's native unit; data-model.md). The UI lets
 * the user enter and read whichever unit they prefer. Conversion lives here so
 * exactly one place knows the factor.
 */

export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'km' | 'mi';

const LB_PER_KG = 2.2046226218;
const M_PER_KM = 1000;
const M_PER_MI = 1609.344;

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

/** e.g. "172.4 lb". One decimal — the precision a bathroom scale actually has. */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${kgToDisplay(kg, unit).toFixed(1)} ${unit}`;
}

/** A signed delta in the display unit, e.g. "↓ 0.9 lb" / "↑ 1.2 lb". null stays null. */
export function formatDelta(deltaKg: number, unit: WeightUnit): string {
  const d = kgToDisplay(Math.abs(deltaKg), unit);
  const arrow = deltaKg < 0 ? '↓' : deltaKg > 0 ? '↑' : '→';
  return `${arrow} ${d.toFixed(1)} ${unit}`;
}

// ─── Distance ────────────────────────────────────────────────────────────────
// Storage is always metres (the engine's native unit, like kg for weight). The
// UI lets the user enter and read km or mi; conversion lives here, one place.

export function metersToDisplay(m: number, unit: DistanceUnit): number {
  return unit === 'mi' ? m / M_PER_MI : m / M_PER_KM;
}

export function displayToMeters(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value * M_PER_MI : value * M_PER_KM;
}

/** e.g. "8.20 km". Two decimals — the precision a phone GPS roughly claims. */
export function formatDistance(m: number, unit: DistanceUnit): string {
  return `${metersToDisplay(m, unit).toFixed(2)} ${unit}`;
}
