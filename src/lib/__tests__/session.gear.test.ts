/**
 * The Proof — gearIds ride the session form honestly (E1):
 *   1. Tagged gear lands on the payload verbatim; an untagged session carries
 *      NO gearIds key at all (absent, not []) — same omit-when-empty rule as
 *      the other optional payload fields.
 *   2. The inverse (sessionFormFromObservation) restores the tags, and a
 *      payload from before this field existed hydrates to the form's [].
 *   3. Tagging gear never gates saving — no validation reads it.
 *   4. Switching activity prunes tags the new activity's chip row can't show
 *      (pruneGearIdsForCategories): a tag outside the activity's gear
 *      categories would be invisible yet still saved, silently accruing the
 *      session to another sport's gear.
 */
import { describe, it, expect } from '@jest/globals';
import {
  buildSessionObservation,
  emptySessionForm,
  pruneGearIdsForCategories,
  sessionFormFromObservation,
  validateSessionForm,
  type BuildContext,
  type SessionForm,
} from '../session';
import type { ObservationOf } from '@core/observation';

const CTX: BuildContext = {
  id: 's1',
  now: '2026-07-05T17:00:00Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'kg',
  distanceUnit: 'km',
};

/** A minimal valid run (GPS surface) form. */
function runForm(gearIds: string[] = []): SessionForm {
  const f = emptySessionForm();
  f.activity = 'run';
  f.durationMin = '45';
  f.gearIds = gearIds;
  return f;
}

describe('session gearIds round-trip', () => {
  it('writes payload.gearIds only when gear was tagged', () => {
    const tagged = buildSessionObservation(runForm(['g-shoes', 'g-vest']), CTX);
    expect(tagged.payload.gearIds).toEqual(['g-shoes', 'g-vest']);

    const untagged = buildSessionObservation(runForm(), CTX);
    expect('gearIds' in untagged.payload).toBe(false); // absent, never []
  });

  it('restores gearIds through the inverse, and defaults absent to []', () => {
    const obs = buildSessionObservation(runForm(['g-shoes']), CTX);
    let n = 0;
    const back = sessionFormFromObservation(
      obs,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `id${n++}`
    );
    expect(back.gearIds).toEqual(['g-shoes']);

    // A session logged before gear existed: no gearIds key on the payload.
    const legacy = buildSessionObservation(runForm(), CTX) as ObservationOf<'session'>;
    const hydrated = sessionFormFromObservation(
      legacy,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `id${n++}`
    );
    expect(hydrated.gearIds).toEqual([]);
  });

  it('build → invert → build is stable (tags survive an edit round-trip)', () => {
    const first = buildSessionObservation(runForm(['g-shoes']), CTX);
    let n = 0;
    const form = sessionFormFromObservation(
      first,
      { weightUnit: 'kg', distanceUnit: 'km' },
      () => `id${n++}`
    );
    const second = buildSessionObservation(form, CTX);
    expect(second.payload.gearIds).toEqual(first.payload.gearIds);
  });

  it('never gates saving — a gearless form validates exactly as before', () => {
    expect(validateSessionForm(runForm())).toBeNull();
    expect(validateSessionForm(runForm(['g-shoes']))).toBeNull();
  });
});

describe('pruneGearIdsForCategories (activity switch)', () => {
  const QUIVER = [
    { id: 'g-shoes', category: 'shoes' as const },
    { id: 'g-bike', category: 'bike' as const },
  ];

  it('drops tags outside the new activity\'s categories (Run shoes ≠ Ride)', () => {
    expect(pruneGearIdsForCategories(['g-shoes'], QUIVER, ['bike'])).toEqual([]);
    expect(pruneGearIdsForCategories(['g-shoes', 'g-bike'], QUIVER, ['bike'])).toEqual([
      'g-bike',
    ]);
  });

  it('keeps tags the new activity still covers (Run → Hike keeps shoes)', () => {
    expect(pruneGearIdsForCategories(['g-shoes'], QUIVER, ['boots', 'shoes'])).toEqual([
      'g-shoes',
    ]);
  });

  it('clears all tags for an activity with no gear categories (Run → Bench Press)', () => {
    expect(pruneGearIdsForCategories(['g-shoes'], QUIVER, undefined)).toEqual([]);
    expect(pruneGearIdsForCategories(['g-shoes'], QUIVER, [])).toEqual([]);
  });

  it('drops ids with no gear record — no chip means no way to untag', () => {
    expect(pruneGearIdsForCategories(['g-ghost'], QUIVER, ['shoes'])).toEqual([]);
  });
});
