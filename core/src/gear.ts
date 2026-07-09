/**
 * gear.ts — The gear/quiver entity.
 *
 * A GearItem is NOT an Observation. Observations are things that happened
 * (occurredAt, fidelity, tier); a gear item is a possession — no time of
 * occurrence, no fidelity. It lives in its own `gear` table (modeled on
 * benchmarks / templates).
 *
 * Shape: a thin shared base (id, name, lifecycle dates, notes) plus a bespoke
 * per-category `spec`, discriminated by a top-level `category` — the same
 * envelope-plus-bespoke-block pattern SessionPayload uses for surfaces, and
 * matches earth/water's gear shape. (Cross-branch reconciliation, 2026-07-08:
 * `category` used to live nested inside `spec`, with a derived copy kept on
 * the DB row; flattened to top-level to match the other branches — the DB
 * column doesn't change, only the JSON shape inside `spec` does. The 'wing'
 * category was also renamed to 'paraglider' — water's gear uses 'wing' for
 * an unrelated wind-sport entity, and the two collided once this union was
 * going to merge with theirs.) Each dimension appends its own arms to
 * `GearCategory` at merge time — keep the union one arm per line so appends
 * stay low-conflict.
 */

// ─── Category specs (Sky arms; other dimensions append at merge) ───────────

export type GearCategory = 'paraglider' | 'harness' | 'reserve';

/**
 * `hoursBaseline` = hours flown on this wing before app tracking began; the
 * running total is baseline + summed flight airtime (flights land in a later
 * pass — see paragliderTotalHours). `parakite` is a placeholder style with no
 * bespoke fields yet (research pending).
 */
export type ParagliderSpec = {
  style: 'xc' | 'hikefly' | 'speed' | 'parakite';
  sizeM2?: number;
  certClass?: string; // e.g. 'EN B'
  hoursBaseline?: number;
  lastTrimDate?: string; // ISO date; absent = never logged, no nudge possible
  trimNudgeHours?: number; // user-set flight-hours-since-trim threshold; NO default
};

export type HarnessSpec = Record<string, never>;

/**
 * `repackIntervalMonths` has NO default — a repack cadence is the user's (or
 * their rigger's) call, never prescribed (constitution: descriptive by default).
 */
export type ReserveSpec = {
  lastRepackAt?: string; // ISO date
  repackIntervalMonths?: number;
};

// ─── The gear record ────────────────────────────────────────────────────────

type GearBase = {
  id: string;
  name: string; // user-given, e.g. 'Ozone Rush 6'
  acquiredOn?: string; // ISO date; absent = unknown, never a fabricated date
  retiredOn?: string; // ISO date; set = retired (soft state, row is kept)
  notes?: string;
};

export type GearItem = GearBase &
  (
    | { category: 'paraglider'; spec?: ParagliderSpec }
    | { category: 'harness'; spec?: HarnessSpec }
    | { category: 'reserve'; spec?: ReserveSpec }
  );

/** Union of the bespoke spec shapes — for storage-layer JSON (de)serialization. */
export type GearSpec = ParagliderSpec | HarnessSpec | ReserveSpec;

// ─── Pure helpers ───────────────────────────────────────────────────────────

/**
 * Active = owned and not yet retired at the given instant. An absent
 * `acquiredOn` means the acquisition date is unknown, not that the item isn't
 * owned — the item counts as active (absence never gates). Retirement takes
 * effect AT `retiredOn`.
 */
export function gearIsActive(item: GearItem, atIso: string): boolean {
  const at = Date.parse(atIso);
  if (item.acquiredOn !== undefined && at < Date.parse(item.acquiredOn)) return false;
  if (item.retiredOn !== undefined && at >= Date.parse(item.retiredOn)) return false;
  return true;
}

/**
 * lastRepackAt + repackIntervalMonths as a calendar-month add, returned as a
 * 'YYYY-MM-DD' date (repack scheduling is day-granular). Month-end clamps
 * (Jan 31 + 1mo → Feb 28/29) rather than overflowing like raw JS Date math.
 * Undefined unless BOTH fields are set — no default interval, no invented
 * due date.
 */
export function repackDueAt(spec: ReserveSpec): string | undefined {
  if (spec.lastRepackAt === undefined || spec.repackIntervalMonths === undefined) {
    return undefined;
  }
  const last = new Date(spec.lastRepackAt);
  if (Number.isNaN(last.getTime())) return undefined;

  const monthIndex = last.getUTCMonth() + spec.repackIntervalMonths;
  const year = last.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12; // 0-based
  const daysInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(last.getUTCDate(), daysInTargetMonth);

  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Running total = baseline + tracked flight airtime. Honest when unknown:
 * with no baseline and nothing tracked there is NO total — the wing may carry
 * any amount of pre-app history — so the answer is undefined, never a
 * fabricated 0. A total of 0 is legitimate only when the baseline is
 * explicitly 0. With no baseline but tracked hours on record, the tracked sum
 * is returned — the known floor of the wing's life.
 */
export function paragliderTotalHours(spec: ParagliderSpec, trackedHours: number): number | undefined {
  if (spec.hoursBaseline === undefined) {
    return trackedHours > 0 ? trackedHours : undefined;
  }
  return spec.hoursBaseline + trackedHours;
}

/**
 * Retrim status, passive-display only (constitution: descriptive by default) —
 * never gates, nags, or defaults. Absent when no trim date was ever logged:
 * the question was never asked, so there is nothing to report, ever
 * (sky-research-track-b.md §5 resolved flag 5 — ship across the whole Sky
 * dimension, but only once the user has explicitly logged a trim date).
 *
 * `hoursFlownSinceTrim` is a precomputed aggregate (summed sky-session airtime
 * for this gear item, dated at or after `lastTrimDate`) — this module has no
 * DB access, so the caller supplies it, same pattern as
 * {@link paragliderTotalHours}'s `trackedHours`.
 *
 * `pastMark` is `undefined` (not `false`) when the user never set a
 * `trimNudgeHours` threshold — there is no default interval to compare
 * against, so "not past a mark" would be a fabricated claim.
 */
export function retrimStatus(
  spec: Pick<ParagliderSpec, 'lastTrimDate' | 'trimNudgeHours'>,
  hoursFlownSinceTrim: number
): { hoursSinceTrim: number; pastMark: boolean | undefined } | undefined {
  // An unparseable date is as good as absent (matches repackDueAt's rule) —
  // never build a status on a value that isn't actually a date.
  if (spec.lastTrimDate === undefined || Number.isNaN(Date.parse(spec.lastTrimDate))) {
    return undefined;
  }
  return {
    hoursSinceTrim: hoursFlownSinceTrim,
    pastMark:
      spec.trimNudgeHours !== undefined ? hoursFlownSinceTrim >= spec.trimNudgeHours : undefined,
  };
}
