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
import { dayKey } from './timeline';

export type StimulusLedgerWeek = {
  weekStart: LocalDate;
  // Sparsely populated: only patterns that carried working volume that week
  // appear as keys. Consumers iterate Object.entries (no fabricated zero rows).
  byPattern: Record<MovementPattern, { sets: number; volumeLoadKg: number }>;
  // Always fully populated (three keys), zero when nothing was logged.
  byEnergySystem: Record<EnergySystem, { minutes: number }>;
  sessionIds: ObservationId[];
};

/**
 * The Monday (ISO week start) of the week containing `date`, as 'YYYY-MM-DD'.
 * Buckets by UTC civil date — consistent with trend.ts/`dayKey` (see quirk 1:
 * grouping is UTC-based, fine for US-Pacific morning logging, tz-correct fix
 * deferred until sync/import lands).
 */
export function isoWeekStart(date: LocalDate): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const daysSinceMonday = (dow + 6) % 7; // Mon -> 0, Sun -> 6
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

function emptyWeek(weekStart: LocalDate): StimulusLedgerWeek {
  return {
    weekStart,
    byPattern: {} as StimulusLedgerWeek['byPattern'],
    byEnergySystem: {
      aerobic: { minutes: 0 },
      glycolytic: { minutes: 0 },
      mixed: { minutes: 0 },
    },
    sessionIds: [],
  };
}

/**
 * Groups sessions by ISO week into a per-pattern volume / per-energy-system
 * minutes ledger. One entry per week that actually has sessions, oldest first;
 * it does not invent empty weeks (that needs "now" — a UI windowing concern the
 * pure engine stays out of; the hook pads the fixed 8-week display window).
 *
 * Gym volume excludes warm-ups, matching reveal() so the ledger and the Today
 * contribution line never disagree. Climbing/hike/other sessions carry no
 * measurable pattern volume in the data model — they appear in `sessionIds`
 * (and so in the drill-down) but contribute nothing to the bars rather than a
 * fabricated number (constitution: no fake data). See quirk: climb/hike gap.
 *
 * Speaks engine-native kg, like reveal() (quirk 6) — the ledger is the engine's
 * voice, not a data-entry surface.
 */
export function computeWeeklyStimulus(
  sessions: ObservationOf<'session'>[]
): StimulusLedgerWeek[] {
  const byWeek = new Map<LocalDate, StimulusLedgerWeek>();

  const weekFor = (weekStart: LocalDate): StimulusLedgerWeek => {
    let w = byWeek.get(weekStart);
    if (!w) {
      w = emptyWeek(weekStart);
      byWeek.set(weekStart, w);
    }
    return w;
  };

  for (const session of sessions) {
    const week = weekFor(isoWeekStart(dayKey(session.occurredAt)));
    week.sessionIds.push(session.id);
    const p = session.payload;

    if (p.lifting) {
      for (const set of p.lifting.sets) {
        if (set.isWarmup === true) continue; // working sets only
        const cur = week.byPattern[set.movementPattern] ?? { sets: 0, volumeLoadKg: 0 };
        cur.sets += 1;
        cur.volumeLoadKg += set.weightKg * set.reps;
        week.byPattern[set.movementPattern] = cur;
      }
    }

    if (p.endurance) {
      week.byEnergySystem[p.endurance.energySystem].minutes += p.durationMin;
    }
    // climb / hike / other: no measurable pattern volume — sessionIds only.
  }

  return [...byWeek.values()].sort((a, b) =>
    a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0
  );
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
  // Follow the populated sport block, not the coarse modality. This lets every
  // identity that shares a surface read correctly — a Hike or Surf (GPS surface)
  // reveals its distance like a Run — and keeps the line honest when there's no
  // block to speak from. The fallback durationLine prefers the activity identity
  // over the modality (e.g. "wingfoil · 40 min", not "other · 40 min").
  if (p.lifting) return revealLifting(session);
  if (p.endurance) return revealEndurance(session);
  if (p.climbing) return revealClimbing(session);
  return durationLine(session);
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
  const p = session.payload;
  // Prefer the chosen identity over the coarse engine modality — it's the more
  // specific, honest label (e.g. "wingfoil" rather than "other").
  const label = p.activity ?? p.modality;
  return `${label} · ${formatMinutes(p.durationMin)}`;
}

function formatMinutes(min: number): string {
  return `${Math.round(min)} min`;
}

/** 4200 -> "4,200". Integers only; the caller rounds first. */
function groupThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
