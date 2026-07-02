/**
 * benchmark.ts — The user's stated intent (v0.4, the goal layer).
 *
 * Benchmarks are first-class records but NOT Observations — they're user-authored
 * goals in the user's own words. No category picker, no "lose weight / build
 * muscle" menu (constitution: "Goals are yours, not ours"). The engine relates
 * inputs to each other, not to a prescribed target.
 *
 * v0.4 (planning/benchmarks-spec.md) collapses v0.3's two goal *families* into
 * two *faces* of one object. Every real goal has a controllable side and a
 * measurable side, and a benchmark carries either or both:
 *   - `behavior` — the face you control (train 4×/week, log consistently).
 *     Tier-1 territory: every unit is a logged fact. Sovereign — the user gets
 *     to feel good about holding it regardless of what the outcome says.
 *   - `outcome` — the face you watch (weight moving, getting stronger). Tier-2
 *     territory: accumulated/derived measurement. Observed, never moralized.
 *
 * At least one face must be present (enforced at the storage boundary — the
 * type keeps both optional so partial updates stay ergonomic). Behavior-only is
 * fully valid ("I just want to be consistent"); outcome-only is valid; both is
 * the richest case — the outcome names success, the behavior is the user's own
 * chosen path to it.
 *
 * Each face resolves to its OWN dimension — the v0.3 existence gate, now per
 * face. That's what makes cross-dimension pairing representable: a sessionCount
 * behavior + a bodyweight outcome is one benchmark. The user still never picks
 * a type anywhere: filling rhythm fields IS setting a behavior face, filling
 * direction fields IS setting an outcome face.
 *
 * Today foregrounds active, pinned benchmarks; past benchmarks become the archive.
 */
import type { ISOInstant, LocalDate, Modality } from './observation';

/**
 * A dimension the app can actually measure — the thing a face resolves TO.
 * The resolution step is the mirror being honest about its own reflective
 * surface: it refuses to track only what it can't see, never what the user may
 * want. Pass 1 wires the two dimensions the app already renders — session counts
 * (the stimulus ledger) and the smoothed weight trend; the union grows additively
 * as more dimensions become trackable. The same union serves both faces: some
 * dimensions read naturally as behavior (sessionCount), some as outcome
 * (bodyweight), and future ones (distance, steps) can be either.
 */
export type ResolvedDimension =
  // Counts logged sessions in a window — the canonical behavior dimension. An
  // optional modality/activity narrows what counts (e.g. paddle sessions, or
  // 'kayak' runs); bare `{ metric: 'sessionCount' }` counts ANY logged session.
  | { metric: 'sessionCount'; modality?: Modality; activity?: string }
  // The smoothed weighIn trend — the canonical outcome dimension.
  | { metric: 'bodyweight' };
// Additive next (not wired yet):
//   | { metric: 'distance'; modality?: Modality; activity?: string }   // behavior-magnitude OR outcome
//   | { metric: 'exerciseLoad'; exercise: string }                     // strength outcome
//   | { metric: 'steps' } | { metric: 'sleepDuration' }
//   | { metric: 'subjective'; label: SubjectiveMetric } | { metric: 'climbGrade' }

/**
 * Behavior — the face the user controls: a rhythm held per window (kayak
 * 4×/week, fly 100km/month). Counts events or sums a magnitude across a
 * weekly/monthly window. Streaks are revealed as facts, never authored as
 * rewards (benchmarks-spec.md, "Consistency counters") — so the face stores
 * only the dimension + target + window: no streak, no milestone, no "best run"
 * lives here.
 */
export type BehaviorFace = {
  dimension: ResolvedDimension; // what counts as doing it — the per-face existence gate
  window: 'week' | 'month';
  measure:
    | { type: 'count'; target: number } // events: 4 sessions          ← wired
    | { type: 'magnitude'; target: number; unit: 'km' | 'mi' }; // sum: 100 km   ← type-ready, wired later
};

/**
 * Outcome — the face the user watches: a measured dimension moving a direction,
 * optionally toward a number. A threshold ("bench 100kg") is a direction plus a
 * `target`, not a separate kind; a pure direction ("get stronger") omits it.
 * This face does not streak — it moves, and maybe crosses a line. The mirror
 * reports the movement; it never grades it.
 */
export type OutcomeFace = {
  dimension: ResolvedDimension; // what's measured — the per-face existence gate
  direction: 'up' | 'down';
  target?: number; // optional threshold value; absent ⇒ direction only
};

export type Benchmark = {
  id: string;
  createdAt: ISOInstant;
  resolvedAt?: ISOInstant; // when the user marked it done/abandoned/changed
  status: 'active' | 'achieved' | 'abandoned' | 'paused';
  title: string; // user's own words
  description?: string;
  targetDate?: LocalDate; // optional calendar deadline (race day) — distinct from an outcome threshold

  // ─ v0.4 faces — at least one must be present (storage boundary enforces) ─
  behavior?: BehaviorFace; // the part you control — sovereign, tier-1
  outcome?: OutcomeFace; // the part you watch — observed, tier-2

  pinned: boolean; // true ⇒ surfaces on Today

  relatedModalities?: Modality[]; // soft engine hint; superseded by face dimensions — cleanup later
};
