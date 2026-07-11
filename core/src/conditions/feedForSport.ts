/**
 * conditions/feedForSport.ts — which conditions feed a spot's sport tag
 * resolves (pinned-spots-spec.md "Sport → feed mapping"). The user tags a
 * spot with a sport (Spot.sport, migration 015) and the feed follows
 * automatically — nobody picks a condition card by hand.
 *
 * Pure activity-id matching, no dependency on the app-layer activity
 * registry (src/lib/activity.ts) — core stays dependency-free, and
 * Spot.sport is already documented as "an activity id from the registry,
 * not a new enum", so matching the literal ids here is the correct layer.
 *
 * MVP: only 'gauge' has a display card (Pinned Spots P2/P3). 'wind' and
 * 'swell' classify correctly now so the spot list/detail can show a
 * "link a gauge" vs "no feed for this sport" distinction honestly, even
 * before their cards ship (pinned-spots-spec.md post-MVP ladder).
 */

export type ConditionsFeed = 'gauge' | 'wind' | 'swell';

const GAUGE_ACTIVITY_IDS = new Set(['kayak', 'whitewater']);

// Wind family: Water's wind sports (wingfoil/windsurf/kitesurf/parawing/sail)
// plus Sky's paraglide/hike-&-fly, per the spec's table verbatim. Speedflying
// and parakiting are deliberately NOT included — the spec names only these
// two Sky activities for the wind feed; extending it to the rest of Sky's
// registry would be a guess, not a documented mapping.
const WIND_ACTIVITY_IDS = new Set([
  'wingfoil',
  'windsurf',
  'kitesurf',
  'parawing',
  'sail',
  'paragliding',
  'hikeAndFly',
]);

const SWELL_ACTIVITY_IDS = new Set(['surf']);

/** The conditions feed a sport tag resolves, or null for weather-only
 *  activities (run, hike, ride, climb, …) and untagged spots. */
export function feedForSport(sport: string | undefined | null): ConditionsFeed | null {
  if (!sport) return null;
  if (GAUGE_ACTIVITY_IDS.has(sport)) return 'gauge';
  if (WIND_ACTIVITY_IDS.has(sport)) return 'wind';
  if (SWELL_ACTIVITY_IDS.has(sport)) return 'swell';
  return null;
}
