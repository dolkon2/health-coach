/**
 * The Proof — the climbing ladder's level-3 extension (⚑ E-13/E-14) stays
 * honest through build and a pre-E4 row still reads correctly:
 *   1. sent is always written: derived from outcome via isSentOutcome() when
 *      outcome is chosen (onsight/flash/redpoint/pinkpoint -> true; attempt
 *      AND fell-hung -> false — a fall/hang is a worked attempt, not a send),
 *      or carried forward from the draft's own `sent` when outcome is null.
 *   2. outcome is written ONLY when the user actually chose one — never
 *      guessed from `sent` alone (sent:true is compatible with four different
 *      outcomes; constitution: never fabricate a specific fact).
 *   3. gradeSystem is tagged from sandbag (core/climbGrade.ts) when the grade
 *      parses, styled by the session's climbing style; a freeform/unparseable
 *      grade string is preserved with no gradeSystem key at all.
 *   4. route/totalProblems/location are omitted when blank/absent — never a
 *      fabricated empty string or zero.
 *   5. Round-trips through build -> invert -> rebuild unchanged.
 *   6. A pre-E4 row (sent only, no outcome/gradeSystem/route/totalProblems/
 *      location) hydrates with sent preserved verbatim, outcome left null —
 *      never invented — and every new field absent.
 */
import { describe, it, expect } from '@jest/globals';
import {
  buildSessionObservation,
  emptySessionForm,
  sessionFormFromObservation,
  type BuildContext,
  type SessionForm,
} from '../session';
import type { ObservationOf } from '@core/observation';

const CTX: BuildContext = {
  id: 'e4-1',
  now: '2026-07-08T17:00:00Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'kg',
  distanceUnit: 'km',
};

function climbForm(over: Partial<SessionForm['climb']> = {}): SessionForm {
  const f = emptySessionForm();
  f.activity = 'climb';
  f.durationMin = '90';
  f.climb = { ...f.climb, ...over };
  return f;
}

function invert(obs: ObservationOf<'session'>): SessionForm {
  let n = 0;
  return sessionFormFromObservation(obs, { weightUnit: 'kg', distanceUnit: 'km' }, () =>
    String(++n)
  );
}

describe('climbing build — outcome drives sent, fell-hung is NOT a send', () => {
  it('onsight/flash/redpoint/pinkpoint write sent:true; attempt and fell-hung write sent:false', () => {
    const f = climbForm({
      style: 'boulder',
      sends: [
        { id: 'a', grade: 'V4', attempts: '3', sent: false, outcome: 'attempt', route: '' },
        { id: 'b', grade: 'V4', attempts: '2', sent: false, outcome: 'fell-hung', route: '' },
        { id: 'c', grade: 'V4', attempts: '1', sent: false, outcome: 'flash', route: '' },
        { id: 'd', grade: 'V4', attempts: '2', sent: false, outcome: 'redpoint', route: '' },
      ],
    });
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.climbing?.sends).toEqual([
      expect.objectContaining({ outcome: 'attempt', sent: false }),
      expect.objectContaining({ outcome: 'fell-hung', sent: false }),
      expect.objectContaining({ outcome: 'flash', sent: true }),
      expect.objectContaining({ outcome: 'redpoint', sent: true }),
    ]);
  });

  it('a null outcome writes no outcome key and falls back to the draft\'s own sent', () => {
    const f = climbForm({
      style: 'boulder',
      sends: [
        { id: 'a', grade: 'V4', attempts: '1', sent: true, outcome: null, route: '' },
        { id: 'b', grade: 'V5', attempts: '3', sent: false, outcome: null, route: '' },
      ],
    });
    const obs = buildSessionObservation(f, CTX);
    const sends = obs.payload.climbing?.sends ?? [];
    expect('outcome' in sends[0]).toBe(false);
    expect(sends[0].sent).toBe(true);
    expect('outcome' in sends[1]).toBe(false);
    expect(sends[1].sent).toBe(false);
  });
});

describe('climbing build — gradeSystem tagging', () => {
  it('tags a recognized grade with the scale it matched, styled by session style', () => {
    const f = climbForm({
      style: 'boulder',
      sends: [{ id: 'a', grade: 'V4', attempts: '1', sent: true, outcome: 'redpoint', route: '' }],
    });
    const obs = buildSessionObservation(f, CTX);
    expect(obs.payload.climbing?.sends[0]).toMatchObject({ grade: 'V4', gradeSystem: 'vscale' });
  });

  it('the same "6a" string tags differently by style (Font vs French)', () => {
    const boulder = buildSessionObservation(
      climbForm({
        style: 'boulder',
        sends: [{ id: 'a', grade: '6a', attempts: '1', sent: true, outcome: 'redpoint', route: '' }],
      }),
      CTX
    );
    const sport = buildSessionObservation(
      climbForm({
        style: 'sport',
        sends: [{ id: 'a', grade: '6a', attempts: '1', sent: true, outcome: 'redpoint', route: '' }],
      }),
      CTX
    );
    expect(boulder.payload.climbing?.sends[0].gradeSystem).toBe('font');
    expect(sport.payload.climbing?.sends[0].gradeSystem).toBe('french');
  });

  it('leaves gradeSystem absent for a grade that matches no known scale — the string stays the fact', () => {
    const f = climbForm({
      style: 'gym',
      sends: [
        { id: 'a', grade: 'purple circuit', attempts: '1', sent: true, outcome: 'redpoint', route: '' },
      ],
    });
    const obs = buildSessionObservation(f, CTX);
    const send = obs.payload.climbing?.sends[0];
    expect(send?.grade).toBe('purple circuit');
    expect('gradeSystem' in (send ?? {})).toBe(false);
  });
});

