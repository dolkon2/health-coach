import { describe, it, expect } from '@jest/globals';
import type { ObservationOf } from '@core/observation';
import {
  archetypeActivity,
  defaultActivityForElement,
  mostRecentActivityByElement,
} from '../mostRecentActivity';

function session(
  occurredAt: string,
  payload: Partial<ObservationOf<'session'>['payload']> = {}
): ObservationOf<'session'> {
  return {
    id: `s-${occurredAt}-${payload.activity ?? payload.modality ?? 'x'}`,
    kind: 'session',
    occurredAt,
    loggedAt: occurredAt,
    tz: 'UTC',
    tier: 1,
    fidelity: 0.95,
    source: { type: 'manual' },
    payload: { kind: 'session', modality: 'other', ...payload },
  };
}

describe('archetypeActivity', () => {
  it('resolves the spec-mandated archetype per element', () => {
    expect(archetypeActivity('earth').id).toBe('trail-run');
    expect(archetypeActivity('water').id).toBe('kayak');
    expect(archetypeActivity('sky').id).toBe('paragliding');
  });
});

describe('mostRecentActivityByElement', () => {
  it('returns the newest resolvable activity per element', () => {
    // Newest-first, as useSessionHistory returns them.
    const sessions = [
      session('2026-07-10', { activity: 'run' }), // earth
      session('2026-07-09', { activity: 'kayak' }), // water
      session('2026-07-08', { activity: 'run' }), // earth again — already found, ignored
      session('2026-07-07', { activity: 'paragliding' }), // sky
    ];
    const result = mostRecentActivityByElement(sessions);
    expect(result.earth?.id).toBe('run');
    expect(result.water?.id).toBe('kayak');
    expect(result.sky?.id).toBe('paragliding');
  });

  it('skips sessions with no activity id (legacy / modality-only logs)', () => {
    const sessions = [session('2026-07-10', { modality: 'run' })];
    const result = mostRecentActivityByElement(sessions);
    expect(result).toEqual({});
  });

  it('skips Body-element activities entirely — Body has no default here', () => {
    const sessions = [session('2026-07-10', { activity: 'gym' })];
    const result = mostRecentActivityByElement(sessions);
    expect(result).toEqual({});
  });

  it('returns an empty map when there is no history', () => {
    expect(mostRecentActivityByElement([])).toEqual({});
  });

  it('skips activities pending delete-review — never a picker default', () => {
    // 'paddle' is in REVIEW_PENDING_IDS (src/lib/activity.ts): hidden from
    // every picker until Dylan confirms its deletion. A most-recent 'paddle'
    // session must fall through to an earlier pickable Water session, not
    // resurface a hidden activity as the picker's default.
    const sessions = [
      session('2026-07-10', { activity: 'paddle' }),
      session('2026-07-05', { activity: 'kayak' }),
    ];
    const result = mostRecentActivityByElement(sessions);
    expect(result.water?.id).toBe('kayak');
  });
});

describe('defaultActivityForElement', () => {
  it('prefers the most-recent activity over the archetype', () => {
    const mostRecent = mostRecentActivityByElement([session('2026-07-10', { activity: 'kayak' })]);
    expect(defaultActivityForElement('water', mostRecent).id).toBe('kayak');
  });

  it('falls back to the archetype when no history exists for that element', () => {
    expect(defaultActivityForElement('sky', {}).id).toBe('paragliding');
  });
});
