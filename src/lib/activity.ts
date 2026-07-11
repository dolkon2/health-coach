/**
 * activity.ts — the identity layer of the three-layer logging model.
 *
 * The user picks an *activity* (an identity: Run, Calisthenics, Wingfoil). Each
 * activity points at a logging *surface* (the form shape) and carries the nearest
 * engine *modality* (what core/stimulus reads). Many identities share one surface —
 * Calisthenics and Strength both log on the gym surface; Run, Ride, Hike, Paddle,
 * Surf, Wingfoil, Ski all share the GPS surface. Adding a new activity is a data
 * edit here, not new UI or engine code (training-logging-spec.md, three-layer model).
 *
 * Pure data + lookups: no React, no storage (matches lib/session.ts). The UI maps
 * `icon` (a name) to a component, so this file stays platform-free and tests read
 * it directly.
 *
 * Pass 1 scope: the registry + the lookups the Training tab needs. Surfaces other
 * than gym/gps/climbing don't have dedicated forms yet (swim → Pass 5, practice →
 * Pass 6); until then the picker routes by `modality` into the existing logger, and
 * identity is not yet persisted on the Observation (that's Pass 2's `activity` field).
 * `defaultEnergySystem` / `defaultIdentityTags` are carried now, consumed by later
 * passes.
 */
import type { EnergySystem, Modality } from '@core/observation';
import type { GearCategory } from '@core/gear';

/** The six logging surfaces (form shapes). Many activities map to each. */
export type Surface = 'gym' | 'gps' | 'swim' | 'practice' | 'climbing' | 'sky';

export type Activity = {
  id: string; // stable identity id, e.g. 'calisthenics'
  label: string; // user-facing, e.g. 'Calisthenics'
  surface: Surface; // which logging surface it routes to
  modality: Modality; // nearest engine modality — what the stimulus engine reads
  icon: string; // lucide icon name; the UI resolves it to a component
  defaultEnergySystem?: EnergySystem; // GPS / swim default (consumed Pass 2+)
  defaultIdentityTags?: string[]; // seeds identity tags (consumed Pass 8)
  // Hidden from the pickers but NEVER removed: activityById must keep resolving
  // it so historic sessions still display and edit-round-trip losslessly (removal
  // would drop their sport block via the surface-'other' fallback in lib/session).
  deprecated?: true;
  gearCategories?: GearCategory[]; // which quiver categories this activity's logger offers (E1)
};

