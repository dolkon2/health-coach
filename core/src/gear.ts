/**
 * gear.ts — the quiver: gear as a first-class entity (dimension/earth, Pass E1).
 *
 * A Gear row is a fact the user declared ("these are my trail shoes, bought in
 * April"); everything the app *says* about it is derived-on-read from the
 * sessions that tagged it — never a stored odometer that could drift from the
 * timeline it summarizes (⚑ E-4, dev-log/dimension-earth-build.md). Components
 * (chain, cassette…) are child gear rows pointing at their bike via `parentId`,
 * accruing from the parent's sessions from their own `acquiredOn` forward.
 *
 * Thresholds (targetKm, serviceIntervalHr…) are user-set marks, not our advice.
 * gearStatusLine reports where the gear stands relative to the user's own mark
 * — "612 km — past your 500 km mark" — and never tells anyone to do anything
 * (constitution: descriptive, not prescriptive; no alerts, no "replace now").
 *
 * Mirrors the SessionPayload optional-block philosophy: a shared base plus a
 * per-category arm carrying only the spec fields that category actually has.
 */
import type { IANATimezone, ISOInstant, LocalDate } from './observation';
import { localDayOf } from './timeline';

// The merged category union — one arm-set per dimension (Earth land gear,
// Water wind/paddle gear; Sky's air gear joins at its merge). Water's 'wing'
// is the kiteboard/wingfoil wing — Sky's paraglider was renamed 'paraglider'
// on 2026-07-08 precisely so these never collide.
export type EarthGearCategory = 'shoes' | 'boots' | 'bike' | 'bike-component' | 'skis';
export type WaterGearCategory = 'kayak' | 'wing' | 'kite' | 'board' | 'foil' | 'parawing';
export type GearCategory = EarthGearCategory | WaterGearCategory;

export type BikeComponentType =
  | 'chain'
  | 'cassette'
  | 'tires'
  | 'brake-pads'
  | 'fork'
  | 'shock'
  | 'other';

// Per-category spec blocks. Every threshold is optional — a mark the user may
// declare, never a default we invent.
export type ShoeSpec = { targetKm?: number };
export type BootSpec = { targetKm?: number };
export type BikeSpec = Record<string, never>; // the bike itself carries no marks; its components do
export type BikeComponentSpec = {
  componentType: BikeComponentType;
  serviceIntervalKm?: number;
  serviceIntervalHr?: number;
};
export type SkiSpec = { targetDays?: number };

/** Water's flat all-optional spec; which fields are meaningful is keyed by
 * category. wing/kite/parawing: sizeM2 · board: volumeL, boardLengthCm ·
 * foil (front wing): areaCm2, mastLengthCm · kayak: none (Dylan: the boat
 * itself is the whole story — no paddle tracking, no spec). */
export interface GearSpec {
  sizeM2?: number;
  volumeL?: number;
  boardLengthCm?: number;
  areaCm2?: number;
  mastLengthCm?: number;
}

type GearBase = {
  id: string;
  name: string; // the user's own label ("Speedgoats", "SRAM chain")
  parentId?: string; // component → its bike; absent for top-level gear
  acquiredOn?: LocalDate; // when it entered service; gates a component's inherited accrual
  retiredOn?: LocalDate; // set on retire, never deleted — the history it accrued stays real
  notes?: string;
};

export type Gear = GearBase &
  (
    | { category: 'shoes'; spec?: ShoeSpec }
    | { category: 'boots'; spec?: BootSpec }
    | { category: 'bike'; spec?: BikeSpec }
    | { category: 'bike-component'; spec?: BikeComponentSpec }
    | { category: 'skis'; spec?: SkiSpec }
    | { category: WaterGearCategory; spec?: GearSpec }
  );

/**
 * Water's loose gear record — the same rows the `Gear` union describes, seen
 * through Water's storage API (createGearItem & co). Kept alongside `Gear`
 * so neither dimension's tested surface changed at merge time.
 */
export interface GearItem {
  id: string;
  name: string; // "9m Duotone Unit", "Jackson Antix 2.0"
  category: GearCategory;
  spec?: GearSpec;
  acquiredOn?: string; // ISO date
  retiredOn?: string; // set = retired (soft delete; sessions keep the ref)
  notes?: string;
  createdAt: string; // ISO instant
}

/**
 * A named gear combo — the wind rider's "kit" ("Light-wind setup" = board +
 * 9m wing + foil). Picking a kit expands to gearIds on the session block
 * (with kitId kept as provenance), so kits MAY be hard-deleted without
 * orphaning history.
 */
export interface Kit {
  id: string;
  name: string;
  gearIds: string[];
  createdAt: string;
}

// ─── Derived totals ─────────────────────────────────────────────────────────

/**
 * What the timeline says about a piece of gear. `distanceKm` / `durationHr`
 * are undefined — not 0 — when no counted session carried that field (null ≠ 0:
 * an untimed session is unknown time, never zero time). `days` counts distinct
 * civil days, so two laps on one day are one day on the skis.
 */
