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
  defaultFidelity,
  fidelityCeiling,
  tierOf,
  type Extraction,
  type FidelityTier,
} from '@core/nutrition/fidelity';

const round1 = (x: number): number => Math.round(x * 10) / 10;

// ─── Described parser (text → food + quantity + unit) ────────────────────────

// Mass/volume units → grams. Volume uses a density≈1 approximation, documented
// as a tunable heuristic (constitution: honest about guesses). Exported so the
// LLM extractor (foodNLP.ts) can use the same conversion table — single source
// of truth for unit conversions across both parsers.
export const MASS_UNITS: Record<string, number> = {
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

// ─── Daily totals (cross-meal aggregation for the Today screen) ──────────────

export interface DailyMacroTotal {
  /** Sum of the entries that captured this macro. `null` only when NOT ONE entry
   *  did — a genuinely unknown total, never a fabricated 0. */
  value: number | null;
  /** How many of today's entries lacked this macro (excluded from `value`). */
  missing: number;
}

export interface DailyTotals {
  kcal: DailyMacroTotal;
  proteinG: DailyMacroTotal;
  carbsG: DailyMacroTotal;
  fatG: DailyMacroTotal;
  entryCount: number;
  /** Entries missing at least one of the four macros (isPartial holds). */
  partialCount: number;
}

type DailyMacros = Pick<FoodEntryPayload, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>;

/**
 * Roll a day's meals into per-macro totals — the honest counterpart to a single
 * meal's `rollupMacros`. The aggregation rule differs on purpose: here a missing
 * macro is EXCLUDED from the sum (and counted in `missing`), never summed as 0 and
 * never collapsing the whole day to null — one partial breakfast must not erase a
 * known lunch. A macro totals `null` only when not one entry captured it. Macros
 * are never inferred from one another. (food-logging-spec § null ≠ 0.)
 */
export function dailyTotals(meals: ReadonlyArray<DailyMacros>): DailyTotals {
  const fold = (sel: (m: DailyMacros) => number | null): DailyMacroTotal => {
    let sum = 0;
    let known = 0;
    let missing = 0;
    for (const m of meals) {
      const v = sel(m);
      if (v == null) missing += 1;
      else {
        sum += v;
        known += 1;
      }
    }
    return { value: known > 0 ? round1(sum) : null, missing };
  };
  return {
    kcal: fold((m) => m.kcal),
    proteinG: fold((m) => m.proteinG),
    carbsG: fold((m) => m.carbsG),
    fatG: fold((m) => m.fatG),
    entryCount: meals.length,
    partialCount: meals.filter(
      (m) => m.kcal === null || m.proteinG === null || m.carbsG === null || m.fatG === null
    ).length,
  };
}

// ─── Build: resolved items → foodEntry Observation ───────────────────────────

export interface FoodLogInput {
  description: string;
  items: FoodItem[];
  inputMethod: InputMethod; // Phase-2 surface: 'weighed' | 'described'
  servings?: number;
  templateId?: string; // set when re-logging from a saved meal (recurrence)
  estimateModel?: string; // model id when items are keyless LLM estimates — stamps the 'estimate' source
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
 *  the envelope carries the representative first item's source. A meal holding
 *  any keyless item can't claim a food-database lineage, so its provenance
 *  honestly reads by how the model produced the numbers: `photoestimate` for a
 *  plate photo, `labelscan` for a transcribed Nutrition Facts panel (declared
 *  values, not an estimate), else `estimate` for a text estimate
 *  (food-logging-spec § direct estimation). */
function mealSource(items: FoodItem[], inputMethod: InputMethod, estimateModel?: string): ObservationSource {
  const first = items[0];
  if (items.some((it) => it.foodId == null) || first?.sourceDb == null || first?.foodId == null) {
    const type = inputMethod === 'photo' ? 'photoestimate' : inputMethod === 'label' ? 'labelscan' : 'estimate';
    return { type, modelVersion: estimateModel ?? 'unknown' };
  }
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
    source: mealSource(input.items, input.inputMethod, input.estimateModel),
    payload,
  };
}

/**
 * Drop one item from a meal payload and re-roll the macros. Returns `null` when
 * `index` points at the meal's last remaining item — the caller deletes the whole
 * observation in that case (a meal with zero foods is not a thing). The new
 * payload re-rolls via the same `rollupMacros` rule the builder uses: a macro
 * stays `null` if any remaining item is missing it (null ≠ 0, never inferred).
 * Pure; the caller re-blends fidelity on the observation envelope.
 */
export function removeItemFromMeal(
  payload: FoodEntryPayload,
  index: number
): FoodEntryPayload | null {
  if (index < 0 || index >= payload.items.length) {
    throw new Error(`removeItemFromMeal: index ${index} out of range`);
  }
  if (payload.items.length === 1) return null;
  const items = payload.items.filter((_, i) => i !== index);
  const roll = rollupMacros(items);
  return {
    ...payload,
    items,
    kcal: roll.kcal,
    proteinG: roll.proteinG,
    carbsG: roll.carbsG,
    fatG: roll.fatG,
    ...(roll.fiberG != null ? { fiberG: roll.fiberG } : {}),
    ...(roll.alcoholG != null ? { alcoholG: roll.alcoholG } : {}),
  };
}

/**
 * Apply a hand-edit (from the item editor) to one item, honestly.
 *
 * The committed values are now the user's assertion. Two cases:
 *   - A KEYLESS estimate (photo / label / described — no foodId) already carries
 *     an honest estimate-tier fidelity, so it's just merged: the correction to a
 *     transcription or estimate doesn't change what kind of capture it was.
 *   - A KEYED item (barcode / weighed — has a foodId) had DB-sourced numbers.
 *     Once hand-edited they're no longer purely the database's, so confidence
 *     drops to the hand-entered estimate band (described + macrosEstimated).
 *     Fidelity is only ever LOWERED, never raised (Math.min). Identity
 *     (foodId/sourceDb) is KEPT so the meal's provenance and input method stay
 *     truthful — you still scanned that product, you just adjusted the amounts.
 */
export function applyItemEdit(item: FoodItem, patch: Partial<FoodItem>): FoodItem {
  const merged = { ...item, ...patch };
  if (item.foodId == null) return merged;
  const edited = defaultFidelity('described', { macrosEstimated: true, quantity: !!merged.portionText });
  return { ...merged, fidelity: Math.min(item.fidelity, edited) };
}

/**
 * The meal name to show on a card — honest about whether the user actually
 * named the meal. If the stored `description` is non-empty AND doesn't match
 * any single item's name, it's a real user-typed name and wins. Otherwise it's
 * either blank or the logger's auto-seed (the first food's name pre-filled),
 * which would lie at the card level for a multi-item meal — we fall back to
 * "First item + N more" so a 3-item meal can't masquerade as one ingredient.
 * Single-item meals collapse to just the item's name. Empty meal → "Meal".
 */
export function mealDisplayName(
  payload: Pick<FoodEntryPayload, 'description' | 'items'>
): string {
  const desc = payload.description?.trim() ?? '';
  const items = payload.items;
  const itemNames = new Set(
    items.map((i) => i.description?.trim()).filter((d): d is string => !!d)
  );
  if (desc && !itemNames.has(desc)) return desc;
  const first = items[0]?.description?.trim();
  if (!first) return 'Meal';
  return items.length > 1 ? `${first} + ${items.length - 1} more` : first;
}

/** A readable label for a meal built from its items' names — the unique item
 *  descriptions joined ("Cheddar cheese, Crackers"), or '' when no item carries a
 *  name (legacy items, or a source that returned none). Display-only. */
export function mealItemsLabel(items: FoodItem[]): string {
  const names = items.map((i) => i.description?.trim()).filter((d): d is string => !!d);
  return Array.from(new Set(names)).join(', ');
}

/** A compact per-item macro line for the meal breakdown — "513 cal · 96 P · 0 C ·
 *  12 F", with "—" for a macro the item didn't capture (null ≠ 0, never inferred).
 *  Display-only; shared by the logger preview and Today's expanded card. */
export function itemMacroSummary(
  item: Pick<FoodItem, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>
): string {
  const s = (v: number | null | undefined): string => (v == null ? '—' : String(Math.round(v)));
  return `${s(item.kcal)} cal · ${s(item.proteinG)} P · ${s(item.carbsG)} C · ${s(item.fatG)} F`;
}

/**
 * Macros for `grams` of a food, scaled from a fetched basis item (its macros at
 * `basis.quantity` g). Null-preserving — a basis with an unknown macro stays
 * unknown. Powers the logger's live "what this portion gives you" preview as you
 * type the amount, before adding. (The committed value is re-derived exactly from
 * per-gram on Add; this preview matches it at display precision.)
 */
export function scaleMacros(
  basis: Pick<FoodItem, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'quantity'>,
  grams: number
): Pick<FoodItem, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'> {
  const factor = basis.quantity > 0 ? grams / basis.quantity : 0;
  const f = (v: number | null | undefined): number | null => (v == null ? null : round1(v * factor));
  return { kcal: f(basis.kcal), proteinG: f(basis.proteinG), carbsG: f(basis.carbsG), fatG: f(basis.fatG) };
}