export const ACTIVITIES: Activity[] = [
  // ── gym surface ──
  { id: 'gym', label: 'Gym', surface: 'gym', modality: 'gym', icon: 'dumbbell', defaultIdentityTags: ['strength'] },
  { id: 'strength', label: 'Strength', surface: 'gym', modality: 'gym', icon: 'dumbbell', defaultIdentityTags: ['strength'] },
  { id: 'calisthenics', label: 'Calisthenics', surface: 'gym', modality: 'gym', icon: 'dumbbell', defaultIdentityTags: ['calisthenics'] },
  { id: 'crossfit', label: 'CrossFit', surface: 'gym', modality: 'gym', icon: 'dumbbell', defaultIdentityTags: ['functional'] },
  // ── gps surface (Run/Ride/Hike/Paddle render today; Surf/Wingfoil/Ski land with the GPS surface, Pass 2) ──
  { id: 'run', label: 'Run', surface: 'gps', modality: 'run', icon: 'footprints', defaultEnergySystem: 'aerobic', gearCategories: ['shoes'] },
  { id: 'ride', label: 'Ride', surface: 'gps', modality: 'ride', icon: 'bike', defaultEnergySystem: 'aerobic', gearCategories: ['bike'] },
  { id: 'hike', label: 'Hike', surface: 'gps', modality: 'hike', icon: 'mountain', defaultEnergySystem: 'aerobic', gearCategories: ['boots', 'shoes'] },
  { id: 'paddle', label: 'Paddle', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'surf', label: 'Surf', surface: 'gps', modality: 'surf', icon: 'waves', defaultEnergySystem: 'mixed' },
  { id: 'wingfoil', label: 'Wingfoil', surface: 'gps', modality: 'other', icon: 'wind', defaultEnergySystem: 'mixed' },
  { id: 'ski', label: 'Ski', surface: 'gps', modality: 'other', icon: 'snowflake', defaultEnergySystem: 'mixed', gearCategories: ['skis'] },
  // ── gps surface, sport-expansion batch (outdoor-integrations.md v0.2 "add-now" triage) ──
  { id: 'walk', label: 'Walk', surface: 'gps', modality: 'hike', icon: 'footprints', defaultEnergySystem: 'aerobic', gearCategories: ['boots', 'shoes'] },
  { id: 'ruck', label: 'Ruck', surface: 'gps', modality: 'hike', icon: 'backpack', defaultEnergySystem: 'aerobic', defaultIdentityTags: ['rucking'], gearCategories: ['boots', 'shoes'] },
  { id: 'trail-run', label: 'Trail run', surface: 'gps', modality: 'run', icon: 'mountain', defaultEnergySystem: 'aerobic', gearCategories: ['shoes'] },
  { id: 'mtb', label: 'Mountain bike', surface: 'gps', modality: 'ride', icon: 'bike', defaultEnergySystem: 'mixed', gearCategories: ['bike'] },
  { id: 'kayak', label: 'Kayak', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'whitewater', label: 'Whitewater', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'mixed', defaultIdentityTags: ['whitewater'] },
  { id: 'sup', label: 'SUP', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'canoe', label: 'Canoe', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'row', label: 'Row', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'sail', label: 'Sail', surface: 'gps', modality: 'other', icon: 'wind', defaultEnergySystem: 'aerobic' },
  { id: 'windsurf', label: 'Windsurf', surface: 'gps', modality: 'other', icon: 'wind', defaultEnergySystem: 'mixed' },
  { id: 'kitesurf', label: 'Kitesurf', surface: 'gps', modality: 'other', icon: 'wind', defaultEnergySystem: 'mixed' },
  { id: 'parawing', label: 'Parawing', surface: 'gps', modality: 'other', icon: 'wind', defaultEnergySystem: 'mixed' },
  { id: 'snowboard', label: 'Snowboard', surface: 'gps', modality: 'other', icon: 'snowflake', defaultEnergySystem: 'mixed', gearCategories: ['skis'] },
  { id: 'ski-touring', label: 'Ski touring', surface: 'gps', modality: 'hike', icon: 'snowflake', defaultEnergySystem: 'aerobic', defaultIdentityTags: ['backcountry'], gearCategories: ['skis'] },
  { id: 'xc-ski', label: 'XC ski', surface: 'gps', modality: 'other', icon: 'snowflake', defaultEnergySystem: 'aerobic', gearCategories: ['skis'] },
  { id: 'snowshoe', label: 'Snowshoe', surface: 'gps', modality: 'hike', icon: 'snowflake', defaultEnergySystem: 'aerobic', gearCategories: ['boots', 'shoes'] },
  { id: 'skate', label: 'Skate', surface: 'gps', modality: 'other', icon: 'footprints', defaultEnergySystem: 'mixed' },
  // ── sky surface (Sky dimension: paragliding/hike&fly/speedflying/parakiting; segmented tracks, USHPA ledger) ──
  { id: 'paragliding', label: 'Paraglide', surface: 'sky', modality: 'other', icon: 'wind', defaultIdentityTags: ['flying'] },
  { id: 'hikeAndFly', label: 'Hike & Fly', surface: 'sky', modality: 'other', icon: 'wind', defaultIdentityTags: ['flying'] },
  { id: 'speedflying', label: 'Speedfly', surface: 'sky', modality: 'other', icon: 'wind', defaultIdentityTags: ['flying'] },
  { id: 'parakiting', label: 'Parakite', surface: 'sky', modality: 'other', icon: 'wind', defaultIdentityTags: ['flying'] },
  // ── swim surface (form lands Pass 5) ──
  { id: 'swim', label: 'Swim', surface: 'swim', modality: 'swim', icon: 'waves', defaultEnergySystem: 'aerobic' },
  // ── climbing surface ──
  { id: 'climb', label: 'Climb', surface: 'climbing', modality: 'climb', icon: 'mountain', defaultIdentityTags: ['climbing'] },
  // ── practice surface (form lands Pass 6) ──
  { id: 'yoga', label: 'Yoga', surface: 'practice', modality: 'mobility', icon: 'flower', defaultIdentityTags: ['mobility'] },
  { id: 'pilates', label: 'Pilates', surface: 'practice', modality: 'mobility', icon: 'flower', defaultIdentityTags: ['mobility'] },
  { id: 'mobility', label: 'Mobility', surface: 'practice', modality: 'mobility', icon: 'flower', defaultIdentityTags: ['mobility'] },
  { id: 'meditation', label: 'Meditation', surface: 'practice', modality: 'mobility', icon: 'flower', defaultIdentityTags: ['mindfulness'] },
  // Dropped from the 7 Body sports (Dylan, 2026-07-05 2nd check-in) — deprecated,
  // not removed, so historic martial-arts sessions keep resolving (see Activity.deprecated).
  { id: 'martial-arts', label: 'Martial arts', surface: 'practice', modality: 'other', icon: 'flower', defaultIdentityTags: ['martial-arts'], deprecated: true },
  { id: 'dance', label: 'Dance', surface: 'practice', modality: 'dance', icon: 'flower', defaultIdentityTags: ['dance'] },
  // ── practice surface, Body dimension batch (dimension-body-build.md P1a) ──
  { id: 'breathwork', label: 'Breathwork', surface: 'practice', modality: 'mobility', icon: 'wind', defaultIdentityTags: ['mindfulness'] },
  { id: 'pt', label: 'PT', surface: 'practice', modality: 'mobility', icon: 'heart-pulse', defaultIdentityTags: ['recovery'] },
];

