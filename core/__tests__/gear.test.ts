/**
 * The Proof — gear accrual is derived-on-read and honestly typed (E1, ⚑ E-4):
 *   1. A session accrues to gear exactly when its gearIds tag it; totals are
 *      computed from the timeline, never a stored odometer.
 *   2. A bike-component inherits its parent bike's sessions, gated by the
 *      component's acquiredOn — a chain fitted in July did not ride June.
 *   3. `days` counts distinct civil days, not sessions — in the SESSION'S OWN
 *      timezone (LocalDate contract), never a UTC slice: a Monday-evening PST
 *      ski whose instant lands on Tuesday UTC is still a Monday. The
 *      acquiredOn gate compares the same local day.
 *   4. distanceKm/durationHr are undefined — not 0 — when no counted session
 *      carried the field (null ≠ 0).
 *   5. gearStatusLine is DESCRIPTIVE: it states where the total sits against
 *      the user's own mark and never issues an instruction.
 */
import { describe, it, expect } from '@jest/globals';
import {
  deriveGearTotals,
  gearStatusLine,
  sessionGearIds,
  type Gear,
  type GearSessionLike,
} from '../src/gear';

const session = (
  occurredAt: string,
  gearIds: string[],
  extra: Partial<GearSessionLike['payload']> = {},
  tz = 'UTC' // UTC keeps instant-only fixtures readable; tz tests pass their own
): GearSessionLike => ({ occurredAt, tz, payload: { gearIds, ...extra } });

const SHOES: Gear = { id: 'sh1', name: 'Speedgoats', category: 'shoes', spec: { targetKm: 500 } };
const BIKE: Gear = { id: 'b1', name: 'Hardtail', category: 'bike' };
const CHAIN: Gear = {
  id: 'c1',
  name: 'Chain',
  category: 'bike-component',
  parentId: 'b1',
  acquiredOn: '2026-07-01',
  spec: { componentType: 'chain', serviceIntervalKm: 300 },
};
const SKIS: Gear = { id: 'sk1', name: 'Powder skis', category: 'skis' };

