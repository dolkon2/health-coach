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

export interface Spot {
  id: string;
  name: string; // "White Salmon — Green Truss", "Hood River sandbar"
  kind: string; // 'river-section' | 'launch' | 'flying-site' | …
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
