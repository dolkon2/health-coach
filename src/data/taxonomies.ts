/**
 * taxonomies.ts — typed loaders for the four vendored practice/PT taxonomies.
 *
 * All four JSON files were hand-built at research time (sources + rationale
 * live in each file's `_meta` block — kept in the vendored files, never
 * stripped) and are vendored VERBATIM:
 *
 * - yoga-styles.json — 10 styles for the practice surface's styleId picker.
 *   `typicalIntensity` is descriptive display metadata ONLY — never used to
 *   score a session. `mindfulnessEligible` gates the OPTIONAL HealthKit
 *   mindfulSession companion (P8; user-controlled, never auto-written).
 * - dance-taxonomy.json — 6 families × styles two-level picker + context
 *   tags. Barre carries `hkOverride: 'barre'` (kept ⚑ — it maps to HK's
 *   barre workout type instead of the dance family default in P8).
 * - mobility-zones.json — the 10-zone shared body vocabulary. ONE vocabulary,
 *   TWO uses (mobility tightness 1-5, PT pain 0-10) so the two can be laid
 *   over each other in Reflect with no mapping table. `sided` zones accept
 *   an optional BodySide; omitting side is always a legal, honest answer.
 * - rom-tests.json — 8 self-administerable ROM tests (romReading
 *   observations). The `validated` flag records whether the protocol has
 *   published criterion validity and MUST survive to the display layer (⚑) —
 *   the app shows raw values + trend only, no grading, no targets.
 *
 * Every picker fed from these lists keeps a free-text escape hatch — the
 * taxonomies are starter menus, not fences.
 */
import type { BodySide } from '@core/observation';

import rawDance from './dance-taxonomy.json';
import rawZones from './mobility-zones.json';
import rawRomTests from './rom-tests.json';
import rawYogaStyles from './yoga-styles.json';

// ─── Yoga styles ─────────────────────────────────────────────────────────────

export type YogaStyle = {
  id: string;
  label: string;
  descriptor: string;
  /** Descriptive display metadata only — never scores or judges a session. */
  typicalIntensity: 'low' | 'medium' | 'high';
  /** Gates the optional HK mindfulSession companion (P8). */
  mindfulnessEligible: boolean;
};

export function yogaStyles(): YogaStyle[] {
  return (rawYogaStyles as { styles: YogaStyle[] }).styles;
}

// ─── Dance taxonomy ──────────────────────────────────────────────────────────

export type DanceStyle = {
  id: string;
  label: string;
  descriptor?: string;
  /** HK workout-type override (barre) — beats the context-tag mapping in P8. */
  hkOverride?: string;
};

export type DanceFamily = {
  id: string;
  label: string;
  styles: DanceStyle[];
};

export type DanceContextTag = {
  id: string;
  label: string;
  /** Which HKWorkoutActivityType the tag implies (P8). */
  hkMapping: string;
};

export function danceFamilies(): DanceFamily[] {
  return (rawDance as { families: DanceFamily[] }).families;
}

export function danceContextTags(): DanceContextTag[] {
  return (rawDance as unknown as { contextTags: DanceContextTag[] }).contextTags;
}

// ─── Mobility / pain body zones ──────────────────────────────────────────────

export type MobilityZone = {
  id: string;
  label: string;
  /** True = accepts an optional BodySide; false = midline structure. */
  sided: boolean;
};

export function mobilityZones(): MobilityZone[] {
  return (rawZones as { zones: MobilityZone[] }).zones;
}

/** Legal side values for a sided zone (side itself is always optional). */
export const ZONE_SIDES: readonly BodySide[] = ['left', 'right', 'both'];

// ─── ROM tests ───────────────────────────────────────────────────────────────

export type RomTest = {
  id: string;
  name: string;
  unit: 'cm' | 'degrees';
  /** True = left and right are stored as separate readings. */
  perSide: boolean;
  /** Display direction only — never a target or a grade. */
  higherIsBetter: boolean;
  /** Published criterion validity exists — must survive to display (⚑). */
  validated: boolean;
  /** Household-tools protocol text, shown at entry time. */
  protocol: string;
};

export function romTests(): RomTest[] {
  return (rawRomTests as { tests: RomTest[] }).tests;
}

export function romTestById(id: string): RomTest | undefined {
  return romTests().find((t) => t.id === id);
}
