/**
 * gear.ts — The gear/quiver entity.
 *
 * A GearItem is NOT an Observation. Observations are things that happened
 * (occurredAt, fidelity, tier); a gear item is a possession — no time of
 * occurrence, no fidelity. It lives in its own `gear` table (modeled on
 * benchmarks / templates).
 *
 * Shape: a thin shared base (id, name, lifecycle dates, notes) plus a bespoke
 * per-category `spec`, mirroring the SessionPayload envelope + discriminated-
 * block pattern in observation.ts. Each dimension appends its own arms to
 * `GearCategory` and `GearSpec` at merge time — keep both unions one arm per
 * line so appends stay low-conflict.
 */

// ─── Category specs (Sky arms; other dimensions append at merge) ───────────

export type GearCategory =
  | 'wing'
  | 'harness'
  | 'reserve';

/**
 * `hoursBaseline` = hours flown on this wing before app tracking began; the
 * running total is baseline + summed flight airtime (flights land in a later
 * pass — see wingTotalHours). `parakite` is a placeholder arm with no bespoke
 * fields yet (research pending).
 */
export type WingSpec = {
  category: 'wing';
  style: 'xc' | 'hikefly' | 'speed' | 'parakite';
  sizeM2?: number;
  certClass?: string; // e.g. 'EN B'
  hoursBaseline?: number;
};

export type HarnessSpec = {
  category: 'harness';
};

/**
 * `repackIntervalMonths` has NO default — a repack cadence is the user's (or
 * their rigger's) call, never prescribed (constitution: descriptive by default).
 */
export type ReserveSpec = {
  category: 'reserve';
  lastRepackAt?: string; // ISO date
  repackIntervalMonths?: number;
};

export type GearSpec =
  | WingSpec
  | HarnessSpec
  | ReserveSpec;

// ─── The gear record ────────────────────────────────────────────────────────

export type GearItem = {
  id: string;
  name: string; // user-given, e.g. 'Ozone Rush 6'
  acquiredAt?: string; // ISO date; absent = unknown, never a fabricated date
  retiredAt?: string; // ISO date; set = retired (soft state, row is kept)
  notes?: string;
  spec: GearSpec;
};

// ─── Pure helpers ───────────────────────────────────────────────────────────

/**
 * Active = owned and not yet retired at the given instant. An absent
 * `acquiredAt` means the acquisition date is unknown, not that the item isn't
 * owned — the item counts as active (absence never gates). Retirement takes
 * effect AT `retiredAt`.
 */
export function gearIsActive(item: GearItem, atIso: string): boolean {
  const at = Date.parse(atIso);
  if (item.acquiredAt !== undefined && at < Date.parse(item.acquiredAt)) return false;
  if (item.retiredAt !== undefined && at >= Date.parse(item.retiredAt)) return false;
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
export function wingTotalHours(spec: WingSpec, trackedHours: number): number | undefined {
  if (spec.hoursBaseline === undefined) {
    return trackedHours > 0 ? trackedHours : undefined;
  }
  return spec.hoursBaseline + trackedHours;
}