export type GearTotals = {
  sessions: number;
  distanceKm?: number;
  durationHr?: number;
  days: number;
};

/** The slice of a session Observation the accrual reads — keeps core decoupled
 *  from the full Observation shape (any session-like record can accrue). `tz`
 *  rides along because days and the acquiredOn gate are civil-day questions:
 *  a LocalDate can only be compared against the session's own local day
 *  (observation.ts LocalDate contract), never a UTC slice. */
export type GearSessionLike = {
  occurredAt: ISOInstant;
  tz: IANATimezone;
  payload: {
    gearIds?: string[];
    durationMin?: number;
    endurance?: { distanceM?: number };
  };
};

/**
 * Derive a gear item's totals from the sessions that tagged it. A session
 * counts toward gear G when payload.gearIds includes G.id. A bike-component
 * ALSO inherits sessions tagging its parent bike (resolved through `allGear`,
 * so a dangling parentId inherits nothing), but only from the component's
 * `acquiredOn` forward — a chain fitted in July did not ride June's miles.
 * With no acquiredOn, all parent sessions count (the component has always
 * been on the bike as far as the record knows).
 */
export function deriveGearTotals(
  gear: Gear,
  allGear: Gear[],
  sessions: GearSessionLike[]
): GearTotals {
  const parent =
    gear.category === 'bike-component' && gear.parentId
      ? allGear.find((g) => g.id === gear.parentId)
      : undefined;

  let count = 0;
  let distanceM: number | undefined;
  let durationMin: number | undefined;
  const days = new Set<string>();

  for (const s of sessions) {
    const ids = s.payload.gearIds ?? [];
    const direct = ids.includes(gear.id);
    const viaParent = parent != null && ids.includes(parent.id);
    if (!direct && !viaParent) continue;

    // The session's local civil day, in ITS OWN timezone — a Monday 6pm PST
    // ski is a Monday, whatever UTC date the instant lands on. Both `days`
    // and the acquiredOn gate live in civil-day space (LocalDate contract).
    const day = localDayOf(s.occurredAt, s.tz);
    // Two LocalDates compare lexically; an evening ride the night before a
    // component's install day is pre-install, even when its UTC date matches.
    const inherited =
      viaParent && (gear.acquiredOn == null || day >= gear.acquiredOn);
    if (!direct && !inherited) continue;

    count += 1;
    days.add(day);
    const dM = s.payload.endurance?.distanceM;
    if (dM != null) distanceM = (distanceM ?? 0) + dM;
    if (s.payload.durationMin != null) {
      durationMin = (durationMin ?? 0) + s.payload.durationMin;
    }
  }

  return {
    sessions: count,
    ...(distanceM != null ? { distanceKm: distanceM / 1000 } : {}),
    ...(durationMin != null ? { durationHr: durationMin / 60 } : {}),
    days: days.size,
  };
}

// ─── Status line ────────────────────────────────────────────────────────────

const round = (n: number) => Math.round(n);
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** "612 km — past your 500 km mark" / "213 km of your 500 km mark" — a fact
 *  about where the total stands against the user's own declared mark. */
function markLine(value: number, mark: number, unit: string): string {
  const v = round(value);
  return v >= mark
    ? `${v} ${unit} — past your ${mark} ${unit} mark`
    : `${v} ${unit} of your ${mark} ${unit} mark`;
}

/**
 * One descriptive line for a gear row. States what the record shows — a total,
 * and, when the user set a mark, where the total stands against it. Never an
 * instruction: "past your 500 km mark" is the whole sentence; what to do about
 * it is the user's business (constitution: no "Time to replace!", ever).
 * Totals a session never carried stay unsaid rather than shown as 0.
 */
export function gearStatusLine(gear: Gear, totals: GearTotals): string {
  if (gear.category === 'shoes' || gear.category === 'boots') {
    const mark = gear.spec?.targetKm;
    if (mark != null && totals.distanceKm != null) {
      return markLine(totals.distanceKm, mark, 'km');
    }
  } else if (gear.category === 'bike-component') {
    const spec = gear.spec;
    if (spec?.serviceIntervalKm != null && totals.distanceKm != null) {
      return markLine(totals.distanceKm, spec.serviceIntervalKm, 'km');
    }
    if (spec?.serviceIntervalHr != null && totals.durationHr != null) {
      return markLine(totals.durationHr, spec.serviceIntervalHr, 'hr');
    }
  } else if (gear.category === 'skis') {
    const mark = gear.spec?.targetDays;
    if (mark != null) {
      const d = totals.days;
      return d >= mark
        ? `${d} days — past your ${mark} day mark`
        : `${d} days of your ${mark} day mark`;
    }
    // Skis count days, not distance — a quiver entry's life is measured in days out.
    return `${plural(totals.days, 'day')} this quiver entry`;
  }

  // No mark set (or no data the mark could read): just the totals the record has.
  const base = plural(totals.sessions, 'session');
  return totals.distanceKm != null ? `${base} · ${round(totals.distanceKm)} km` : base;
}
