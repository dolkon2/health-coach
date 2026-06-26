/**
 * stimulus.ts — Sessions -> weekly per-pattern / energy-system ledger + reveal().
 *
 * Organizes training around movement patterns and energy systems rather than
 * app categories, so a climbing session counts as upper-pull volume and an HIIT
 * row covers glycolytic. Substitution becomes a feature, not a hack.
 *
 * reveal() produces the user-facing "what this contributed" line. Its tone is
 * the reference for the whole product: observations, not orders. Descriptive,
 * never imperative (constitution conventions).
 *
 * Status: signatures only. Implemented in Pass 4 (session logging + Today),
 * ledger surfaced in Pass 5 (Reflect).
 */
import type { ObservationOf, MovementPattern, EnergySystem, ObservationId, LocalDate } from './observation';
import { notImplemented } from './notImplemented';

export type StimulusLedgerWeek = {
  weekStart: LocalDate;
  byPattern: Record<MovementPattern, { sets: number; volumeLoadKg: number }>;
  byEnergySystem: Record<EnergySystem, { minutes: number }>;
  sessionIds: ObservationId[];
};

/** Current week + prior weeks, grouped by movement pattern and energy system. */
export function computeWeeklyStimulus(
  _sessions: ObservationOf<'session'>[]
): StimulusLedgerWeek[] {
  return notImplemented('stimulus.computeWeeklyStimulus', 'Pass 4');
}

/**
 * A one-line, descriptive summary of what a single session contributed —
 * e.g. "upper-pull · 16 sets · 4,200 kg volume load". Never an instruction.
 */
export function reveal(_session: ObservationOf<'session'>): string {
  return notImplemented('stimulus.reveal', 'Pass 4');
}
