/**
 * Migration 015 — spots_sport (Pinned Spots P1, pinned-spots-spec.md).
 *
 * Adds the user-facing sport tag a spot's conditions feed resolves from
 * (feedForSport.ts) — an activity id from the existing registry
 * (src/lib/activity.ts), not a new enum. `kind` stays the structural
 * discriminator SpotPicker's existing flows key on; `sport` is additive.
 *
 * Conservative backfill, only where unambiguous:
 *   - 'river-section' → 'kayak' (Water's whitewater spots)
 *   - 'flying-site'   → 'paragliding' (Sky's flying spots — the spec's prose
 *     says "paraglide", but the actual registry id in src/lib/activity.ts is
 *     'paragliding'; using the registry id is what actually makes
 *     activityById/feedForSport resolve the spot's icon and wind feed)
 *   - 'launch' stays NULL — Water's wind spots could be wing or downwind;
 *     ambiguous, so untagged (surfaces in the spots list's "untagged" group
 *     with a one-tap tag prompt, per the spec — Dylan tags them by hand).
 *   - any other/legacy `kind` stays NULL too, same reasoning.
 */
import type { Migration } from './index';

export const migration015: Migration = {
  version: 15,
  name: 'spots_sport',
  sql: `
    ALTER TABLE spots ADD COLUMN sport TEXT;
    UPDATE spots SET sport = 'kayak' WHERE kind = 'river-section';
    UPDATE spots SET sport = 'paragliding' WHERE kind = 'flying-site';
  `,
};
