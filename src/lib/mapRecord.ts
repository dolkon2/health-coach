/**
 * mapRecord.ts — pure helpers for the Map tab's Record pre-start surface
 * (planning/rework/tabs/map-tab.md M1). Kept free of expo-location / MapLibre so
 * the arming, pin-filtering, accuracy, and camera-centering logic is unit-tested
 * without the native modules (which the screen loads lazily, like useGpsTracker).
 */
import type { Spot } from '@core/spot';
import type { ObservationOf } from '@core/observation';
import type { LngLat } from '@/components/mapLibre';
import { activityById, elementOf, pickable, type Activity } from './activity';
import {
  defaultActivityForElement,
  mostRecentActivityByElement,
  archetypeActivity,
  type MapElement,
} from './mostRecentActivity';

function isMapElement(x: string | undefined): x is MapElement {
  return x === 'earth' || x === 'water' || x === 'sky';
}

/** True when the activity belongs to a GPS-recordable element (Earth/Water/Sky). */
export function isRecordableActivity(a: Activity): boolean {
  return isMapElement(elementOf(a));
}

/**
 * The sport the Record button arms, resolved (in priority order) from:
 *   1. a deep-linked activity id (the Home element-picker contract),
 *   2. a deep-linked element → that element's default (most-recent, else archetype),
 *   3. the single most-recently-logged Earth/Water/Sky activity,
 *   4. a neutral archetype (Earth → trail run) when there's no history at all.
 * Always returns an activity — the arm control is never empty. The deep link's
 * choice is a default, not a lock: the user can re-arm freely before recording
 * (map-tab.md §2).
 */
export function resolveArmedActivity(opts: {
  activityParam?: string;
  elementParam?: string;
  sessionsNewestFirst: ReadonlyArray<ObservationOf<'session'>>;
}): Activity {
  const { activityParam, elementParam, sessionsNewestFirst } = opts;

  if (activityParam) {
    const a = activityById(activityParam);
    // Only a GPS-recordable activity arms the map; a Body deep-link (which Home
    // routes to Training anyway) falls through rather than showing "Gym" here.
    if (a && pickable(a) && isRecordableActivity(a)) return a;
  }

  const mostRecent = mostRecentActivityByElement(sessionsNewestFirst);

  if (isMapElement(elementParam)) {
    return defaultActivityForElement(elementParam, mostRecent);
  }

  for (const session of sessionsNewestFirst) {
    const id = session.payload.activity;
    if (!id) continue;
    const a = activityById(id);
    if (a && pickable(a) && isRecordableActivity(a)) return a;
  }

  return archetypeActivity('earth');
}

/** Spots that carry real coordinates — only these can be dropped as map pins.
 *  River-section spots often carry a gauge instead of a point; they're honestly
 *  absent from the map rather than pinned at a fabricated location. */
export function spotsWithCoords(
  spots: ReadonlyArray<Spot>
): Array<Spot & { lat: number; lng: number }> {
  return spots.filter(
    (s): s is Spot & { lat: number; lng: number } =>
      typeof s.lat === 'number' &&
      typeof s.lng === 'number' &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng)
  );
}

export type AccuracyLevel = 'good' | 'weak' | 'unknown';

/** GPS fix accuracy → a chip level. >50 m is "weak signal — points may scatter"
 *  (map-tab.md §3); a missing reading is unknown, never silently "good". */
export function accuracyLevel(accuracyM: number | null | undefined): AccuracyLevel {
  if (accuracyM == null || !Number.isFinite(accuracyM)) return 'unknown';
  return accuracyM > 50 ? 'weak' : 'good';
}

/**
 * Where the camera starts: the user's own fix if we have one, else the centroid
 * of pinnable spots, else nothing at all — center AND zoom both undefined, so
 * the caller omits the Camera and the map keeps the style's own default view.
 * We never invent a location (a bare zoom with no center parks MapLibre at
 * [0,0]). Zoom tightens when we're centering on the user.
 */
export function resolveMapCenter(opts: {
  userLoc?: LngLat | null;
  spots: ReadonlyArray<Spot>;
}): { center?: LngLat; zoom?: number } {
  const { userLoc, spots } = opts;
  if (userLoc) return { center: userLoc, zoom: 13 };

  const pinned = spotsWithCoords(spots);
  if (pinned.length > 0) {
    const lng = pinned.reduce((sum, s) => sum + s.lng, 0) / pinned.length;
    const lat = pinned.reduce((sum, s) => sum + s.lat, 0) / pinned.length;
    return { center: [lng, lat], zoom: 10 };
  }

  return {};
}