describe('deriveGearTotals', () => {
  it('accrues sessions, distance, duration, and days from tagging sessions only', () => {
    const totals = deriveGearTotals(SHOES, [SHOES], [
      session('2026-06-01T08:00:00Z', ['sh1'], { durationMin: 60, endurance: { distanceM: 10000 } }),
      session('2026-06-02T08:00:00Z', ['sh1'], { durationMin: 30, endurance: { distanceM: 5000 } }),
      session('2026-06-03T08:00:00Z', ['other-gear'], { endurance: { distanceM: 99000 } }), // untagged — invisible
    ]);
    expect(totals.sessions).toBe(2);
    expect(totals.distanceKm).toBe(15);
    expect(totals.durationHr).toBe(1.5);
    expect(totals.days).toBe(2);
  });

  it('bike-component inherits parent-bike sessions gated by its acquiredOn', () => {
    const rides = [
      session('2026-06-15T10:00:00Z', ['b1'], { endurance: { distanceM: 40000 } }), // pre-install
      session('2026-07-02T10:00:00Z', ['b1'], { endurance: { distanceM: 25000 } }),
      session('2026-07-05T10:00:00Z', ['b1'], { endurance: { distanceM: 10000 } }),
    ];
    const totals = deriveGearTotals(CHAIN, [BIKE, CHAIN], rides);
    expect(totals.sessions).toBe(2); // June ride predates the chain
    expect(totals.distanceKm).toBe(35);

    // No acquiredOn -> the record has no reason to exclude anything.
    const { acquiredOn: _dropped, ...rest } = CHAIN;
    const alwaysOn = rest as Gear;
    expect(deriveGearTotals(alwaysOn, [BIKE, alwaysOn], rides).sessions).toBe(3);
  });

  it('a session on the acquire date itself counts (local day >= acquiredOn)', () => {
    const totals = deriveGearTotals(CHAIN, [BIKE, CHAIN], [
      session('2026-07-01T00:30:00Z', ['b1']),
      session('2026-06-30T23:59:59Z', ['b1']),
    ]);
    expect(totals.sessions).toBe(1);
  });

  it('gates acquiredOn by the session\'s LOCAL day, not its UTC date', () => {
    // Chain installed 2026-07-01. A ride at June 30 7pm Pacific is instant
    // '2026-07-01T02:00Z' — same UTC date as the install, but still June 30
    // where it happened: pre-install, so it must not accrue.
    const preInstall = session('2026-07-01T02:00:00Z', ['b1'],
      { endurance: { distanceM: 40000 } }, 'America/Los_Angeles');
    const postInstall = session('2026-07-01T16:00:00Z', ['b1'],
      { endurance: { distanceM: 25000 } }, 'America/Los_Angeles'); // July 1 9am PT
    const totals = deriveGearTotals(CHAIN, [BIKE, CHAIN], [preInstall, postInstall]);
    expect(totals.sessions).toBe(1);
    expect(totals.distanceKm).toBe(25);
  });

  it('inherits nothing through a dangling parentId (parent not in allGear)', () => {
    const totals = deriveGearTotals(CHAIN, [CHAIN], [session('2026-07-02T10:00:00Z', ['b1'])]);
    expect(totals.sessions).toBe(0);
  });

  it('counts distinct civil days — two laps in a day are one day out', () => {
    const totals = deriveGearTotals(SKIS, [SKIS], [
      session('2026-01-10T09:00:00Z', ['sk1']),
      session('2026-01-10T13:00:00Z', ['sk1']),
      session('2026-01-11T09:00:00Z', ['sk1']),
    ]);
    expect(totals.sessions).toBe(3);
    expect(totals.days).toBe(2);
  });

  it('counts days in the session\'s own timezone, never by UTC slice', () => {
    const LA = 'America/Los_Angeles';
    // Monday 6pm PST (Tue 02:00Z) + Tuesday 9am PST (Tue 17:00Z): one UTC
    // date, two real days on skis.
    const twoLocalDays = deriveGearTotals(SKIS, [SKIS], [
      session('2026-01-13T02:00:00Z', ['sk1'], {}, LA),
      session('2026-01-13T17:00:00Z', ['sk1'], {}, LA),
    ]);
    expect(twoLocalDays.days).toBe(2);

    // Tuesday 3pm PST (Tue 23:00Z) + Tuesday 7pm PST (Wed 03:00Z): two UTC
    // dates, one lived day.
    const oneLocalDay = deriveGearTotals(SKIS, [SKIS], [
      session('2026-01-13T23:00:00Z', ['sk1'], {}, LA),
      session('2026-01-14T03:00:00Z', ['sk1'], {}, LA),
    ]);
    expect(oneLocalDay.sessions).toBe(2);
    expect(oneLocalDay.days).toBe(1);
  });

  it('leaves distanceKm/durationHr undefined — never 0 — when no session carried them', () => {
    const totals = deriveGearTotals(SKIS, [SKIS], [session('2026-01-10T09:00:00Z', ['sk1'])]);
    expect(totals.sessions).toBe(1);
    expect(totals.distanceKm).toBeUndefined();
    expect(totals.durationHr).toBeUndefined();
    expect(totals.days).toBe(1);
  });

  it('accrues from wind.gearIds and sky.gearRefs — cross-dimension refs count', () => {
    const wing: Gear = { id: 'w1', name: '9m Unit', category: 'wing' };
    const windSession: GearSessionLike = {
      occurredAt: '2026-06-20T18:00:00Z',
      tz: 'UTC',
      payload: { durationMin: 90, wind: { gearIds: ['w1'] } },
    };
    expect(deriveGearTotals(wing, [wing], [windSession]).sessions).toBe(1);
    expect(deriveGearTotals(wing, [wing], [windSession]).durationHr).toBe(1.5);

    const glider: Gear = { id: 'pg1', name: 'Rush 6', category: 'paraglider' };
    const skySession: GearSessionLike = {
      occurredAt: '2026-06-21T16:00:00Z',
      tz: 'UTC',
      payload: { sky: { gearRefs: [{ gearId: 'pg1' }] } },
    };
    expect(deriveGearTotals(glider, [glider], [skySession]).sessions).toBe(1);
  });

  it('reports the most recent counting session as lastUsed, gates and all', () => {
    const totals = deriveGearTotals(SHOES, [SHOES], [
      session('2026-06-01T08:00:00Z', ['sh1']),
      session('2026-06-09T08:00:00Z', ['sh1']),
      session('2026-06-05T08:00:00Z', ['sh1']),
      session('2026-06-20T08:00:00Z', ['other-gear']), // untagged — not a use
    ]);
    expect(totals.lastUsed).toEqual({ occurredAt: '2026-06-09T08:00:00Z', day: '2026-06-09' });

    // A component's lastUsed obeys the acquiredOn gate — a parent ride before
    // install was never a use of the component.
    const componentTotals = deriveGearTotals(CHAIN, [BIKE, CHAIN], [
      session('2026-06-15T10:00:00Z', ['b1']),
    ]);
    expect(componentTotals.lastUsed).toBeUndefined();

    // Nothing ever counted → absent, never a fabricated value.
    expect(deriveGearTotals(SKIS, [SKIS], []).lastUsed).toBeUndefined();
  });
});

