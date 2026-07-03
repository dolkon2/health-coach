/**
 * days.ts — the three-valued day-predicate math (expenditure build, Pass E).
 *
 * The honesty win, as engine code: for a per-day condition (protein ≥ X,
 * calories ≤ Y, "day has a complete-enough log") a complete day is HIT or
 * MISSED; an incomplete-data day is **UNKNOWABLE** — rendered hazed, never
 * counted a miss, never breaking or extending a revealed run (handoff,
 * "Three-valued day"). Averages run over complete days only, with completeness
 * shown, never zero-padded (`null ≠ 0`).
 *
 * Verdicts are proven with BOUNDS, not guesses: the sum of a day's *known*
 * values is a lower bound on what was eaten, so
 *   - "≥ X" is hit the moment the lower bound crosses X — even on a partial
 *     day (160 g of known protein plus an unknown snack still cleared 150);
 *   - "≤ Y" is missed the moment the lower bound exceeds Y;
 *   - anything unproven on an incomplete day stays unknowable.
 * The same rule gives the in-progress day only irreversible verdicts — an
 * unfinished day can be provably hit (≥) or provably blown (≤), never missed
 * for food not yet eaten.
 *
 * One deliberate asymmetry: the 'logged' condition is TWO-valued on closed
 * days. Not logging is the miss itself — an unlogged day can't be "unknowably
 * logged" — otherwise a consistency benchmark could never miss.
 *
 * The fidelity share (captureTierShare) counts the CAPTURE-METHOD distribution
 * over entries ("80% at T2+") — a behavior the user controls. Firewall: it
 * must never read the engine's derived earned-fidelity score (Goodhart; see
 * captureTier.ts).
 */
import type { FoodEntryPayload, LocalDate } from '../observation';
import { isPartial } from '../observation';
import type { DayCondition, MacroKind } from '../benchmark';
import { captureTier, captureTierRank, type CaptureTier } from './captureTier';

export type MealForDay = Pick<
  FoodEntryPayload,
  'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG' | 'inputMethod'
>;

export interface NutritionDay {
  date: LocalDate;
  meals: MealForDay[];
  /** The still-accumulating current day — only irreversible verdicts. */
  inProgress?: boolean;
}

export type DayVerdict = 'hit' | 'missed' | 'unknowable';

type IntakeKey = 'kcal' | MacroKind;

const FIELD: Record<IntakeKey, keyof MealForDay> = {
  kcal: 'kcal',
  protein: 'proteinG',
  carbs: 'carbsG',
  fat: 'fatG',
  fiber: 'fiberG',
};

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** The day's evidence for one intake key: the lower bound (sum of known
 *  values) and whether that bound is in fact the complete total. */
function dayBounds(
  meals: MealForDay[],
  key: IntakeKey
): { lower: number; complete: boolean } {
  let lower = 0;
  let complete = meals.length > 0;
  for (const meal of meals) {
    const v = meal[FIELD[key]] as number | null | undefined;
    if (v == null) complete = false;
    else lower += v;
  }
  return { lower: round1(lower), complete };
}

/** "Complete-enough log": at least one meal, none of them macro-partial. */
function dayLoggedComplete(meals: MealForDay[]): boolean {
  return meals.length > 0 && !meals.some((meal) => isPartial(meal));
}

/** One day against one condition — the three-valued verdict. */
export function evaluateDayCondition(day: NutritionDay, condition: DayCondition): DayVerdict {
  if (condition.kind === 'logged') {
    if (dayLoggedComplete(day.meals)) return 'hit';
    return day.inProgress ? 'unknowable' : 'missed';
  }

  const key: IntakeKey = condition.kind === 'calories' ? 'kcal' : condition.macro;
  const bar = condition.kind === 'calories' ? condition.kcal : condition.grams;

  if (day.meals.length === 0) return 'unknowable'; // nothing captured, nothing claimable
  const { lower, complete } = dayBounds(day.meals, key);
  const closedAndComplete = complete && !day.inProgress;

  if (condition.op === 'atLeast') {
    if (lower >= bar) return 'hit'; // the lower bound alone proves it
    return closedAndComplete ? 'missed' : 'unknowable';
  }
  // atMost
  if (lower > bar) return 'missed'; // already provably over
  return closedAndComplete ? 'hit' : 'unknowable';
}

