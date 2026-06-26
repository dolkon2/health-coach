/**
 * stimulus.ts — Sessions -> weekly per-pattern / energy-system ledger + reveal().
 *
 * Organizes training around movement patterns and energy systems rather than
 * app categories, so a climbing session counts as upper-pull volume and an HIIT
 * row covers glycolytic. Substitution becomes a feature, not a hack.
 *
 * reveal() produces the user-facing "what this contributed" line. Its tone is
 * the reference for the whole product: observations, not orders. Descriptive,
 * never imperative (constitution conventions). It speaks the engine's native
 * units — kg of volume load, km of distance — not the user's display units; the
 * line is the engine's voice, not a data-entry surface.
 *
 * Status: reveal() implemented in Pass 4 (session logging + Today).
 * computeWeeklyStimulus() is the Reflect ledger — still a stub, built in Pass 5.
 */
import type {
  ObservationOf,
  MovementPattern,
  EnergySystem,
  ObservationId,
  LocalDate,
} from './observation';
import { notImplemented } from './notImplemented';

export type StimulusLedgerWeek = {
  weekStart: LocalDate;
  byPattern: Record<MovementPattern, { sets: number; volumeLoadKg: number }>;
  byEnergySystem: Record<EnergySystem, { minutes: number }>;
  sessionIds: ObservationId[];
};

/**
 * Current week + prior weeks, grouped by movement pattern and energy system.
 * The Reflect ledger consumes this — built in Pass 5, when the ledger UI and a
 * test that drives it land together. Until then it stays an honest placeholder
 * rather than shipping untested engine code with no consumer (constitution).
 */
export function computeWeeklyStimulus(
  _sessions: ObservationOf<'session'>[]
): StimulusLedgerWeek[] {
  return notImplemented('stimulus.computeWeeklyStimulus', 'Pass 5');
}

/**
 * A one-line, descriptive summary of what a single session contributed —
 * e.g. "upper-pull · 16 sets · 4,200 kg volume load". Never an instruction.
 *
 * The shape follows the populated sport block, falling back to a duration line
 * when there's nothing richer to honestly say. It never fabricates: a session
 * of warm-ups only says so; a session with no detail just states its duration.
 */
export function reveal(session: ObservationOf<'session'>): string {
  const p = session.payload;
  switch (p.modality) {
    case 'gym':
      return revealLifting(session);
    case 'run':
    case 'ride':
    case 'paddle':
    case 'swim':
      return revealEndurance(session);
    case 'climb':
      return revealClimbing(session);
    default:
      return durationLine(session);
  }
}

// ─── Per-modality reveals ────────────────────────────────────────────────────

function revealLifting(session: ObservationOf<'session'>): string {
  const sets = session.payload.lifting?.sets ?? [];
  const working = sets.filter((s) => s.isWarmup !== true);

  if (working.length === 0) {
    // Honest: warm-ups carry no working volume; nothing at all is just a duration.
    return sets.length > 0 ? 'warm-up only · 0 working sets' : durationLine(session);
  }

  const volumeLoadKg = working.reduce((sum, s) => sum + s.weightKg * s.reps, 0);

  // Patterns present, ordered by how many working sets each carried (desc).
  const setsByPattern = new Map<MovementPattern, number>();
  for (const s of working) {
    setsByPattern.set(s.movementPattern, (setsByPattern.get(s.movementPattern) ?? 0) + 1);
  }
  const patterns = [...setsByPattern.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pattern]) => pattern)
    .join(' + ');

  const setWord = working.length === 1 ? 'set' : 'sets';
  return `${patterns} · ${working.length} ${setWord} · ${groupThousands(
    Math.round(volumeLoadKg)
  )} kg volume load`;
}

function revealEndurance(session: ObservationOf<'session'>): string {
  const e = session.payload.endurance;
  if (!e) return durationLine(session);

  const parts: string[] = [e.energySystem, `${formatMinutes(session.payload.durationMin)}`];
  if (e.distanceM != null && e.distanceM > 0) {
    parts.push(`${(e.distanceM / 1000).toFixed(1)} km`);
  }
  if (e.avgHr != null && e.avgHr > 0) {
    parts.push(`${Math.round(e.avgHr)} bpm`);
  }
  return parts.join(' · ');
}

function revealClimbing(session: ObservationOf<'session'>): string {
  const c = session.payload.climbing;
  if (!c) return durationLine(session);

  if (c.sends.length > 0) {
    const sent = c.sends.filter((s) => s.sent).length;
    return `${c.style} · ${sent} of ${c.sends.length} sent`;
  }
  if (c.totalProblems != null && c.totalProblems > 0) {
    return `${c.style} · ${c.totalProblems} problems`;
  }
  return `${c.style} · ${formatMinutes(session.payload.durationMin)}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function durationLine(session: ObservationOf<'session'>): string {
  return `${session.payload.modality} · ${formatMinutes(session.payload.durationMin)}`;
}

function formatMinutes(min: number): string {
  return `${Math.round(min)} min`;
}

/** 4200 -> "4,200". Integers only; the caller rounds first. */
function groupThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
