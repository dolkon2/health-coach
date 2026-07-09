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
  | { metric: 'bodyweight' }
  // ─ Nutrition dimensions (expenditure build, Pass E) ─
  // Daily calorie intake — behavior via a `days` measure (calories ≤/≥ X per day).
  | { metric: 'calories' }
  // A daily macro total — behavior via a `days` measure (protein ≥ X g per day).
  | { metric: 'macro'; macro: MacroKind }
  // "Day has a complete-enough log" — the logging-consistency behavior.
  | { metric: 'loggingConsistency' }
  // Capture-method distribution ("80% of entries at T2+") — a behavior the
  // user controls. FIREWALL: this targets the CAPTURE tier only; it must
  // never target the engine's derived earned-fidelity score (Goodhart).
  | { metric: 'loggingFidelity' }
  // Measured intake − measured burn (the deficit outcome). Reads the
  // expenditure residual; honestly absent until measurement exists.
  | { metric: 'energyBalance' }
  // ─ Body dimensions (Body build, P6) ─
  // A lift's e1RM (core/gymAnalytics.ts), outcome-only — the threshold ("bench
  // 100kg") is the OUTCOME face's `direction: 'up'` + `target`, NOT carried
  // here. `exerciseId` when the exercise is library-linked, `exercise` (the
  // stored fact) always present so an unlinked custom lift is still trackable.
  | { metric: 'exerciseLoad'; exerciseId?: string; exercise: string }
  // WHM-style breath-hold retention (core BreathworkRound), outcome-only.
  // `statistic` picks best single hold vs the average across logged rounds.
  | { metric: 'breathRetention'; statistic: 'best' | 'average' }
  // A self-administered ROM test reading (romReading, the weigh-in analog),
  // outcome-only. `testId` keys the bundled rom-tests taxonomy.
  | { metric: 'romMeasurement'; testId: string; side?: 'left' | 'right' }
  // Rolling-7d adherence to a user-authored PT protocol, behavior-only —
  // capped per-exercise ratios (ticks-this-week / targetPerWeek, capped at
  // 1), unweighted mean across the protocol's exercises. Derived at render,
  // never stored (protocolTicks.ts's own header already says this).
  | { metric: 'protocolAdherence'; protocolId: string };
// Additive next (not wired yet):
//   | { metric: 'distance'; modality?: Modality; activity?: string }   // behavior-magnitude OR outcome
//   | { metric: 'steps' } | { metric: 'sleepDuration' }                // NOTE-ONLY (handoff): reserved, don't wire
//   | { metric: 'subjective'; label: SubjectiveMetric } | { metric: 'climbGrade' }
//   ─ USHPA ledger (ushpaLedger.ts) — reserved until flight logging wires in ─
//   | { metric: 'flightCount'; activity?: string } | { metric: 'flightHours'; activity?: string }
//   | { metric: 'flyingDays'; activity?: string } | { metric: 'uniqueSites'; activity?: string }

/** The four daily macro totals a nutrition benchmark can target. */
export type MacroKind = 'protein' | 'carbs' | 'fat' | 'fiber';

/**
 * A per-day condition a `days` measure counts — the day-predicate. Each day
 * resolves to HIT / MISSED / UNKNOWABLE (three-valued; an incomplete-data day
 * is never counted a miss — core/nutrition/days.ts owns the math).
 */
export type DayCondition =
  | { kind: 'calories'; op: 'atLeast' | 'atMost'; kcal: number }
  | { kind: 'macro'; macro: MacroKind; op: 'atLeast' | 'atMost'; grams: number }
  // The day has a complete-enough log. Deliberately two-valued: absence of
  // logging IS the miss (you can't unknowably not-log), so no haze here.
  | { kind: 'logged' };

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
    | { type: 'magnitude'; target: number; unit: 'km' | 'mi' } // sum: 100 km   ← type-ready, wired later
    // Days in the window meeting a per-day condition (the new primitive —
    // unifies with the sports "outing days" idea): "protein ≥ 150g on 5 days/wk".
    | { type: 'days'; target: number; condition: DayCondition }
    // Share of the window's entries at/above a capture tier: "80% at T2+".
    // The fidelity benchmark's shape — capture-method distribution ONLY.
    | { type: 'share'; targetPct: number; minTier: 'T2' | 'T3' };
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
