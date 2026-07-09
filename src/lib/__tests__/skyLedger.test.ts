import { describe, it, expect } from '@jest/globals';
import type { ObservationOf } from '@core/observation';
import { computeUshpaLedger, ledgerAgainst, USHPA_P3 } from '@core/ushpaLedger';
import { skyFlightFacts } from '../skyLedger';

function skySession(over: {
  activity: string;
  occurredAt: string;
  tz?: string;
  durationMin?: number;
  spotId?: string;
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
      activity: over.activity,
      ...(over.durationMin != null ? { durationMin: over.durationMin } : {}),
      sky: {
        ...(over.track ? { track: over.track } : {}),
        ...(over.segments
          ? { segments: over.segments.map((s) => ({ ...s, provenance: 'auto' as const })) }
          : {}),
        ...(over.spotId ? { spotId: over.spotId } : {}),
      },
    },
  };
}

describe('skyFlightFacts', () => {
  it('skips sessions without a matching sky activity', () => {
    const other = skySession({ activity: 'run', occurredAt: '2026-07-01T10:00:00Z', durationMin: 30 });
    expect(skyFlightFacts([other])).toEqual([]);
  });

  it('maps each activity to its USHPA style', () => {
    const facts = skyFlightFacts([
      skySession({ activity: 'paragliding', occurredAt: '2026-07-01T10:00:00Z', durationMin: 60 }),
      skySession({ activity: 'hikeAndFly', occurredAt: '2026-07-02T10:00:00Z', durationMin: 45 }),
      skySession({ activity: 'speedflying', occurredAt: '2026-07-03T10:00:00Z', durationMin: 5 }),
      skySession({ activity: 'parakiting', occurredAt: '2026-07-04T10:00:00Z', durationMin: 90 }),
    ]);
    expect(facts.map((f) => f.style)).toEqual(['xc', 'hikefly', 'speed', 'parakite']);
  });

  it('uses the whole manual duration as airtime for a hand-logged (trackless) session', () => {
    const facts = skyFlightFacts([
      skySession({ activity: 'paragliding', occurredAt: '2026-07-01T10:00:00Z', durationMin: 42 }),
    ]);
    expect(facts[0].airtimeMin).toBe(42);
  });

  it('uses only air-segment time as airtime when a track/segments are present', () => {
    const track = Array.from({ length: 400 }, (_, i) => ({ lat: 0, lng: 0, tsSec: i }));
    const facts = skyFlightFacts([
      skySession({
        activity: 'parakiting',
        occurredAt: '2026-07-01T10:00:00Z',
        durationMin: 400 / 60, // whole session duration would over-count
        track,
        segments: [
          { kind: 'ground', startIdx: 0, endIdx: 49 },
          { kind: 'air', startIdx: 50, endIdx: 149 },
          { kind: 'ground', startIdx: 150, endIdx: 199 },
          { kind: 'air', startIdx: 200, endIdx: 349 },
          { kind: 'ground', startIdx: 350, endIdx: 399 },
        ],
      }),
    ]);
    // air segments: (149-50) + (349-200) = 99 + 149 = 248s -> /60
    expect(facts[0].airtimeMin).toBeCloseTo(248 / 60, 6);
  });

  it('carries spotId through when present, absent otherwise', () => {
    const withSpot = skyFlightFacts([
      skySession({ activity: 'paragliding', occurredAt: '2026-07-01T10:00:00Z', durationMin: 30, spotId: 's1' }),
    ]);
    expect(withSpot[0].spotId).toBe('s1');

    const noSpot = skyFlightFacts([
      skySession({ activity: 'paragliding', occurredAt: '2026-07-01T10:00:00Z', durationMin: 30 }),
    ]);
    expect(noSpot[0].spotId).toBeUndefined();
  });

  it('resolves dateLocal in the observation\'s own timezone', () => {
    // 11pm Pacific on June 30 is 06:00 UTC July 1 — the flight happened June 30 locally.
    const facts = skyFlightFacts([
      skySession({
        activity: 'paragliding',
        occurredAt: '2026-07-01T06:00:00Z',
        tz: 'America/Los_Angeles',
        durationMin: 30,
      }),
    ]);
    expect(facts[0].dateLocal).toBe('2026-06-30');
  });

  it('feeds straight into computeUshpaLedger / ledgerAgainst', () => {
    const facts = skyFlightFacts([
      skySession({ activity: 'paragliding', occurredAt: '2026-07-01T10:00:00Z', durationMin: 60 }),
      skySession({ activity: 'hikeAndFly', occurredAt: '2026-07-02T10:00:00Z', durationMin: 30 }),
      skySession({ activity: 'speedflying', occurredAt: '2026-07-03T10:00:00Z', durationMin: 5 }), // excluded by default
    ]);
    const ledger = computeUshpaLedger(facts);
    expect(ledger.totalFlights).toBe(2); // speedflying excluded from DEFAULT_COUNTED_STYLES
    expect(ledger.totalHours).toBeCloseTo(1.5, 6);
    const cmp = ledgerAgainst(ledger, USHPA_P3);
    expect(cmp.flights?.met).toBe(false);
  });
});
