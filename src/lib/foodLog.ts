/**
 * foodLog.ts — the food-logging model, pure and platform-free so the screen and
 * the tests drive the same path (mirrors session.ts). No React, no storage here.
 *
 * Covers the two Phase-2 input methods: `weighed` (search a food, enter the mass)
 * and `described` (type "8 oz ribeye" → parse → DB match). It assembles resolved
 * FoodItems into a foodEntry Observation: the flat macros are the rollup of the
 * items, the composite fidelity is blendComposite of their fidelities, and the
 * fidelity is shown only as a visual treatment — never a number on screen.
 *
 * Capture invariants honored here: full macros are always written (there is no
 * `focus` field — focus is display-only); a missing macro stays `null`, never 0
 * and never inferred; a partial meal is a valid, loggable state (no nag).
 */
import type {
  FoodEntryPayload,
  FoodItem,
  InputMethod,
  MealTemplate,
  ObservationOf,
  ObservationSource,
} from '@core/observation';
import {
  blendComposite,
  fidelityCeiling,
  tierOf,
  type Extraction,
  type FidelityTier,
} from '@core/nutrition/fidelity';

const round1 = (x: number): number => Math.round(x * 10) / 10;

// ─── Described parser (text → food + quantity + unit) ────────────────────────

// Mass/volume units → grams. Volume uses a density≈1 approximation, documented
// as a tunable heuristic (constitution: honest about guesses).
const MASS_UNITS: Record<string, number> = {
  g: 1, gram: 1, grams: 1, gm: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  ml: 1, milliliter: 1, milliliters: 1,
  cup: 240, cups: 240, tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
};

/** A nominal portion when the user named a food but no resolvable mass; the LOW
 *  fidelity carries the uncertainty rather than a fake-precise number. */
export const DEFAULT_PORTION_G = 100;

export interface ParsedDescribed {
  foodText: string;
  quantity?: number;
  unit?: string; // present only for a recognized mass/volume unit
  grams?: number; // quantity converted to grams, when unit is mass/volume
}

/** Parse a free-text food phrase. "8 oz ribeye" → qty 8, unit oz, 226.8 g,
 *  food "ribeye". "steak" → just the food. Channel (typed vs voice) is irrelevant. */
export function parseDescribed(text: string): ParsedDescribed {
  const trimmed = text.trim();
  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s*(.*)$/);
  if (!m) return { foodText: trimmed };

  const quantity = Number(m[1]);
  const word = (m[2] ?? '').toLowerCase();
  const rest = m[3].trim();

  if (word && MASS_UNITS[word] != null) {
    return { foodText: rest, quantity, unit: word, grams: round1(quantity * MASS_UNITS[word]) };
  }
  // A number with no mass unit (e.g. "2 eggs"): the word is part of the food, and
  // the count is captured but not convertible to grams here (see quirk 18).
  const foodText = (word ? `${word} ${rest}` : rest).trim();
  return { foodText: foodText || trimmed, quantity };
}

/** The extraction signal a `described` log's fidelity keys off (parse, not source). */
export function describedExtraction(parsed: ParsedDescribed): Extraction {
  return {
    food: parsed.foodText.length > 0,
    quantity: parsed.quantity != null,
    unit: parsed.unit != null,
  };
}

/** Grams to log for a described entry — the parsed mass, or a nominal portion. */
export function describedQuantityG(parsed: ParsedDescribed): number {
  return parsed.grams ?? DEFAULT_PORTION_G;
}

// ─── Macro rollup ────────────────────────────────────────────────────────────

export interface MacroRollup {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  alcoholG: number | null;
}

/**
 * The meal's flat macros = the sum of its items'. A macro rolls up to `null` if
 * ANY contributing item is missing it — the total is then genuinely unknown, and
 * an honest null beats a silent undercount (the expenditure engine drops nulls
 * rather than fabricating a low total). Never inferred from other macros.
 */
export function rollupMacros(items: FoodItem[]): MacroRollup {
  const sumOrNull = (vals: Array<number | null | undefined>): number | null =>
    vals.some((v) => v == null) ? null : round1((vals as number[]).reduce((s, v) => s + v, 0));
  return {
    kcal: sumOrNull(items.map((i) => i.kcal)),
    proteinG: sumOrNull(items.map((i) => i.proteinG)),
    carbsG: sumOrNull(items.map((i) => i.carbsG)),
    fatG: sumOrNull(items.map((i) => i.fatG)),
    fiberG: sumOrNull(items.map((i) => i.fiberG)),
    alcoholG: sumOrNull(items.map((i) => i.alcoholG)),
  };
}

// ─── Build: resolved items → foodEntry Observation ───────────────────────────

