/**
 * expenditure.ts — Trend + intake -> measured TDEE (the residual).
 *
 * Expenditure is *measured*, never predicted (north star rule 2). Energy balance:
 * intake − expenditure = the energy stored, and stored energy shows up as weight
 * change (×7700 kcal/kg). So over a window, expenditure is solved as the residual
 * of logged intake against the actual weight-trend movement — never guessed from a
 * watch's motion estimate.
 *
 * Now wired for real (Phase 2 is the first time intake exists). The output is a
 * *report of per-window estimates*, each carrying its own residual confidence, and
 * each honestly `null` when the window is too sparse or too partial to total. Null
 * intake is treated as MISSING, never summed as 0 — a day of protein-only logs
 * lowers a window's confidence; it never fabricates a low calorie total.
 *
 * Heuristics (constitution: documented, tunable guesses):
 *   - KCAL_PER_KG = 7700, WINDOW_DAYS = 14, MIN_INTAKE_DAYS = 5,
 *     MIN_RESIDUAL_DAYS = 3, ERROR_BAND_BASE_KCAL = 150.
 */
import type { LocalDate } from './observation';
import type { WeightTrendPoint } from './trend';
import { notImplemented } from './notImplemented';

/** A day's total intake. `null` = unknown — no logs, or a partial (null-macro)
 *  log that can't be totalled. Distinct from a captured 0; never zero-filled. */
export interface DayIntake {
  date: LocalDate;
  kcal: number | null;
}

export interface ExpenditureWindow {
  windowStart: LocalDate;
  windowEnd: LocalDate;
  meanIntakeKcal: number | null; // null when too partial to total honestly
  trendDeltaKg: number; // weight-trend movement across the window (negative = down)
  inferredTdeeKcal: number | null; // the residual; null when intake is insufficient
  residualConfidence: number; // 0..1, per window — the field Phase 7 earned fidelity consumes
  logCompleteness: number; // 0..1, fraction of window-days with a full (non-null) macro log
  errorBandKcal: { low: number; high: number };
}

export interface ExpenditureReport {
  windows: ExpenditureWindow[];
  latest: ExpenditureWindow | null; // most recent window that yields a measured TDEE
}

/** KCAL_PER_KG = 7700 is a documented, tunable guess (constitution conventions). */
export const KCAL_PER_KG = 7700;
/** A window spans two weeks — long enough to average daily noise (≈ the trend half-life). */
export const WINDOW_DAYS = 14;
/** Fully-logged days a window needs before its mean intake is honest. */
export const MIN_INTAKE_DAYS = 5;
/** The trend must span at least this many days for the residual rate to mean anything. */
export const MIN_RESIDUAL_DAYS = 3;
/** First-draft ±band on a measured TDEE; widens as confidence falls. */
const ERROR_BAND_BASE_KCAL = 150;

const DAY_MS = 86_400_000;
const round0 = (x: number): number => Math.round(x);
const round2 = (x: number): number => Math.round(x * 100) / 100;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const mean = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length;

