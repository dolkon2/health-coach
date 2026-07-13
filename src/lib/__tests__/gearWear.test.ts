/**
 * The Proof — the quiver's wear read models are derived-on-read, honest about
 * absence, and descriptive only (P9, display-only):
 *   1. Sky airtime accrues per gear ref; ground segments never count; a
 *      SkyGearUse with segmentIds narrows accrual to exactly those segments.
 *   2. A trackless hand-logged flight contributes its manual duration — the
 *      skyLedger convention, USHPA caveat and all.
 *   3. Paraglider lines: baseline + tracked when a baseline exists; tracked
 *      floor when hours were flown; NOTHING when the record has nothing
 *      honest to say. Trim standing reads against the user's own mark.
 *   4. Reserve repack renders the date and days-elapsed — a date-keyed
 *      threshold, never a reminder — and is absent with no repack logged.
 *   5. No line ever speaks in imperatives.
 */
import { describe, it, expect } from '@jest/globals';
import type { ObservationOf } from '@core/observation';
import { paragliderWearLines, reserveRepackLine, skyAirtimeHrFor } from '../gearWear';

function flight(over: {
  occurredAt: string;
  tz?: string;
  durationMin?: number;
  gearRefs?: Array<{ gearId: string; segmentIds?: string[] }>;
  track?: { lat: number; lng: number; tsSec: number }[];
  segments?: Array<{ kind: 'air' | 'ground'; startIdx: number; endIdx: number }>;
}): ObservationOf<'session'> {
  return {
    id: 'x',
    kind: 'session',
    occurredAt: over.occurredAt,
    loggedAt: over.occurredAt,
    tz: over.tz ?? 'UTC',
    tier: 1,
    fidelity: 0.9,
    source: { type: 'manual' },
    payload: {
      kind: 'session',
      modality: 'other',
      activity: 'paragliding',
      ...(over.durationMin != null ? { durationMin: over.durationMin } : {}),
      sky: {
        ...(over.gearRefs ? { gearRefs: over.gearRefs } : {}),
        ...(over.track ? { track: over.track } : {}),
        ...(over.segments
          ? { segments: over.segments.map((s) => ({ ...s, provenance: 'auto' as const })) }
          : {}),
      },
    },
  };
}

// A 60-min track: air 0→30min, ground 30→45min, air 45→60min.
const TRACK = [0, 1800, 2700, 3600].map((tsSec) => ({ lat: 45, lng: -121, tsSec }));
const SEGMENTS: Array<{ kind: 'air' | 'ground'; startIdx: number; endIdx: number }> = [
  { kind: 'air', startIdx: 0, endIdx: 1 },
  { kind: 'ground', startIdx: 1, endIdx: 2 },
  { kind: 'air', startIdx: 2, endIdx: 3 },
];

describe('skyAirtimeHrFor', () => {
  it('sums air segments only for sessions that ref the gear', () => {
    const sessions = [
      flight({ occurredAt: '2026-06-01T10:00:00Z', gearRefs: [{ gearId: 'pg1' }], track: TRACK, segments: SEGMENTS }),
      flight({ occurredAt: '2026-06-02T10:00:00Z', gearRefs: [{ gearId: 'other' }], track: TRACK, segments: SEGMENTS }),
    ];
    // 30 + 15 air minutes = 0.75 hr; the ground segment and the other wing's
    // flight are invisible.
    expect(skyAirtimeHrFor('pg1', sessions)).toBeCloseTo(0.75);
  });

  it('narrows to the ref\'s own segments when segmentIds is present', () => {
    const sessions = [
      flight({
        occurredAt: '2026-06-01T10:00:00Z',
        gearRefs: [{ gearId: 'pg1', segmentIds: ['2'] }], // only the second air segment
        track: TRACK,
        segments: SEGMENTS,
      }),
    ];
    expect(skyAirtimeHrFor('pg1', sessions)).toBeCloseTo(0.25);
  });

  it('falls back to the manual duration for a trackless hand log', () => {
    const sessions = [
      flight({ occurredAt: '2026-06-01T10:00:00Z', durationMin: 42, gearRefs: [{ gearId: 'pg1' }] }),
    ];
    expect(skyAirtimeHrFor('pg1', sessions)).toBeCloseTo(0.7);
  });

  it('gates by the session\'s own civil day when onOrAfterDay is given', () => {
    const LA = 'America/Los_Angeles';
    const sessions = [
      // June 30 7pm PT — instant lands July 1 UTC, but it is still June 30
      // where it happened: before the gate day, must not count.
      flight({ occurredAt: '2026-07-01T02:00:00Z', tz: LA, durationMin: 60, gearRefs: [{ gearId: 'pg1' }] }),
      flight({ occurredAt: '2026-07-01T16:00:00Z', tz: LA, durationMin: 30, gearRefs: [{ gearId: 'pg1' }] }),
    ];
    expect(skyAirtimeHrFor('pg1', sessions, '2026-07-01')).toBeCloseTo(0.5);
  });
});

