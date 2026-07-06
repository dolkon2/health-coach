/**
 * yogaPoses.ts — typed loader for the vendored yoga pose reference dataset.
 *
 * Provenance: github.com/alexcumplido/yoga-api (main branch, db/database.db),
 * MIT license — attribution is carried in the vendored file's `meta.license`
 * and must survive any reshaping. `yoga-poses.json` is vendored VERBATIM;
 * the three upstream corrections below are applied HERE, in code, so each one
 * stays visible and auditable (JSON cannot carry comments):
 *
 *   1. Bridge (id 4) ships with empty categories/difficulty upstream —
 *      patched to Backbend/Chest Opening + Beginner (matching its sibling
 *      backbends; Bridge is the canonical beginner backbend).
 *   2. Corpse (id 11) `sanskrit_name_adapted` "Sivasana" → "Savasana"
 *      (upstream typo; Śavāsana romanizes to Savasana).
 *   3. Upward-Facing Dog (id 43) `sanskrit_name_adapted`
 *      "Urdhva Mukha Svsnssana" → "Urdhva Mukha Svanasana" (upstream typo).
 *
 * The 48 pose illustrations are snapshotted under `assets/yoga-poses/` —
 * filenames are `slugifyPoseName(english_name).svg` (the author's cloudinary
 * URLs in url_svg/url_png are kept for provenance but must never be fetched
 * at runtime; personal cloud hosting can vanish). PNGs are not vendored.
 *
 * The pose-reference browse FEATURE is deferred to the Gorge redesign (⚑) —
 * this module only makes the data available.
 */
import rawPoses from './yoga-poses.json';

// ─── Types ───────────────────────────────────────────────────────────────────

export type YogaPose = {
  id: number;
  english_name: string;
  sanskrit_name: string;
  sanskrit_name_adapted: string;
  translation_name: string;
  description: string;
  benefits: string;
  categories: string[];
  difficulty: string[];
  url_svg: string;
  url_png: string;
  url_svg_alt: string;
};

export type YogaPoseMeta = {
  source: string;
  license: string;
  pose_count: number;
  categories: { name: string; description: string }[];
  difficulty_levels: string[];
};

type PosesFile = { meta: YogaPoseMeta; poses: YogaPose[] };

// ─── Upstream corrections (see header) ──────────────────────────────────────

function applyCorrections(pose: YogaPose): YogaPose {
  if (pose.id === 4 && pose.english_name === 'Bridge') {
    // UPSTREAM CORRECTION 1: Bridge ships uncategorized.
    return {
      ...pose,
      categories: pose.categories.length > 0 ? pose.categories : ['Backbend Yoga', 'Chest Opening Yoga'],
      difficulty: pose.difficulty.length > 0 ? pose.difficulty : ['Beginner'],
    };
  }
  if (pose.id === 11 && pose.sanskrit_name_adapted === 'Sivasana') {
    // UPSTREAM CORRECTION 2: typo — Śavāsana romanizes to Savasana.
    return { ...pose, sanskrit_name_adapted: 'Savasana' };
  }
  if (pose.id === 43 && pose.sanskrit_name_adapted === 'Urdhva Mukha Svsnssana') {
    // UPSTREAM CORRECTION 3: typo — Śvānāsana romanizes to Svanasana.
    return { ...pose, sanskrit_name_adapted: 'Urdhva Mukha Svanasana' };
  }
  return pose;
}

// ─── Loader ──────────────────────────────────────────────────────────────────

let cache: YogaPose[] | null = null;

/** All 48 poses with the upstream corrections applied. Memoized. */
export function yogaPoses(): YogaPose[] {
  if (cache) return cache;
  cache = (rawPoses as PosesFile).poses.map(applyCorrections);
  return cache;
}

/** Dataset meta — source + MIT attribution + category/difficulty vocab. */
export function yogaPoseMeta(): YogaPoseMeta {
  return (rawPoses as PosesFile).meta;
}

/**
 * The local asset filename stem for a pose: lowercase english name with every
 * non-alphanumeric run collapsed to '-' ("Child's Pose" → "child-s-pose").
 * `assets/yoga-poses/<slug>.svg` exists for every vendored pose (tested).
 */
export function slugifyPoseName(englishName: string): string {
  return englishName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
