/**
 * ushpaLedger.ts — cumulative flight facts, readable against USHPA rating
 * requirements.
 *
 * DESCRIPTIVE ONLY (constitution clause 1): the ledger reports what the logbook
 * proves — flights, hours, days, sites — for pilots who want to see their
 * numbers. It never nags, enforces, or gamifies; most pilots don't care about
 * strict compliance and the app doesn't either.
 *
 * Requirements are DATA the caller passes (RatingRequirement), never behavior
 * baked into the engine — the P3 numbers live in one constant, not in code
 * paths. Comparison verdicts are proven with BOUNDS, echoing the three-valued
 * day math (nutrition/days.ts, no shared types): `uniqueSites` counts only
 * flights that NAME a site, so it is a lower bound on true site diversity —
 * a sites requirement is met the moment the bound crosses it, provably unmet
 * only when even the siteless flights couldn't close the gap, and otherwise
 * honestly unprovable. Siteless flights still count toward flights/hours/days
 * (those need no site to be facts); they just can't prove diversity.
 *
 * Input is deliberately decoupled from the not-yet-final flight schema:
 * FlightFact is the minimal shape the math needs, and the adapter from real
 * flight records lands app-side when that schema settles.
 */
import type { LocalDate } from './observation';

export type FlightStyle = 'xc' | 'hikefly' | 'speed' | 'parakite';

export type FlightFact = {
  dateLocal: LocalDate; // 'YYYY-MM-DD' in the pilot's local civil day
  airtimeMin: number;
  spotId?: string;
  style: FlightStyle;
};

/** USHPA scope per product decision: foot-launched free flight. Speedflying
 *  and parakiting sit outside it — one-line change to adjust. */
export const DEFAULT_COUNTED_STYLES: FlightFact['style'][] = ['xc', 'hikefly'];

export type LedgerOptions = {
  countedStyles?: FlightFact['style'][]; // default DEFAULT_COUNTED_STYLES
};

export type UshpaLedger = {
  totalFlights: number;
  /** Sum of airtimeMin / 60, full resolution — rounding is the display's job. */
  totalHours: number;
  /** Distinct dateLocal values — two flights on one day are one flying day. */
  flyingDays: number;
  /** Distinct spotId among flights that HAVE one — a lower bound on diversity. */
  uniqueSites: number;
  /** Counted flights with no site: they count toward flights/hours/days but
   *  cannot prove site diversity. Named, never folded away. */
  flightsWithoutSite: number;
};

/** Cumulative facts over the counted styles. Pure fold, no thinning. */
export function computeUshpaLedger(flights: FlightFact[], opts: LedgerOptions = {}): UshpaLedger {
  const counted = new Set(opts.countedStyles ?? DEFAULT_COUNTED_STYLES);
  const days = new Set<LocalDate>();
  const sites = new Set<string>();
  let totalFlights = 0;
  let airtimeMin = 0;
  let flightsWithoutSite = 0;

  for (const f of flights) {
    if (!counted.has(f.style)) continue;
    totalFlights += 1;
    airtimeMin += f.airtimeMin;
    days.add(f.dateLocal);
    // An empty-string id names nothing — same honesty as absent.
    if (f.spotId) sites.add(f.spotId);
    else flightsWithoutSite += 1;
  }

  return {
    totalFlights,
    totalHours: airtimeMin / 60,
    flyingDays: days.size,
    uniqueSites: sites.size,
    flightsWithoutSite,
  };
}

/** A rating's requirements, as data. Absent fields mean the rating doesn't
 *  require that metric (or the caller doesn't track it) — never zero. */
export type RatingRequirement = {
  rating: string;
  flights?: number;
  hours?: number;
  flyingDays?: number;
  sites?: number;
};

/** P3 (Intermediate) — from product spec (Notion). */
export const USHPA_P3: RatingRequirement = { rating: 'P3', flights: 90, hours: 20, flyingDays: 30 };
// No P4 constant yet: the real P4 numbers were not verified against the USHPA
// SOP — it lands once verified, never guessed.

export type RequirementFact = {
  have: number;
  need: number;
  /** Proven met — the ledger's (lower-bound) count crossed the need. */
  met: boolean;
  /** False only when the data can't settle it: siteless flights could hide the
   *  missing sites, so `met: false, provable: false` reads "not proven, not
   *  disproven" — the unknowable middle, as facts. */
  provable: boolean;
};

/** Per-metric facts for the metrics the requirement names — absent otherwise. */
export type LedgerComparison = {
  rating: string;
  flights?: RequirementFact;
  hours?: RequirementFact;
  flyingDays?: RequirementFact;
  sites?: RequirementFact;
};

/** flights/hours/days are complete counts — always settled one way or the other. */
function completeFact(have: number, need: number): RequirementFact {
  return { have, need, met: have >= need, provable: true };
}

/**
 * The ledger against one rating's numbers — just { have, need, met } facts.
 * Sites use the bound: met when the named-site count alone crosses the need;
 * provably short only when every siteless flight at a distinct new site still
 * couldn't reach it; otherwise unprovable.
 */
export function ledgerAgainst(ledger: UshpaLedger, req: RatingRequirement): LedgerComparison {
  const out: LedgerComparison = { rating: req.rating };

  if (req.flights != null) out.flights = completeFact(ledger.totalFlights, req.flights);
  if (req.hours != null) out.hours = completeFact(ledger.totalHours, req.hours);
  if (req.flyingDays != null) out.flyingDays = completeFact(ledger.flyingDays, req.flyingDays);

  if (req.sites != null) {
    const met = ledger.uniqueSites >= req.sites;
    const deadShort = ledger.uniqueSites + ledger.flightsWithoutSite < req.sites;
    out.sites = { have: ledger.uniqueSites, need: req.sites, met, provable: met || deadShort };
  }

  return out;
}
