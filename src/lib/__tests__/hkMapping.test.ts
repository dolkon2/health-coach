/**
 * hkMapping.test.ts — Body session -> HealthKit write shape (Body P8).
 * Constants checked against the binding doc's table (§2).
 */
import { describe, expect, it } from '@jest/globals';
import { mapSessionToHk } from '../healthkit/hkMapping';
import type { ObservationOf } from '@core/observation';

let n = 0;
function session(activity: string | undefined, contextTag?: string): ObservationOf<'session'> {
  n += 1;
  return {
    id: `s${n}`,
    kind: 'session',
    occurredAt: '2026-01-01T10:00:00.000Z',
    loggedAt: '2026-01-01T10:00:00.000Z',
    tz: 'UTC',
    tier: 1,
    fidelity: 0.95,
    source: { type: 'manual' },
    payload: {
      kind: 'session',
      modality: 'gym',
      ...(activity ? { activity } : {}),
      ...(contextTag ? { practice: { contextTag: contextTag as 'social' } } : {}),
    },
  };
}

describe('mapSessionToHk', () => {
  it('maps gym-surface activities to their traditional/functional strength constants', () => {
    expect(mapSessionToHk(session('gym'))).toEqual({ kind: 'workout', activityType: 50 });
    expect(mapSessionToHk(session('strength'))).toEqual({ kind: 'workout', activityType: 50 });
    expect(mapSessionToHk(session('calisthenics'))).toEqual({ kind: 'workout', activityType: 20 });
    expect(mapSessionToHk(session('crossfit'))).toEqual({ kind: 'workout', activityType: 20 });
  });

  it('maps yoga/pilates/mobility to their own constants', () => {
    expect(mapSessionToHk(session('yoga'))).toEqual({ kind: 'workout', activityType: 57 });
    expect(mapSessionToHk(session('pilates'))).toEqual({ kind: 'workout', activityType: 66 });
    expect(mapSessionToHk(session('mobility'))).toEqual({ kind: 'workout', activityType: 62 });
  });

  it('maps PT to preparationAndRecovery', () => {
    expect(mapSessionToHk(session('pt'))).toEqual({ kind: 'workout', activityType: 33 });
  });

  it('dance with contextTag social maps to socialDance (78), otherwise cardioDance (77)', () => {
    expect(mapSessionToHk(session('dance', 'social'))).toEqual({ kind: 'workout', activityType: 78 });
    expect(mapSessionToHk(session('dance'))).toEqual({ kind: 'workout', activityType: 77 });
    expect(mapSessionToHk(session('dance', 'class'))).toEqual({ kind: 'workout', activityType: 77 });
  });

  it('breathwork and meditation are mindful sessions, not workouts', () => {
    expect(mapSessionToHk(session('breathwork'))).toEqual({ kind: 'mindful' });
    expect(mapSessionToHk(session('meditation'))).toEqual({ kind: 'mindful' });
  });

  it('martial-arts (deprecated) is never exported, even if a historic session exists', () => {
    expect(mapSessionToHk(session('martial-arts'))).toBeNull();
  });

  it('a legacy session with no activity identity is not mappable', () => {
    expect(mapSessionToHk(session(undefined))).toBeNull();
  });

  it('an unrecognized activity id is not mappable, never a guess', () => {
    expect(mapSessionToHk(session('some-future-sport'))).toBeNull();
  });
});