export interface FoodLogInput {
  description: string;
  items: FoodItem[];
  inputMethod: InputMethod; // Phase-2 surface: 'weighed' | 'described'
  servings?: number;
  templateId?: string; // set when re-logging from a saved meal (recurrence)
}

export interface FoodBuildContext {
  id: string; // uuid v7
  now: string; // ISO instant; occurredAt + loggedAt
  tz: string; // IANA timezone
}

/** First reason a meal can't be saved, or null. A partial meal is VALID — the
 *  only requirement is at least one resolved food. No completeness gate. */
export function validateFoodLog(input: FoodLogInput): string | null {
  if (input.items.length === 0) return 'Add a food.';
  return null;
}

export function canSaveFoodLog(input: FoodLogInput): boolean {
  return validateFoodLog(input) === null;
}

/** Provenance for the meal Observation. Per-item provenance lives on items[];
 *  the envelope carries the (representative) first item's foodapi source. */
function mealSource(items: FoodItem[]): ObservationSource {
  const first = items[0];
  return { type: 'foodapi', provider: first.sourceDb, itemId: first.foodId };
}

export function buildMealLog(input: FoodLogInput, ctx: FoodBuildContext): ObservationOf<'foodEntry'> {
  const reason = validateFoodLog(input);
  if (reason) throw new Error(reason);

  const roll = rollupMacros(input.items);
  const payload: FoodEntryPayload = {
    kind: 'foodEntry',
    description: input.description.trim(),
    servings: input.servings ?? 1,
    kcal: roll.kcal,
    proteinG: roll.proteinG,
    carbsG: roll.carbsG,
    fatG: roll.fatG,
    ...(roll.fiberG != null ? { fiberG: roll.fiberG } : {}),
    ...(roll.alcoholG != null ? { alcoholG: roll.alcoholG } : {}),
    items: input.items,
    inputMethod: input.inputMethod,
    fidelityCeiling: fidelityCeiling(input.inputMethod),
    ...(input.templateId ? { templateId: input.templateId } : {}),
  };

  return {
    id: ctx.id,
    kind: 'foodEntry',
    occurredAt: ctx.now,
    loggedAt: ctx.now,
    tz: ctx.tz,
    tier: 1,
    fidelity: blendComposite(input.items), // composite — never displayed as a number
    source: mealSource(input.items),
    payload,
  };
}

/** "Save this meal" → a MealTemplate (definition only). userConfirmed: the user
 *  saved it. Earned fidelity is engine-derived later, never written here. */
export function mealTemplateFrom(items: FoodItem[], ctx: { id: string; now: string }): MealTemplate {
  return { id: ctx.id, createdAt: ctx.now, userConfirmed: true, canonicalItems: items };
}

// ─── Display: hero number (focus is display-only) ────────────────────────────

export type NutritionFocus = 'calories' | 'protein' | 'carbs' | 'fat';

export interface HeroNumber {
  label: string;
  value: number | null; // null when that macro wasn't captured (partial log)
  unit: string;
}

/** Which macro renders large. A pure read over the SAME stored payload — it
 *  never changes what was written (there is no `focus` field on the log). */
export function heroNumber(
  payload: Pick<FoodEntryPayload, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>,
  focus: NutritionFocus
): HeroNumber {
  switch (focus) {
    case 'protein':
      return { label: 'Protein', value: payload.proteinG, unit: 'g' };
    case 'carbs':
      return { label: 'Carbs', value: payload.carbsG, unit: 'g' };
    case 'fat':
      return { label: 'Fat', value: payload.fatG, unit: 'g' };
    case 'calories':
    default:
      return { label: 'Calories', value: payload.kcal, unit: 'kcal' };
  }
}

// ─── Fidelity → visual treatment (never a number) ────────────────────────────

export interface FidelityTreatment {
  tier: FidelityTier; // HIGH | MID | LOW
  opacity: number; // 1.0 / 0.7 / 0.45 (brand-kit)
  stroke: 'solid' | 'dashed';
  dot: 'filled' | 'hollow' | 'dotted';
}

/**
 * Map a 0..1 fidelity to its brand-kit visual treatment. The continuous value
 * never escapes as a number — solid data looks solid, rough data looks rough,
 * and that visual IS the whole explanation (food-logging-spec § Fidelity display).
 */
export function fidelityTreatment(fidelity: number): FidelityTreatment {
  const tier = tierOf(fidelity);
  switch (tier) {
    case 'HIGH':
      return { tier, opacity: 1.0, stroke: 'solid', dot: 'filled' };
    case 'MID':
      return { tier, opacity: 0.7, stroke: 'solid', dot: 'hollow' };
    case 'LOW':
    default:
      return { tier, opacity: 0.45, stroke: 'dashed', dot: 'dotted' };
  }
}
