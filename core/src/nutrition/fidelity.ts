/**
 * fidelity.ts — the pure fidelity math for food logging (Ring 2 / Pass 2.1).
 *
 * Fidelity is capture precision on 0..1. It is computed from *what the system
 * actually extracted* — never from which device or screen captured it (the
 * spec's "channel is irrelevant" rule). A weighed mass is a different
 * extraction than a described guess; a phone and a watch logging the same
 * weighed mass are not.
 *
 * This module owns four things and nothing else (no I/O, no network, no UI):
 *   - defaultFidelity(method, extraction): a starting fidelity from extraction.
 *   - fidelityCeiling(method): the per-method cap that systematic error can't
 *     erase (you can be consistently wrong about an eyeballed portion forever).
 *   - blendComposite(items): a multi-item meal's composite fidelity.
 *   - tierOf(fidelity) + the tier boundaries — THE ONLY fidelity numbers in the
 *     system that exist on purpose. They live here, in code, never on screen.
 *
 * All numeric bands below are first-draft, documented, tunable heuristics, per
 * the constitution's "heuristics are honest guesses with an error band" rule.
 * The displayed artifact is always a tier, never any of these numbers.
 */
import type { FoodItem, InputMethod } from '../observation';

// ─── Tier mapping (the only on-purpose numbers; spec § Fidelity display) ─────

export type FidelityTier = 'HIGH' | 'MID' | 'LOW';

/** ≥ this is HIGH. The single high/mid boundary, centralized here. */
export const TIER_HIGH_MIN = 0.8;
/** ≥ this (and below HIGH) is MID; anything lower is LOW. */
export const TIER_MID_MIN = 0.4;

/**
 * Map a 0..1 fidelity to its visual tier. HIGH ≥ 0.8, MID 0.4–0.8, LOW < 0.4
 * (0.8 is HIGH, 0.4 is MID — the bands are closed at their lower edge). These
 * two boundaries are the only fidelity numbers in the system, and they live in
 * code, not on screen.
 */
export function tierOf(fidelity: number): FidelityTier {
  if (fidelity >= TIER_HIGH_MIN) return 'HIGH';
  if (fidelity >= TIER_MID_MIN) return 'MID';
  return 'LOW';
}

// ─── Per-method ceilings (spec § The ceiling; plan § 3) ──────────────────────

/**
 * The highest fidelity each input method can ever reach, even after earning.
 * The ceiling encodes systematic error repetition can't remove — a photo-logged
 * meal eaten 50 times still has a visually-estimated portion. Tunable.
 */
const CEILINGS: Record<InputMethod, number> = {
  weighed: 0.98, // scale + DB lookup; only DB-level variance remains
  barcode: 0.85, // item identity strong; portion is package-vs-eyeball
  described: 0.7, // text/voice parse; portion language is loose
  photo: 0.55, // 2D portion estimation is fundamentally limited
};

/** The fidelity ceiling for an input method. Never exceeded by any log. */
export function fidelityCeiling(method: InputMethod): number {
  return CEILINGS[method];
}

// ─── Default (starting) fidelity from extraction ─────────────────────────────

/**
 * What a capture actually resolved — the basis for its fidelity, and the only
 * basis. Channel (phone vs watch vs web) never appears here. Callers populate
 * only the fields relevant to their method; the rest are ignored.
 */
export interface Extraction {
  /** `described`: a specific food was matched in the DB (vs unresolved text). */
  food?: boolean;
  /** `described`: a numeric portion quantity was captured. */
  quantity?: boolean;
  /** `described`: a unit accompanied the quantity (e.g. 'oz', 'g'). */
  unit?: boolean;
  /** `barcode`/OFF: 0..1 fraction of the required macros the record provides. */
  completeness?: number;
  /** `weighed`/USDA: Branded (label-declared) vs Foundation/SR Legacy (lab). */
  branded?: boolean;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Starting fidelity for a freshly captured item, derived purely from what the
 * method extracted. Always clamped to the method's ceiling so a default can
 * never exceed it. Defaults are first-draft, tunable bands (plan § 2 table):
 *
 *   weighed:   Foundation/SR ~0.95, Branded ~0.90 (label tolerance)         HIGH
 *   barcode:   complete ~0.80 → sparse ~0.55, scaled by record completeness  HIGH/MID
 *   described: food+qty+unit ~0.60 · food only ~0.30 · no food resolved ~0.15 MID/LOW
 *   photo:     ~0.35 (2D portion ceiling, by nature)                         LOW
 */
export function defaultFidelity(method: InputMethod, extraction: Extraction = {}): number {
  const ceiling = fidelityCeiling(method);
  let f: number;

  switch (method) {
    case 'weighed':
      // The user knows the mass; the residual uncertainty is the DB record.
      f = extraction.branded ? 0.9 : 0.95;
      break;
    case 'barcode':
      // Item identity is strong; completeness pulls portion/macro confidence.
      f = 0.55 + 0.25 * clamp01(extraction.completeness ?? 1); // 0.55 → 0.80
      break;
    case 'described':
      // Keys off what the parser got — nothing else. Voice vs text is the same.
      if (extraction.food && extraction.quantity && extraction.unit) f = 0.6;
      else if (extraction.food) f = 0.3; // a food but no pinned portion
      else f = 0.15; // free text that didn't even resolve a food
      break;
    case 'photo':
      f = 0.35;
      break;
  }

  return Math.min(f, ceiling);
}

// ─── Composite blend for multi-item meals ────────────────────────────────────

/**
 * A multi-item meal's composite fidelity: the equal-weighted mean of its items'
 * fidelities, each first clamped to its own ceiling. Two guarantees the
 * forensics layer relies on:
 *
 *   1. The result lies between the lowest and highest part — one rough item
 *      drags a meal down, one precise item can't paper over the rest.
 *   2. It never exceeds the highest per-item ceiling (every part is ≤ its own
 *      ceiling ≤ the max), so a mixed-method meal can't out-rank its best method.
 *
 * Equal weighting is the documented v1 heuristic; a kcal/mass-weighted blend is
 * a later refinement (it matters most for Phase 7 template composites). Returns
 * 0 for an empty meal — there is nothing to be confident about.
 */
export function blendComposite(items: readonly FoodItem[]): number {
  if (items.length === 0) return 0;
  const capped = items.map((it) => Math.min(it.fidelity, it.fidelityCeiling));
  const mean = capped.reduce((sum, f) => sum + f, 0) / capped.length;
  const maxCeiling = Math.max(...items.map((it) => it.fidelityCeiling));
  return Math.min(mean, maxCeiling);
}
