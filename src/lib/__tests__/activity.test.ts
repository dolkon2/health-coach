import { describe, it, expect } from '@jest/globals';
import {
  ACTIVITIES,
  ELEMENT_ORDER,
  HEADLINE_DEFAULT_IDS,
  REVIEW_PENDING_IDS,
  activityById,
  elementSections,
  headlineActivities,
  moreActivities,
  reviewPendingActivities,
  type Surface,
} from '../activity';

const SURFACES: ReadonlySet<Surface> = new Set<Surface>([
  'gym',
  'gps',
  'swim',
  'practice',
  'climbing',
  'sky',
]);

// Mirror of @core Modality — the engine values an activity may map to. tsc also
// enforces this via the `modality: Modality` field; the test guards the data.
const MODALITIES = new Set([
  'gym',
  'run',
  'ride',
  'swim',
  'climb',
  'paddle',
  'surf',
  'hike',
  'hiit',
  'mobility',
  'dance',
  'other',
]);

describe('activity registry', () => {
  it('ids are unique', () => {
    const ids = ACTIVITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every activity has a valid surface, engine modality, label and icon', () => {
    for (const a of ACTIVITIES) {
      expect(SURFACES.has(a.surface)).toBe(true);
      expect(MODALITIES.has(a.modality)).toBe(true);
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
    }
  });

  it('headline defaults all resolve, in order (minus review-pending ids)', () => {
    // 'paddle' sits in HEADLINE_DEFAULT_IDS but is queued for delete-review
    // (2026-07-09 prune) — pickers filter it like a deprecated id.
    const expected = HEADLINE_DEFAULT_IDS.filter((id) => !REVIEW_PENDING_IDS.includes(id));
    expect(headlineActivities().map((a) => a.id)).toEqual(expected);
  });

  it('headline and More partition the pickable registry exactly once', () => {
    const headlineIds = new Set(headlineActivities().map((a) => a.id));
    for (const m of moreActivities()) expect(headlineIds.has(m.id)).toBe(false);

    const combined = [...headlineActivities(), ...moreActivities()].map((a) => a.id).sort();
    expect(combined).toEqual(
      ACTIVITIES.filter((a) => a.deprecated !== true && !REVIEW_PENDING_IDS.includes(a.id))
        .map((a) => a.id)
        .sort()
    );
  });

  it('element sections cover the pickable registry exactly once, Body→Earth→Water→Sky', () => {
    const sections = elementSections();
    expect(sections.map((s) => s.element)).toEqual([...ELEMENT_ORDER]);
    const ids = sections.flatMap((s) => s.activities.map((a) => a.id)).sort();
    expect(ids).toEqual(
      ACTIVITIES.filter((a) => a.deprecated !== true && !REVIEW_PENDING_IDS.includes(a.id))
        .map((a) => a.id)
        .sort()
    );
  });

  it('review-pending activities resolve, are excluded from pickers, and none is dimension-built', () => {
    const review = reviewPendingActivities().map((a) => a.id);
    expect([...review].sort()).toEqual([...REVIEW_PENDING_IDS].sort());
    const pickerIds = new Set(
      [...headlineActivities(), ...moreActivities()].map((a) => a.id)
    );
    for (const id of review) {
      expect(pickerIds.has(id)).toBe(false);
      expect(activityById(id)).toBeDefined(); // still resolvable for history
    }
  });

  it('deprecated activities stay resolvable by id but never surface in a picker', () => {
    // Martial arts was dropped from the Body sports (2026-07-05) — deprecated, not
    // removed: historic sessions must keep resolving their surface for display/edit.
    const ma = activityById('martial-arts');
    expect(ma?.deprecated).toBe(true);
    expect(ma?.surface).toBe('practice');
    const pickerIds = [...headlineActivities(), ...moreActivities()].map((a) => a.id);
    expect(pickerIds).not.toContain('martial-arts');
    // Even a stored headline preference that still lists it can't resurface it.
    expect(headlineActivities(['gym', 'martial-arts']).map((a) => a.id)).toEqual(['gym']);
  });

  it('Body practice batch: breathwork and pt are present, mobility-modality, pickable', () => {
    for (const id of ['breathwork', 'pt']) {
      const a = activityById(id);
      expect(a?.surface).toBe('practice');
      expect(a?.modality).toBe('mobility');
      expect(a?.deprecated).toBeUndefined();
    }
    const moreIds = moreActivities().map((a) => a.id);
    expect(moreIds).toContain('breathwork');
    expect(moreIds).toContain('pt');
  });

  it('activityById round-trips and misses cleanly', () => {
    for (const a of ACTIVITIES) expect(activityById(a.id)).toBe(a);
    expect(activityById('not-an-activity')).toBeUndefined();
  });

  it('sport-expansion batch (outdoor-integrations v0.2 add-now) is present on the right surfaces', () => {
    const gps = ['walk', 'ruck', 'trail-run', 'mtb', 'kayak', 'whitewater', 'sup', 'canoe', 'row', 'sail', 'windsurf', 'kitesurf', 'snowboard', 'ski-touring', 'xc-ski', 'snowshoe', 'skate'];
    for (const id of gps) expect(activityById(id)?.surface).toBe('gps');
    for (const id of ['martial-arts', 'dance']) expect(activityById(id)?.surface).toBe('practice');
  });

  it('Sky dimension activities (paragliding/hike&fly/speedflying/parakiting) are on the sky surface', () => {
    const sky = ['paragliding', 'hikeAndFly', 'speedflying', 'parakiting'];
    for (const id of sky) expect(activityById(id)?.surface).toBe('sky');
  });
});