describe('climbing build — route/totalProblems/location omitted when blank', () => {
  it('omits route when blank, writes it when filled', () => {
    const f = climbForm({
      style: 'sport',
      sends: [
        { id: 'a', grade: '5.9', attempts: '1', sent: true, outcome: 'onsight', route: '' },
        {
          id: 'b',
          grade: '5.10a',
          attempts: '2',
          sent: true,
          outcome: 'redpoint',
          route: 'Center Route',
        },
      ],
    });
    const obs = buildSessionObservation(f, CTX);
    const sends = obs.payload.climbing?.sends ?? [];
    expect('route' in sends[0]).toBe(false);
    expect(sends[1].route).toBe('Center Route');
  });

  it('omits totalProblems when blank or zero, writes it when positive', () => {
    const blank = buildSessionObservation(climbForm({ totalProblems: '' }), CTX);
    const zero = buildSessionObservation(climbForm({ totalProblems: '0' }), CTX);
    const filled = buildSessionObservation(climbForm({ totalProblems: '15' }), CTX);
    expect('totalProblems' in (blank.payload.climbing ?? {})).toBe(false);
    expect('totalProblems' in (zero.payload.climbing ?? {})).toBe(false);
    expect(filled.payload.climbing?.totalProblems).toBe(15);
  });

  it('omits location when absent, writes it verbatim when a pin was captured', () => {
    const noPin = buildSessionObservation(climbForm(), CTX);
    const pinned = buildSessionObservation(
      climbForm({ location: { lat: 45.5, lng: -121.7 } }),
      CTX
    );
    expect('location' in (noPin.payload.climbing ?? {})).toBe(false);
    expect(pinned.payload.climbing?.location).toEqual({ lat: 45.5, lng: -121.7 });
  });
});

describe('climbing round-trip', () => {
  it('build -> invert -> rebuild is unchanged', () => {
    const f = climbForm({
      style: 'trad',
      sends: [
        {
          id: 'a',
          grade: '5.9',
          attempts: '2',
          sent: true,
          outcome: 'pinkpoint',
          route: 'The Nose',
        },
      ],
      totalProblems: '',
      location: { lat: 45.5, lng: -121.7, name: 'Smith Rock' },
    });
    const obs = buildSessionObservation(f, CTX);
    const restored = invert(obs);
    expect(restored.climb.sends[0]).toMatchObject({
      grade: '5.9',
      attempts: '2',
      sent: true,
      outcome: 'pinkpoint',
      route: 'The Nose',
    });
    expect(restored.climb.location).toEqual({ lat: 45.5, lng: -121.7, name: 'Smith Rock' });

    const rebuilt = buildSessionObservation(restored, CTX);
    expect(rebuilt.payload.climbing).toEqual(obs.payload.climbing);
  });
});

describe('climbing inverse — pre-E4 row back-compat', () => {
  it('preserves sent verbatim, leaves outcome null (never guessed), defaults route/totalProblems', () => {
    const obs: ObservationOf<'session'> = {
      id: 'pre-e4',
      kind: 'session',
      occurredAt: CTX.now,
      loggedAt: CTX.now,
      tz: CTX.tz,
      tier: 1,
      fidelity: 0.95,
      source: { type: 'manual' },
      payload: {
        kind: 'session',
        activity: 'climb',
        modality: 'climb',
        durationMin: 60,
        climbing: {
          style: 'boulder',
          sends: [
            { grade: 'V3', attempts: 2, sent: true },
            { grade: 'V5', attempts: 5, sent: false },
          ],
        },
      },
    };
    const restored = invert(obs);
    expect(restored.climb.sends[0]).toMatchObject({ grade: 'V3', sent: true, outcome: null, route: '' });
    expect(restored.climb.sends[1]).toMatchObject({ grade: 'V5', sent: false, outcome: null, route: '' });
    expect(restored.climb.totalProblems).toBe('');
    expect('location' in restored.climb).toBe(false);
  });

  it('a resave of an untouched pre-E4 row writes sent but no outcome — never fabricates one', () => {
    const obs: ObservationOf<'session'> = {
      id: 'pre-e4-2',
      kind: 'session',
      occurredAt: CTX.now,
      loggedAt: CTX.now,
      tz: CTX.tz,
      tier: 1,
      fidelity: 0.95,
      source: { type: 'manual' },
      payload: {
        kind: 'session',
        activity: 'climb',
        modality: 'climb',
        durationMin: 60,
        climbing: { style: 'boulder', sends: [{ grade: 'V3', attempts: 2, sent: true }] },
      },
    };
    const restored = invert(obs);
    // The user edits an unrelated field and resaves without touching outcome.
    restored.notes = 'felt strong today';
    const rebuilt = buildSessionObservation(restored, CTX);
    const send = rebuilt.payload.climbing?.sends[0];
    expect(send?.sent).toBe(true);
    expect('outcome' in (send ?? {})).toBe(false);
  });
});
