/**
 * gear.ts — the gear/quiver entity (thin shared base + per-category spec).
 *
 * One entity type, many sports: a kayak, a 9m wing, and (upstream, on other
 * dimension branches) a running shoe are all "a piece of trackable gear".
 * The base is deliberately thin; what varies by sport lives in the optional
 * `spec`, keyed by `category` — the same envelope-plus-bespoke-block pattern
 * SessionPayload uses for surfaces.
 *
 * The category union carries ONLY Water's arms on this branch. Other
 * dimensions append their own arms (shoe, bike, ski, ...) on their branches;
 * union merges are trivial line-add conflicts by design.
 *
 * Gear is never hard-deleted: sessions reference gear ids, so removal is
 * retirement (`retiredOn` set). A retired wing still explains an old session.
 */

export type GearCategory =
  | 'kayak'
  | 'wing'
  | 'kite'
  | 'board'
  | 'foil'
  | 'parawing';

/** Flat all-optional spec; which fields are meaningful is keyed by category.
 * wing/kite/parawing: sizeM2 · board: volumeL, boardLengthCm ·
 * foil (front wing): areaCm2, mastLengthCm · kayak: none (Dylan: the boat
 * itself is the whole story — no paddle tracking, no spec). */
export interface GearSpec {
  sizeM2?: number;
  volumeL?: number;
  boardLengthCm?: number;
  areaCm2?: number;
  mastLengthCm?: number;
}

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