/**
 * The default headline row: the activities one tap away on the Training tab.
 * Pass 1 seeds it with the activities that already have a working logging form
 * (gym + the GPS-modality forms the existing logger renders), so every headline
 * tile is fully loggable today. Swim and Practice live in the long tail until
 * their surfaces land (Passes 5–6); onboarding will let the user set this list
 * (deferred — see backlog.md). Stored as ids so it's a pure preference.
 */
export const HEADLINE_DEFAULT_IDS = ['gym', 'run', 'ride', 'climb', 'hike', 'paddle'] as const;

const BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]));

export function activityById(id: string): Activity | undefined {
  return BY_ID.get(id);
}

// ─── Element grouping (2026-07-09 dimension merge) ──────────────────────────
// The Training tab organizes activities by the four elemental dimensions, in
// this fixed order — replacing the old headline/"More" flat outdoor grouping.

export type Element = 'body' | 'earth' | 'water' | 'sky';

export const ELEMENT_ORDER: readonly Element[] = ['body', 'earth', 'water', 'sky'];

export const ELEMENT_LABELS: Record<Element, string> = {
  body: 'Body',
  earth: 'Earth',
  water: 'Water',
  sky: 'Sky',
};

/** Which element each activity belongs to. Kept as a map (not a per-entry
 *  field) so dimension branches adding activities stay low-conflict here. */
const ELEMENT_OF: Record<string, Element> = {
  // Body — gym + practice surfaces
  gym: 'body',
  strength: 'body',
  calisthenics: 'body',
  crossfit: 'body',
  yoga: 'body',
  pilates: 'body',
  mobility: 'body',
  meditation: 'body',
  'martial-arts': 'body',
  dance: 'body',
  breathwork: 'body',
  pt: 'body',
  // Earth — land sports
  run: 'earth',
  ride: 'earth',
  hike: 'earth',
  walk: 'earth',
  ruck: 'earth',
  'trail-run': 'earth',
  mtb: 'earth',
  ski: 'earth',
  snowboard: 'earth',
  'ski-touring': 'earth',
  'xc-ski': 'earth',
  snowshoe: 'earth',
  skate: 'earth',
  climb: 'earth',
  // Water — paddle, wind, swim
  paddle: 'water',
  surf: 'water',
  swim: 'water',
  kayak: 'water',
  whitewater: 'water',
  sup: 'water',
  canoe: 'water',
  row: 'water',
  sail: 'water',
  windsurf: 'water',
  kitesurf: 'water',
  parawing: 'water',
  wingfoil: 'water',
  // Sky — flight
  paragliding: 'sky',
  hikeAndFly: 'sky',
  speedflying: 'sky',
  parakiting: 'sky',
};

export function elementOf(a: Activity): Element {
  return ELEMENT_OF[a.id] ?? 'body';
}