export interface DaysWindowResult {
  byDate: Array<{ date: LocalDate; verdict: DayVerdict }>;
  hits: number;
  misses: number;
  unknowable: number;
  target: number;
  /** Three-valued at the window grain: hit when proven, missed only when
   *  mathematically dead, otherwise unknowable (in-progress falls out free). */
  verdict: DayVerdict;
}

/**
 * Count a window's days against a condition. `days` holds every elapsed day of
 * the window (empty `meals` for unlogged days; today flagged `inProgress`);
 * `totalDays` is the window's calendar length, so days that haven't happened
 * yet keep the window honestly open rather than prematurely dead.
 */
export function evaluateDaysWindow(
  days: NutritionDay[],
  condition: DayCondition,
  target: number,
  opts: { totalDays?: number } = {}
): DaysWindowResult {
  const byDate = [...days]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((d) => ({ date: d.date, verdict: evaluateDayCondition(d, condition) }));

  let hits = 0;
  let misses = 0;
  let unknowable = 0;
  for (const d of byDate) {
    if (d.verdict === 'hit') hits += 1;
    else if (d.verdict === 'missed') misses += 1;
    else unknowable += 1;
  }

  const totalDays = opts.totalDays ?? days.length;
  const pendingDays = Math.max(0, totalDays - days.length);
  const verdict: DayVerdict =
    hits >= target ? 'hit' : hits + unknowable + pendingDays < target ? 'missed' : 'unknowable';

  return { byDate, hits, misses, unknowable, target, verdict };
}

/**
 * A revealed run over three-valued verdicts: consecutive hits counted back
 * from the end, where unknowable neither breaks nor extends and a miss ends
 * it. A stat, never a reward (benchmarks-spec, "Consistency counters").
 */
export function revealedRun(verdicts: readonly DayVerdict[]): number {
  let run = 0;
  for (let i = verdicts.length - 1; i >= 0; i--) {
    const v = verdicts[i];
    if (v === 'unknowable') continue;
    if (v === 'missed') break;
    run += 1;
  }
  return run;
}

export interface CompleteDayAverage {
  avgPerDay: number;
  /** Closed days whose total was actually knowable. */
  knownDays: number;
  /** Closed days considered (the in-progress day is excluded entirely —
   *  a half-eaten day would skew the average low). */
  totalDays: number;
}

/** "2,180 avg · 5 of 7 days logged" — the average over complete closed days
 *  only; null when not one day was knowable (never a fabricated 0). */
export function completeDayAverage(
  days: NutritionDay[],
  key: IntakeKey
): CompleteDayAverage | null {
  const closed = days.filter((d) => !d.inProgress);
  let sum = 0;
  let known = 0;
  for (const d of closed) {
    const { lower, complete } = dayBounds(d.meals, key);
    if (complete) {
      sum += lower;
      known += 1;
    }
  }
  if (known === 0) return null;
  return { avgPerDay: round1(sum / known), knownDays: known, totalDays: closed.length };
}

export interface TierShare {
  /** Percent of entries at/above the tier, 0..100. */
  pct: number;
  atOrAbove: number;
  totalEntries: number;
}

/** The capture-method distribution over a window's entries — what a fidelity
 *  benchmark targets. Null when no entries exist (a share of nothing is not
 *  0%). Counts every entry, including the in-progress day's: an entry's
 *  capture tier is fixed the moment it's captured. */
export function captureTierShare(days: NutritionDay[], minTier: CaptureTier): TierShare | null {
  const minRank = captureTierRank(minTier);
  let total = 0;
  let atOrAbove = 0;
  for (const d of days) {
    for (const meal of d.meals) {
      total += 1;
      if (captureTierRank(captureTier(meal)) >= minRank) atOrAbove += 1;
    }
  }
  if (total === 0) return null;
  return { pct: round1((atOrAbove / total) * 100), atOrAbove, totalEntries: total };
}
