/**
 * benchmark.ts — The user's stated intent (v0.3, the goal layer).
 *
 * Benchmarks are first-class records but NOT Observations — they're user-authored
 * goals in the user's own words. No category picker, no "lose weight / build
 * muscle" menu (constitution: "Goals are yours, not ours"). The engine relates
 * inputs to each other, not to a prescribed target.
 *
 * v0.3 (planning/benchmarks-spec.md) adds the goal layer's load-bearing structure:
 *   - `resolution` — the existence gate. A benchmark must resolve to a dimension
 *     the app actually tracks before it is a benchmark; unresolvable text is a
 *     *note*, not a benchmark. Hence `resolution` is REQUIRED, never optional.
 *   - `shape` — cadence (a rhythm per window) vs trend (a dimension moving a
 *     direction, optionally to a threshold). The user NEVER picks the family; it
 *     is built from what they fill in (a window + count ⇒ cadence; a direction
 *     ⇒ trend). There is no goal-type enum anywhere in the input.
 *   - `pinned` — which active benchmarks surface on Today.
 *
 * Today foregrounds active, pinned benchmarks; past benchmarks become the archive.
 */
import type { ISOInstant, LocalDate, Modality } from './observation';

/**
 * A dimension the app can actually measure — the thing a benchmark resolves TO.
 * The resolution step is the mirror being honest about its own reflective
 * surface: it refuses to track only what it can't see, never what the user may
 * want. Pass 1 wires the two dimensions the app already renders — session counts
 * (the stimulus ledger) and the smoothed weight trend; the union grows additively
 * as more dimensions become trackable.
 */
export type ResolvedDimension =
  // Counts logged sessions in a window — the cadence-count dimension. An optional
  // modality/activity narrows what counts (e.g. paddle sessions, or 'kayak' runs).
  | { metric: 'sessionCount'; modality?: Modality; activity?: string }
  // The smoothed weighIn trend — the canonical trend dimension.
  | { metric: 'bodyweight' };
// Additive next (not wired in Pass 1):
//   | { metric: 'distance'; modality?: Modality; activity?: string }   // cadence-magnitude
//   | { metric: 'exerciseLoad'; exercise: string }                     // strength trend
//   | { metric: 'steps' } | { metric: 'sleepDuration' }
//   | { metric: 'subjective'; label: SubjectiveMetric } | { metric: 'climbGrade' }

/**
 * Cadence — a rhythm held per window (kayak 4×/week, fly 100km/month). Counts
 * events or sums a magnitude across a weekly/monthly window. Streaks are revealed
 * as facts, never authored as rewards (benchmarks-spec.md, "Consistency counters")
 * — so the shape stores only the target + window: no streak, no milestone, no
 * "best run" lives here.
 */
export type CadenceShape = {
  family: 'cadence';
  window: 'week' | 'month';
  measure:
    | { type: 'count'; target: number } // events: 4 sessions          ← wired in Pass 1
    | { type: 'magnitude'; target: number; unit: 'km' | 'mi' }; // sum: 100 km   ← type-ready, wired later
};

/**
 * Trend — a dimension moving a direction, optionally toward a number. A threshold
 * ("bench 100kg") is a trend plus a `target`, not a separate family; a pure trend
 * ("get stronger") omits `target`. This family does not streak — it moves, and
 * maybe crosses a line.
 */
export type TrendShape = {
  family: 'trend';
  direction: 'up' | 'down';
  target?: number; // optional threshold value; absent ⇒ pure trend (direction only)
};

/** The two goal shapes. `family` is the discriminant — set by the structured-entry
 *  constructor from what the user filled in, never chosen from a menu. */
export type BenchmarkShape = CadenceShape | TrendShape;

export type Benchmark = {
  id: string;
  createdAt: ISOInstant;
  resolvedAt?: ISOInstant; // when the user marked it done/abandoned/changed
  status: 'active' | 'achieved' | 'abandoned' | 'paused';
  title: string; // user's own words
  description?: string;
  targetDate?: LocalDate; // optional calendar deadline (race day) — distinct from a trend threshold

  // ─ v0.3 goal-layer structure ─
  resolution: ResolvedDimension; // REQUIRED — the existence gate (no resolution ⇒ it isn't a benchmark)
  shape: BenchmarkShape; // cadence | trend — derived from what the user fills in, never picked
  pinned: boolean; // true ⇒ surfaces on Today

  relatedModalities?: Modality[]; // soft engine hint; now superseded by resolution.modality — cleanup later
};