describe('sessionGearIds', () => {
  it('unions the three ref homes and dedupes across them', () => {
    const ids = sessionGearIds({
      gearIds: ['a', 'b'],
      wind: { gearIds: ['b', 'c'] },
      sky: { gearRefs: [{ gearId: 'c' }, { gearId: 'd' }] },
    });
    expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns empty for a session with no refs anywhere', () => {
    expect(sessionGearIds({})).toEqual([]);
  });
});

describe('gearStatusLine', () => {
  it('states a total past the user-set mark as a fact about their own mark', () => {
    const line = gearStatusLine(SHOES, { sessions: 40, distanceKm: 612, days: 40 });
    expect(line).toBe('612 km — past your 500 km mark');
  });

  it('states a total short of the mark without urgency', () => {
    const line = gearStatusLine(SHOES, { sessions: 15, distanceKm: 213, days: 15 });
    expect(line).toBe('213 km of your 500 km mark');
  });

  it('falls back to plain totals when no mark is set', () => {
    const plain: Gear = { id: 'sh2', name: 'Old pair', category: 'shoes' };
    expect(gearStatusLine(plain, { sessions: 3, distanceKm: 42, days: 3 })).toBe(
      '3 sessions · 42 km'
    );
    expect(gearStatusLine(plain, { sessions: 1, days: 1 })).toBe('1 session');
  });

  it('counts a quiver entry in days', () => {
    expect(gearStatusLine(SKIS, { sessions: 14, days: 11 })).toBe('11 days this quiver entry');
    const marked: Gear = { ...SKIS, spec: { targetDays: 10 } } as Gear;
    expect(gearStatusLine(marked, { sessions: 14, days: 11 })).toBe(
      '11 days — past your 10 day mark'
    );
  });

  it('reads a component against its service interval in hours when km is unknowable', () => {
    const shock: Gear = {
      id: 's1',
      name: 'Shock',
      category: 'bike-component',
      spec: { componentType: 'shock', serviceIntervalHr: 80 },
    };
    expect(gearStatusLine(shock, { sessions: 30, durationHr: 84.2, days: 28 })).toBe(
      '84 hr — past your 80 hr mark'
    );
    expect(gearStatusLine(shock, { sessions: 5, durationHr: 12, days: 5 })).toBe(
      '12 hr of your 80 hr mark'
    );
  });

  it('never speaks in imperatives — no alerts, no advice (constitution)', () => {
    const lines = [
      gearStatusLine(SHOES, { sessions: 40, distanceKm: 612, days: 40 }),
      gearStatusLine(SHOES, { sessions: 15, distanceKm: 213, days: 15 }),
      gearStatusLine(SKIS, { sessions: 14, days: 11 }),
      gearStatusLine(CHAIN, { sessions: 9, distanceKm: 350, days: 9 }),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/replace|should|must|need to|time to|overdue|!/i);
    }
  });
});
