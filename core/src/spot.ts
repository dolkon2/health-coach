/**
 * spot.ts — the Spot/place entity (cross-dimension primitive).
 *
 * A Spot is a named point on the map: Sky uses it for flying sites now; Water
 * will reuse it for put-ins and wind-launches at merge. The base stays THIN —
 * id, name, coordinates, a free-string `kind` discriminator — and everything
 * dimension-specific lives in `meta`, so other dimensions add kinds without
 * touching this type.
 *
 * Sky's access facts (ushpaAffiliated / requiresMembership) are descriptive
 * site facts in `meta`, read through typed helpers that return `undefined`
 * when the fact was never recorded — absence is never fabricated into false.
 */

export type Spot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: string; // free string: 'flying-site' for Sky; other dimensions add their own
  meta?: Record<string, unknown>;
  notes?: string;
};

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