function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}
function addDays(date: LocalDate, n: number): LocalDate {
  return new Date(Date.parse(date) + n * DAY_MS).toISOString().slice(0, 10);
}
function datesInRange(start: LocalDate, end: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
function trendNearest(points: WeightTrendPoint[], date: LocalDate): WeightTrendPoint {
  let best = points[0];
  let bestDist = Infinity;
  for (const p of points) {
    const dist = Math.abs(daysBetween(p.date, date));
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

/**
 * Solve expenditure as the residual of intake against weight-trend movement, over
 * consecutive `windowDays`-long windows. Daily intake is keyed by **local civil
 * day** (bucket foodEntry logs with timeline.bucketByLocalDay first). Returns an
 * empty report when there isn't enough trend data for any honest answer.
 */
export function estimateExpenditure(
  trend: WeightTrendPoint[],
  dailyIntake: DayIntake[],
  windowDays: number = WINDOW_DAYS
): ExpenditureReport {
  if (trend.length < 2) return { windows: [], latest: null };

  const points = [...trend].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const intakeByDate = new Map<LocalDate, number | null>();
  for (const d of dailyIntake) intakeByDate.set(d.date, d.kcal);

  const firstDate = points[0].date;
  const lastDate = points[points.length - 1].date;

  const windows: ExpenditureWindow[] = [];
  for (let ws = firstDate; ws <= lastDate; ws = addDays(ws, windowDays)) {
    windows.push(computeWindow(ws, addDays(ws, windowDays - 1), points, intakeByDate));
  }

  let latest: ExpenditureWindow | null = null;
  for (let i = windows.length - 1; i >= 0; i--) {
    if (windows[i].inferredTdeeKcal != null) {
      latest = windows[i];
      break;
    }
  }
  return { windows, latest };
}

function computeWindow(
  windowStart: LocalDate,
  windowEnd: LocalDate,
  points: WeightTrendPoint[],
  intakeByDate: Map<LocalDate, number | null>
): ExpenditureWindow {
  const startP = trendNearest(points, windowStart);
  const endP = trendNearest(points, windowEnd);
  const trendDeltaKg = round2(endP.trendKg - startP.trendKg);
  const spanDays = Math.max(1, daysBetween(startP.date, endP.date));

  const dates = datesInRange(windowStart, windowEnd);
  // null = that day is missing/partial; it is EXCLUDED from the mean, never zero-filled.
  const present = dates
    .map((d) => intakeByDate.get(d) ?? null)
    .filter((v): v is number => v != null);

  const logCompleteness = round2(present.length / dates.length);
  const meanIntakeKcal = present.length >= MIN_INTAKE_DAYS ? round0(mean(present)) : null;

  const inWindow = points.filter((p) => p.date >= windowStart && p.date <= windowEnd);
  const trendConfidence = inWindow.length ? mean(inWindow.map((p) => p.confidence)) : 0;

  const inferredTdeeKcal =
    meanIntakeKcal != null && spanDays >= MIN_RESIDUAL_DAYS
      ? round0(meanIntakeKcal - (trendDeltaKg * KCAL_PER_KG) / spanDays)
      : null;

  // Confidence in the residual = how completely the window was logged × how solid
  // its weight trend is. A partial window scores lower AND is excluded from intake.
  const residualConfidence = clamp01(round2(logCompleteness * trendConfidence));

  const errorBandKcal =
    inferredTdeeKcal != null ? bandFor(inferredTdeeKcal, residualConfidence) : { low: 0, high: 0 };

  return {
    windowStart,
    windowEnd,
    meanIntakeKcal,
    trendDeltaKg,
    inferredTdeeKcal,
    residualConfidence,
    logCompleteness,
    errorBandKcal,
  };
}

function bandFor(tdee: number, confidence: number): { low: number; high: number } {
  const margin = round0(ERROR_BAND_BASE_KCAL * (2 - confidence)); // conf 1 → ±base, conf 0 → ±2·base
  return { low: tdee - margin, high: tdee + margin };
}

/**
 * Measured energy balance for a window: mean intake − measured burn, kcal/day.
 * Negative = deficit. This is the `energyBalance` outcome dimension's number
 * (Pass E) — algebraically the weight-trend movement re-expressed in kcal/day,
 * so it degrades exactly as honestly as the residual does: null whenever the
 * window couldn't yield a measured TDEE ("not enough data", never a guess).
 */
export function energyBalanceKcalPerDay(w: ExpenditureWindow): number | null {
  if (w.meanIntakeKcal == null || w.inferredTdeeKcal == null) return null;
  return round0(w.meanIntakeKcal - w.inferredTdeeKcal);
}

/**
 * Phase 7 — earned fidelity (the integrity boundary, expressed in types now).
 *
 * It is the JOIN of a template's occurrences (a query over foodEntry logs, 2.4)
 * against the per-window `residualConfidence` above: a template earns only when
 * recurrence AND a tight residual hold together over an extended period. It is
 * engine-derived here and **never written by the logging layer**. The derivation
 * site is marked with an honest stub; the computation (and signal attribution)
 * is Phase 7. See food-logging-spec.md § Earned fidelity and the build plan § 4.
 */
export function deriveEarnedFidelity(_windows: ExpenditureWindow[]): never {
  return notImplemented('earnedFidelity', 'Phase 7');
}
