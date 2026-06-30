/**
 * normalize.ts — pure conversion from raw wearable samples to Observations.
 *
 * No native imports. No SQLite. No `Date.now()` outside small explicit spots.
 * The whole module is unit-testable in plain jest — that's the point of the
 * `wearable.ts` data shape.
 *
 * Two contracts kept here, both load-bearing:
 *
 *   1. Source precedence — for each civil day, ONE source's number wins.
 *      Never sum across sources (wearable-ingestion-spec.md § dedup).
 *   2. Sleep attribution — duration attributes to the WAKE day (the civil day
 *      the sleep ended). Documented visibly per the spec.
 */
import type {
  IANATimezone,
  ISOInstant,
  LocalDate,
  Observation,
  ObservationOf,
} from '@core/observation';
import type {
  RawDailyStepSample,
  RawSleepSample,
  RawSleepStage,
} from '@/lib/wearable';
import { uuidv7 } from '@/lib/id';
import { pickAuthoritativeSource } from './sourcePrecedence';

const STEPS_FIDELITY = 0.9;
const SLEEP_FIDELITY = 0.85;

/** Sleep stages we count toward the tier-1 duration. inBed is excluded
 *  (it over-counts); awake is excluded. */
const ASLEEP_STAGES: ReadonlySet<RawSleepStage> = new Set([
  'asleepUnspecified',
  'asleepCore',
  'asleepDeep',
  'asleepREM',
]);

/** ISO instant for end-of-civil-day in the given tz. We use end-of-day rather
 *  than midnight or noon so a same-day weigh-in (occurred earlier) sorts before
 *  the day's auto-imported steps/sleep in the timeline. */
function endOfLocalDayUtc(date: LocalDate): ISOInstant {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** Civil day of an instant in the local zone (the zone JS uses for `new Date()`
 *  arithmetic — which on the device matches the user's tz at read time). */
function civilDay(iso: ISOInstant): LocalDate {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function durationMin(startUtc: ISOInstant, endUtc: ISOInstant): number {
  return Math.max(0, (new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 60000);
}

// ─── Steps ──────────────────────────────────────────────────────────────────

/** Group per-source daily totals by civil day, then keep one source's total
 *  per day per the source-precedence rule. */
export function normalizeSteps(
  raw: readonly RawDailyStepSample[],
  ctx: { tz: IANATimezone; nowUtc: ISOInstant }
): ObservationOf<'steps'>[] {
  const byDate = new Map<LocalDate, RawDailyStepSample[]>();
  for (const r of raw) {
    if (r.count <= 0) continue;
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }

  const out: ObservationOf<'steps'>[] = [];
  for (const [date, candidates] of byDate) {
    const chosen = pickAuthoritativeSource(candidates);
    if (!chosen) continue;
    out.push({
      id: uuidv7(),
      kind: 'steps',
      occurredAt: endOfLocalDayUtc(date),
      loggedAt: ctx.nowUtc,
      tz: ctx.tz,
      tier: 1,
      fidelity: STEPS_FIDELITY,
      source: { type: 'healthkit', rawType: 'HKQuantityTypeIdentifierStepCount' },
      payload: { kind: 'steps', count: Math.round(chosen.count) },
    });
  }
  // Sort by date ascending so callers don't have to.
  out.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return out;
}

// ─── Sleep ──────────────────────────────────────────────────────────────────

type WakeDayGroup = {
  date: LocalDate; // the WAKE day, civil-day(endUtc)
  bySource: Map<string, RawSleepSample[]>; // bundleId → samples ending on this day
  sources: Map<string, { sourceBundleId: string; sourceName: string }>;
};

/** Sleep samples → one Observation per wake day, from the authoritative source
 *  for that night. Stages are populated when the source provided staged values. */
export function normalizeSleep(
  raw: readonly RawSleepSample[],
  ctx: { tz: IANATimezone; nowUtc: ISOInstant }
): ObservationOf<'sleep'>[] {
  const groups = new Map<LocalDate, WakeDayGroup>();
  for (const s of raw) {
    const date = civilDay(s.endUtc); // wake-day attribution rule
    let g = groups.get(date);
    if (!g) {
      g = { date, bySource: new Map(), sources: new Map() };
      groups.set(date, g);
    }
    const list = g.bySource.get(s.sourceBundleId) ?? [];
    list.push(s);
    g.bySource.set(s.sourceBundleId, list);
    if (!g.sources.has(s.sourceBundleId)) {
      g.sources.set(s.sourceBundleId, {
        sourceBundleId: s.sourceBundleId,
        sourceName: s.sourceName,
      });
    }
  }

  const out: ObservationOf<'sleep'>[] = [];
  for (const [date, g] of groups) {
    const chosen = pickAuthoritativeSource([...g.sources.values()]);
    if (!chosen) continue;
    const samples = g.bySource.get(chosen.sourceBundleId) ?? [];

    let asleepMin = 0;
    let deepMin = 0;
    let remMin = 0;
    let lightMin = 0; // asleepCore + asleepUnspecified (legacy)
    let awakeMin = 0;
    let hasStages = false;

    for (const s of samples) {
      const mins = durationMin(s.startUtc, s.endUtc);
      switch (s.stage) {
        case 'asleepDeep':
          asleepMin += mins;
          deepMin += mins;
          hasStages = true;
          break;
        case 'asleepREM':
          asleepMin += mins;
          remMin += mins;
          hasStages = true;
          break;
        case 'asleepCore':
          asleepMin += mins;
          lightMin += mins;
          hasStages = true;
          break;
        case 'asleepUnspecified':
          asleepMin += mins;
          lightMin += mins; // unstaged "asleep" lumps with light
          break;
        case 'awake':
          awakeMin += mins;
          break;
        case 'inBed':
          // intentionally ignored — inBed over-counts.
          break;
      }
    }

    if (asleepMin <= 0) continue;

    const obs: ObservationOf<'sleep'> = {
      id: uuidv7(),
      kind: 'sleep',
      occurredAt: endOfLocalDayUtc(date),
      loggedAt: ctx.nowUtc,
      tz: ctx.tz,
      tier: 1,
      fidelity: SLEEP_FIDELITY,
      source: {
        type: 'healthkit',
        rawType: 'HKCategoryTypeIdentifierSleepAnalysis',
      },
      payload: hasStages
        ? {
            kind: 'sleep',
            durationMin: Math.round(asleepMin),
            stages: {
              deepMin: Math.round(deepMin),
              remMin: Math.round(remMin),
              lightMin: Math.round(lightMin),
              awakeMin: Math.round(awakeMin),
            },
          }
        : { kind: 'sleep', durationMin: Math.round(asleepMin) },
    };
    out.push(obs);
  }
  out.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return out;
}

// ─── Dedup against existing storage ─────────────────────────────────────────

/** True if `existing` already covers the same kind on the same civil day from
 *  a healthkit source. Used by the ingest layer to skip inserts that would
 *  duplicate yesterday's row when the user re-opens Today this morning. */
export function isAlreadyImported(
  existing: readonly Observation[],
  candidate: ObservationOf<'steps'> | ObservationOf<'sleep'>
): boolean {
  const candDay = civilDay(candidate.occurredAt);
  for (const o of existing) {
    if (o.kind !== candidate.kind) continue;
    if (o.source.type !== 'healthkit') continue;
    if (civilDay(o.occurredAt) === candDay) return true;
  }
  return false;
}