/**
 * Calories implied by an item's macros (Atwater 4/4/9, +7 for alcohol) — but
 * ONLY when protein, carbs, and fat are all present. Returns null when any is
 * missing, so the caller never zero-fills a null macro into a fake calorie total
 * (food-logging-spec § null ≠ 0). The estimate editor recomputes kcal on a macro
 * edit only when this is non-null; otherwise calories stay as the user set them.
 */
export function recomputeKcal(
  macros: Pick<FoodItem, 'proteinG' | 'carbsG' | 'fatG' | 'alcoholG'>
): number | null {
  const { proteinG, carbsG, fatG } = macros;
  if (proteinG == null || carbsG == null || fatG == null) return null;
  return round1(4 * proteinG + 4 * carbsG + 9 * fatG + 7 * (macros.alcoholG ?? 0));
}

/** "Save this meal" → a MealTemplate (definition only). userConfirmed: the user
 *  saved it. A display-only `name` carries from the meal's description, falling back
 *  to its items' names, so the saved-meals picker is readable; it is omitted only
 *  when nothing named the meal. Earned fidelity is engine-derived later, never here. */
export function mealTemplateFrom(
  items: FoodItem[],
  ctx: { id: string; now: string; name?: string }
): MealTemplate {
  const name = ctx.name?.trim() || mealItemsLabel(items);
  return {
    id: ctx.id,
    ...(name ? { name } : {}),
    createdAt: ctx.now,
    userConfirmed: true,
    canonicalItems: items,
  };
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

/** The daily-total counterpart to `heroNumber` — which macro's DAY sum
 *  renders large (Home's Focus-mode nutrition-today card, home-tab.md § 3).
 *  Same null-≠-0 total each macro already carries; this just picks which one. */
export function dailyFocusTotal(
  totals: DailyTotals,
  focus: NutritionFocus
): { label: string; unit: string; total: DailyMacroTotal } {
  switch (focus) {
    case 'protein':
      return { label: 'Protein', unit: 'g', total: totals.proteinG };
    case 'carbs':
      return { label: 'Carbs', unit: 'g', total: totals.carbsG };
    case 'fat':
      return { label: 'Fat', unit: 'g', total: totals.fatG };
    case 'calories':
    default:
      return { label: 'Calories', unit: 'kcal', total: totals.kcal };
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
