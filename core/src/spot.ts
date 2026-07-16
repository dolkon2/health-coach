/**
 * spot.ts — the named-place primitive (cross-dimension).
 *
 * A Spot is a named point on the map, where condition sources hang: a
 * whitewater river section carries its home gauge (picked once per river,
 * then every session on that section freezes from the same gauge); a wind
 * launch or flying site carries the coordinates its wind/aloft snapshot is
 * fetched for. Session blocks denormalize the names they display, so a
 * renamed or deleted spot never rewrites history.
 *
 * Merged shape (2026-07-09 dimension merge): Water's typed river columns
 * PLUS Sky's free-string `kind` + `meta` bag. `kind` stays a free string —
 * 'river-section' and 'launch' (Water), 'flying-site' (Sky); new dimensions
 * add kinds without touching this type. Dimension-specific facts that don't
 * deserve a column live in `meta`, read through typed helpers that return
 * `undefined` when the fact was never recorded — absence is never fabricated
 * into false.
 */

import { defaultForecastPanels, type ForecastPanel } from './conditions/feedForSport';

export type { ForecastPanel };

export interface Spot {
  id: string;
  name: string; // "White Salmon — Green Truss", "Hood River sandbar"
  kind: string; // 'river-section' | 'launch' | 'flying-site' | …
  /**
   * User-facing sport tag (Pinned Spots P1, migration 015) — an activity id
   * from the existing registry (src/lib/activity.ts), not a new enum.
   * Resolves the spot's conditions feed (feedForSport.ts): tag it 'kayak'
   * and the gauge card appears, no manual feed picking. `kind` stays the
   * structural discriminator legacy flows key on; the two fields collapse
   * eventually (⚑ pinned-spots-spec.md flag 1). Absent = untagged.
   */
  sport?: string;
  /** Required in practice for launch/flying-site spots — the wind/aloft fetch needs coords. */
  lat?: number;
  lng?: number;
  /** Dimension-specific facts (Sky: ushpaAffiliated, requiresMembership, …). */
  meta?: Record<string, unknown>;
  /** River-section spots. */
  riverName?: string;
  sectionName?: string;
  /** Home gauge, agency-prefixed ('USGS-14123500'). */
  gaugeSiteId?: string;
  notes?: string;
  /** Storage bookkeeping — present on reads; writes may omit it (stamped at insert). */
  createdAt?: string; // ISO instant
}

/**
 * Does flying this site require USHPA membership? Reads the Sky-specific
 * `requiresMembership` boolean out of `meta`; `undefined` when the fact was
 * never recorded (or recorded as something other than a boolean) — an
 * unrecorded requirement is unknown, not "no".
 */
export function spotRequiresUshpaMembership(spot: Spot): boolean | undefined {
  const v = spot.meta?.requiresMembership;
  return typeof v === 'boolean' ? v : undefined;
}

/**
 * Which forecast panels this spot's dashboard shows (F1, forecast-tab.md
 * §2a). Unlike `spotRequiresUshpaMembership` above, an unrecorded spot does
 * NOT resolve to "unknown" — the sport-derived default (`defaultForecastPanels`)
 * is an obvious call, not an absent fact, so this always returns a concrete
 * list. A recorded `meta.forecastPanels` always wins over the default.
 */
export function spotForecastPanels(spot: Spot): ForecastPanel[] {
  const recorded = spot.meta?.forecastPanels;
  if (Array.isArray(recorded) && recorded.length > 0 && recorded.every((p) => typeof p === 'string')) {
    return recorded as ForecastPanel[];
  }
  return defaultForecastPanels(spot.sport);
}