/**
 * Activities queued for deletion pending Dylan's confirmation (2026-07-09):
 * in the registry but NOT in the Notion Training Database, and untouched by
 * any of the four dimension builds (not in WHITEWATER/WIND activity gates, no
 * Earth gearCategories, not a Body practice build). They render in a separate
 * "Review" section on the Training tab — hidden from the quick-log picker —
 * until confirmed. Confirmed deletes should become `deprecated: true`, NOT
 * row removal, whenever the activity may have logged sessions (see the
 * `deprecated` field's contract above).
 */
export const REVIEW_PENDING_IDS: readonly string[] = [
  'strength',
  'crossfit',
  'pilates',
  'meditation',
  'paddle',
  'surf',
  'sup',
  'canoe',
  'row',
  'skate',
];

const REVIEW_PENDING = new Set(REVIEW_PENDING_IDS);

/**
 * Snow-specific activities carved out of Earth's flat list into their own
 * closeable Training-tab section (Dylan, 2026-07-09) — everything that
 * happens on snow, kept together instead of mixed in with land sports.
 */
export const SNOW_SPORT_IDS: readonly string[] = [
  'ski',
  'snowboard',
  'xc-ski',
  'snowshoe',
  'ski-touring',
];

const SNOW_SPORT_SET = new Set(SNOW_SPORT_IDS);

/**
 * Lower-priority activities pulled out of their element's main list into a
 * shared closeable "More" tray on the Training tab (Dylan, 2026-07-09) —
 * still fully loggable, just decluttered from the primary picker. NOT
 * delete-candidates like REVIEW_PENDING_IDS: Ruck carries Earth's
 * gearCategories and Sail is one of Water's WIND_ACTIVITIES — both are
 * dimension-built and functional, just less commonly logged.
 */
export const MORE_ACTIVITY_IDS: readonly string[] = ['ruck', 'sail'];

const MORE_ACTIVITY_SET = new Set(MORE_ACTIVITY_IDS);

/** Pickable = shown in pickers: not deprecated, not pending delete-review.
 *  Exported so every activity picker (Training tab, Home's element-picker
 *  sheet) shares this exclusion instead of each re-deriving it. */
export function pickable(a: Activity): boolean {
  return a.deprecated !== true && !REVIEW_PENDING.has(a.id);
}

export type ElementSection = { element: Element; title: string; activities: Activity[] };

/**
 * The Training tab's sections: Body → Earth → Water → Sky, registry order
 * within. Snow-sport and "More" ids are carved out into their own closeable
 * trays (see snowSportActivities/moreDeprioritizedActivities) so they don't
 * render twice.
 */
export function elementSections(): ElementSection[] {
  return ELEMENT_ORDER.map((element) => ({
    element,
    title: ELEMENT_LABELS[element],
    activities: ACTIVITIES.filter(
      (a) =>
        pickable(a) &&
        elementOf(a) === element &&
        !SNOW_SPORT_SET.has(a.id) &&
        !MORE_ACTIVITY_SET.has(a.id)
    ),
  }));
}

/** The pending-delete list for the Training tab's Review section. */
export function reviewPendingActivities(): Activity[] {
  return ACTIVITIES.filter((a) => a.deprecated !== true && REVIEW_PENDING.has(a.id));
}

/** Snow sports — their own closeable Training-tab tray, registry order. */
export function snowSportActivities(): Activity[] {
  return ACTIVITIES.filter((a) => pickable(a) && SNOW_SPORT_SET.has(a.id));
}

/** The "More" tray — lower-priority but fully functional, dimension-built activities. */
export function moreDeprioritizedActivities(): Activity[] {
  return ACTIVITIES.filter((a) => pickable(a) && MORE_ACTIVITY_SET.has(a.id));
}

/**
 * The headline activities, in the given id order (defaults to HEADLINE_DEFAULT_IDS).
 * Deprecated activities never surface in a picker, even if a stored preference
 * still lists them — they only resolve by id for historic sessions.
 */
export function headlineActivities(ids: readonly string[] = HEADLINE_DEFAULT_IDS): Activity[] {
  return ids
    .map((id) => BY_ID.get(id))
    .filter((a): a is Activity => a !== undefined && pickable(a));
}

/** Everything not in the headline row — the "More" long tail, registry order preserved. */
export function moreActivities(headlineIds: readonly string[] = HEADLINE_DEFAULT_IDS): Activity[] {
  const headline = new Set(headlineIds);
  return ACTIVITIES.filter((a) => !headline.has(a.id) && pickable(a));
}
