/**
 * mostRecentActivity.ts — Home's element-picker default resolution (H1,
 * planning/rework/tabs/home-tab.md § 3).
 *
 * For Earth/Sky/Water, the element picker's primary action defaults to the
 * user's most-recently-logged activity in that element — a JS scan over
 * recent session observations (same rationale as `listSessionsForSpot`:
 * payloads are JSON blobs, single-user local DB, no index worth building for
 * this). Falls back to a fixed archetype per element when no history exists —
 * a voice-level suggestion only (home-tab.md ⚑2), never a "counts more" signal.
 */
import { activityById, elementOf, pickable, type Activity } from './activity';
import type { ObservationOf } from '@core/observation';

/** The three elements the picker's primary-action row applies to — Body has
 *  no most-recent/archetype resolution (it routes to Training, never a logger). */
export type MapElement = 'earth' | 'water' | 'sky';

/** home-tab.md § 3: "the archetype activity (Earth → trail run, Sky →
 *  paraglide, Water → kayak) — voice anchor only, freely changeable, no
 *  'counts more' logic anywhere." */
const ARCHETYPE_ID: Record<MapElement, string> = {
  earth: 'trail-run',
  water: 'kayak',
  sky: 'paragliding',
};

export function archetypeActivity(element: MapElement): Activity {
  const a = activityById(ARCHETYPE_ID[element]);
  if (!a) throw new Error(`archetype activity missing from registry: ${ARCHETYPE_ID[element]}`);
  return a;
}

/**
 * Scans sessions newest-first (as `useSessionHistory` returns them) and
 * returns the most recent resolvable activity per Earth/Water/Sky element.
 * Sessions logged with no `activity` id (legacy, or modality-only quick-logs)
 * are skipped — they can't name a specific activity to default to. Sessions
 * whose activity is no longer `pickable` (deprecated, or pending delete-review)
 * are skipped too — the picker's default must never surface something every
 * other picker in the app hides.
 */
export function mostRecentActivityByElement(
  sessionsNewestFirst: ReadonlyArray<ObservationOf<'session'>>
): Partial<Record<MapElement, Activity>> {
  const found: Partial<Record<MapElement, Activity>> = {};
  const remaining = new Set<MapElement>(['earth', 'water', 'sky']);
  for (const session of sessionsNewestFirst) {
    if (remaining.size === 0) break;
    const activityId = session.payload.activity;
    if (!activityId) continue;
    const activity = activityById(activityId);
    if (!activity || !pickable(activity)) continue;
    const element = elementOf(activity);
    if ((element === 'earth' || element === 'water' || element === 'sky') && remaining.has(element)) {
      found[element] = activity;
      remaining.delete(element);
    }
  }
  return found;
}

/** The row's primary activity: most-recent if logged, else the archetype. */
export function defaultActivityForElement(
  element: MapElement,
  mostRecent: Partial<Record<MapElement, Activity>>
): Activity {
  return mostRecent[element] ?? archetypeActivity(element);
}
