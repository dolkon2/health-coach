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

/** The five logging surfaces (form shapes). Many activities map to each. */
export type Surface = 'gym' | 'gps' | 'swim' | 'practice' | 'climbing';

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
};

export const ACTIVITIES: Activity[] = [
  // ── gym surface ──
  { id: 'gym', label: 'Gym', surface: 'gym', modality: 'gym', icon: 'dumbbell', defaultIdentityTags: ['strength'] },
  { id: 'strength', label: 'Strength', surface: 'gym', modality: 'gym', icon: 'dumbbell', defaultIdentityTags: ['strength'] },
  { id: 'calisthenics', label: 'Calisthenics', surface: 'gym', modality: 'gym', icon: 'dumbbell', defaultIdentityTags: ['calisthenics'] },
  { id: 'crossfit', label: 'CrossFit', surface: 'gym', modality: 'gym', icon: 'dumbbell', defaultIdentityTags: ['functional'] },
  // ── gps surface (Run/Ride/Hike/Paddle render today; Surf/Wingfoil/Ski land with the GPS surface, Pass 2) ──
  { id: 'run', label: 'Run', surface: 'gps', modality: 'run', icon: 'footprints', defaultEnergySystem: 'aerobic' },
  { id: 'ride', label: 'Ride', surface: 'gps', modality: 'ride', icon: 'bike', defaultEnergySystem: 'aerobic' },
  { id: 'hike', label: 'Hike', surface: 'gps', modality: 'hike', icon: 'mountain', defaultEnergySystem: 'aerobic' },
  { id: 'paddle', label: 'Paddle', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'surf', label: 'Surf', surface: 'gps', modality: 'surf', icon: 'waves', defaultEnergySystem: 'mixed' },
  { id: 'wingfoil', label: 'Wingfoil', surface: 'gps', modality: 'other', icon: 'wind', defaultEnergySystem: 'mixed' },
  { id: 'ski', label: 'Ski', surface: 'gps', modality: 'other', icon: 'snowflake', defaultEnergySystem: 'mixed' },
  // ── gps surface, sport-expansion batch (outdoor-integrations.md v0.2 "add-now" triage) ──
  { id: 'walk', label: 'Walk', surface: 'gps', modality: 'hike', icon: 'footprints', defaultEnergySystem: 'aerobic' },
  { id: 'ruck', label: 'Ruck', surface: 'gps', modality: 'hike', icon: 'backpack', defaultEnergySystem: 'aerobic', defaultIdentityTags: ['rucking'] },
  { id: 'trail-run', label: 'Trail run', surface: 'gps', modality: 'run', icon: 'mountain', defaultEnergySystem: 'aerobic' },
  { id: 'mtb', label: 'Mountain bike', surface: 'gps', modality: 'ride', icon: 'bike', defaultEnergySystem: 'mixed' },
  { id: 'kayak', label: 'Kayak', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'whitewater', label: 'Whitewater', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'mixed', defaultIdentityTags: ['whitewater'] },
  { id: 'sup', label: 'SUP', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'canoe', label: 'Canoe', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'row', label: 'Row', surface: 'gps', modality: 'paddle', icon: 'waves', defaultEnergySystem: 'aerobic' },
  { id: 'sail', label: 'Sail', surface: 'gps', modality: 'other', icon: 'wind', defaultEnergySystem: 'aerobic' },
  { id: 'windsurf', label: 'Windsurf', surface: 'gps', modality: 'other', icon: 'wind', defaultEnergySystem: 'mixed' },
  { id: 'kitesurf', label: 'Kitesurf', surface: 'gps', modality: 'other', icon: 'wind', defaultEnergySystem: 'mixed' },
  { id: 'snowboard', label: 'Snowboard', surface: 'gps', modality: 'other', icon: 'snowflake', defaultEnergySystem: 'mixed' },
  { id: 'ski-touring', label: 'Ski touring', surface: 'gps', modality: 'hike', icon: 'snowflake', defaultEnergySystem: 'aerobic', defaultIdentityTags: ['backcountry'] },
  { id: 'xc-ski', label: 'XC ski', surface: 'gps', modality: 'other', icon: 'snowflake', defaultEnergySystem: 'aerobic' },
  { id: 'snowshoe', label: 'Snowshoe', surface: 'gps', modality: 'hike', icon: 'snowflake', defaultEnergySystem: 'aerobic' },
  { id: 'skate', label: 'Skate', surface: 'gps', modality: 'other', icon: 'footprints', defaultEnergySystem: 'mixed' },
  { id: 'paraglide', label: 'Paraglide', surface: 'gps', modality: 'other', icon: 'wind', defaultIdentityTags: ['flying'] },
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

/**
 * The headline activities, in the given id order (defaults to HEADLINE_DEFAULT_IDS).
 * Deprecated activities never surface in a picker, even if a stored preference
 * still lists them — they only resolve by id for historic sessions.
 */
export function headlineActivities(ids: readonly string[] = HEADLINE_DEFAULT_IDS): Activity[] {
  return ids
    .map((id) => BY_ID.get(id))
    .filter((a): a is Activity => a !== undefined && a.deprecated !== true);
}

/** Everything not in the headline row — the "More" long tail, registry order preserved. */
export function moreActivities(headlineIds: readonly string[] = HEADLINE_DEFAULT_IDS): Activity[] {
  const headline = new Set(headlineIds);
  return ACTIVITIES.filter((a) => !headline.has(a.id) && a.deprecated !== true);
}