describe('paragliderWearLines', () => {
  it('says nothing when the record has nothing honest to say', () => {
    expect(paragliderWearLines('pg1', { style: 'xc' }, [])).toEqual([]);
    expect(paragliderWearLines('pg1', undefined, [])).toEqual([]);
  });

  it('reports baseline + tracked as one total, naming the baseline', () => {
    const sessions = [
      flight({ occurredAt: '2026-06-01T10:00:00Z', durationMin: 120, gearRefs: [{ gearId: 'pg1' }] }),
    ];
    expect(paragliderWearLines('pg1', { style: 'xc', hoursBaseline: 100 }, sessions)).toEqual([
      '102 hr on the wing (100 hr pre-app baseline)',
    ]);
  });

  it('reports the tracked floor when no baseline was declared', () => {
    const sessions = [
      flight({ occurredAt: '2026-06-01T10:00:00Z', durationMin: 90, gearRefs: [{ gearId: 'pg1' }] }),
    ];
    expect(paragliderWearLines('pg1', { style: 'xc' }, sessions)).toEqual([
      '2 hr tracked on the wing',
    ]);
  });

  it('reads trim standing against the user\'s own mark, counting only post-trim hours', () => {
    const sessions = [
      flight({ occurredAt: '2026-05-01T10:00:00Z', durationMin: 300, gearRefs: [{ gearId: 'pg1' }] }), // pre-trim
      flight({ occurredAt: '2026-06-10T10:00:00Z', durationMin: 120, gearRefs: [{ gearId: 'pg1' }] }),
    ];
    const spec = { style: 'xc' as const, lastTrimDate: '2026-06-01', trimNudgeHours: 1 };
    const lines = paragliderWearLines('pg1', spec, sessions);
    expect(lines).toContain('2 hr since your 2026-06-01 trim — past your 1 hr mark');
    // Without a mark there is no "of your…" claim — just the fact.
    const noMark = paragliderWearLines('pg1', { style: 'xc', lastTrimDate: '2026-06-01' }, sessions);
    expect(noMark).toContain('2 hr since your 2026-06-01 trim');
  });
});

describe('reserveRepackLine', () => {
  it('is absent when no repack was ever logged — the question was never asked', () => {
    expect(reserveRepackLine(undefined, '2026-07-13')).toBeUndefined();
    expect(reserveRepackLine({}, '2026-07-13')).toBeUndefined();
    expect(reserveRepackLine({ lastRepackAt: 'not-a-date' }, '2026-07-13')).toBeUndefined();
  });

  it('shows the date and days-elapsed with no interval set', () => {
    expect(reserveRepackLine({ lastRepackAt: '2026-01-10' }, '2026-07-13')).toBe(
      'Repacked 2026-01-10 — 184 days ago'
    );
  });

  it('names the user\'s own interval date, before and after it passes', () => {
    const spec = { lastRepackAt: '2026-01-10', repackIntervalMonths: 6 };
    expect(reserveRepackLine(spec, '2026-07-05')).toBe(
      'Repacked 2026-01-10 — 176 days ago · your 6-month interval marks 2026-07-10'
    );
    expect(reserveRepackLine(spec, '2026-07-13')).toBe(
      'Repacked 2026-01-10 — 184 days ago — past your 2026-07-10 repack date'
    );
  });

  it('states a future repack date plainly — never a negative "days ago"', () => {
    expect(reserveRepackLine({ lastRepackAt: '2027-01-04' }, '2026-07-13')).toBe(
      'Repacked 2027-01-04'
    );
  });

  it('names an interval saved without a repack on record, so the value never looks lost', () => {
    expect(reserveRepackLine({ repackIntervalMonths: 6 }, '2026-07-13')).toBe(
      'No repack on record · your interval is 6 months'
    );
  });

  it('never speaks in imperatives — no alerts, no advice (constitution)', () => {
    const lines = [
      reserveRepackLine({ lastRepackAt: '2026-01-10', repackIntervalMonths: 6 }, '2026-07-13'),
      reserveRepackLine({ lastRepackAt: '2026-01-10' }, '2026-07-13'),
      ...paragliderWearLines(
        'pg1',
        { style: 'xc', lastTrimDate: '2026-06-01', trimNudgeHours: 1 },
        [flight({ occurredAt: '2026-06-10T10:00:00Z', durationMin: 120, gearRefs: [{ gearId: 'pg1' }] })]
      ),
    ];
    for (const line of lines) {
      expect(line).toBeDefined();
      expect(line).not.toMatch(/replace|should|must|need to|time to|overdue|repack now|!/i);
    }
  });
});
