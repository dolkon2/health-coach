/**
 * USHPA ledger tests — cumulative facts, descriptive only:
 *   - flying days deduplicate by local date (two flights, one day);
 *   - default style scope is xc + hikefly; countedStyles overrides it fully;
 *   - hours are the full-resolution sum of minutes / 60, never rounded here;
 *   - siteless flights count toward flights/hours/days but never toward
 *     uniqueSites — named in flightsWithoutSite, never folded away;
 *   - ledgerAgainst returns { have, need, met, provable } facts, only for the
 *     metrics the requirement names;
 *   - the sites verdict uses bounds: met when the named-site count alone
 *     crosses the need, provably short only when even the siteless flights
 *     couldn't close the gap, otherwise unprovable (met false, provable false).
 */
import { describe, it, expect } from '@jest/globals';
import {
  computeUshpaLedger,
  ledgerAgainst,
  DEFAULT_COUNTED_STYLES,
  USHPA_P3,
  type FlightFact,
  type UshpaLedger,
} from '@core/ushpaLedger';

function flight(
  dateLocal: string,
  airtimeMin: number,
  over: Partial<FlightFact> = {}
): FlightFact {
  return { dateLocal, airtimeMin, style: 'xc', spotId: 'spot-a', ...over };
}

function ledger(over: Partial<UshpaLedger> = {}): UshpaLedger {
  return {
    totalFlights: 0,
    totalHours: 0,
    flyingDays: 0,
    uniqueSites: 0,
    flightsWithoutSite: 0,
    ...over,
  };
}

describe('computeUshpaLedger — totals', () => {
  it('empty logbook is all zeros, not absence errors', () => {
    expect(computeUshpaLedger([])).toEqual(ledger());
  });

  it('sums hours at full resolution (minutes / 60, no rounding)', () => {
    const l = computeUshpaLedger([
      flight('2026-07-01', 90),
      flight('2026-07-02', 30),
      flight('2026-07-03', 25),
    ]);
    expect(l.totalHours).toBeCloseTo(145 / 60, 10);
    expect(l.totalFlights).toBe(3);
  });

  it('deduplicates flying days by local date', () => {
    const l = computeUshpaLedger([
      flight('2026-07-01', 20),
      flight('2026-07-01', 35),
      flight('2026-07-02', 40),
    ]);
    expect(l.totalFlights).toBe(3);
    expect(l.flyingDays).toBe(2);
  });

  it('deduplicates sites by spotId', () => {
    const l = computeUshpaLedger([
      flight('2026-07-01', 20, { spotId: 'woodrat' }),
      flight('2026-07-02', 20, { spotId: 'woodrat' }),
      flight('2026-07-03', 20, { spotId: 'baldy' }),
    ]);
    expect(l.uniqueSites).toBe(2);
    expect(l.flightsWithoutSite).toBe(0);
  });
});

describe('computeUshpaLedger — style scope', () => {
  it('defaults to xc + hikefly; speed and parakite are out of USHPA scope', () => {
    expect(DEFAULT_COUNTED_STYLES).toEqual(['xc', 'hikefly']);
    const l = computeUshpaLedger([
      flight('2026-07-01', 60, { style: 'xc' }),
      flight('2026-07-01', 60, { style: 'hikefly' }),
      flight('2026-07-02', 60, { style: 'speed', spotId: 'speed-hill' }),
      flight('2026-07-03', 60, { style: 'parakite', spotId: undefined }),
    ]);
    expect(l.totalFlights).toBe(2);
    expect(l.totalHours).toBe(2);
    expect(l.flyingDays).toBe(1); // the speed day never entered the ledger
    expect(l.uniqueSites).toBe(1);
    expect(l.flightsWithoutSite).toBe(0); // the siteless flight was out of scope
  });

  it('countedStyles overrides the default completely', () => {
    const flights = [
      flight('2026-07-01', 60, { style: 'xc' }),
      flight('2026-07-02', 60, { style: 'hikefly' }),
      flight('2026-07-03', 60, { style: 'speed' }),
    ];
    const l = computeUshpaLedger(flights, { countedStyles: ['speed'] });
    expect(l.totalFlights).toBe(1);
    expect(l.flyingDays).toBe(1);

    const both = computeUshpaLedger(flights, { countedStyles: ['xc', 'speed'] });
    expect(both.totalFlights).toBe(2); // hikefly excluded under the override
  });
});

describe('computeUshpaLedger — siteless honesty', () => {
  it('siteless flights count toward flights/hours/days, never toward sites', () => {
    const l = computeUshpaLedger([
      flight('2026-07-01', 60, { spotId: 'woodrat' }),
      flight('2026-07-02', 60, { spotId: undefined }),
      flight('2026-07-03', 60, { spotId: undefined }),
    ]);
    expect(l.totalFlights).toBe(3);
    expect(l.totalHours).toBe(3);
    expect(l.flyingDays).toBe(3);
    expect(l.uniqueSites).toBe(1);
    expect(l.flightsWithoutSite).toBe(2);
  });

  it('an empty-string spotId names nothing — treated as siteless', () => {
    const l = computeUshpaLedger([flight('2026-07-01', 60, { spotId: '' })]);
    expect(l.uniqueSites).toBe(0);
    expect(l.flightsWithoutSite).toBe(1);
  });
});

describe('ledgerAgainst — complete-count metrics', () => {
  it('reports have/need/met per metric; complete counts are always provable', () => {
    const l = ledger({ totalFlights: 95, totalHours: 19.5, flyingDays: 30 });
    const c = ledgerAgainst(l, USHPA_P3);
    expect(c.rating).toBe('P3');
    expect(c.flights).toEqual({ have: 95, need: 90, met: true, provable: true });
    expect(c.hours).toEqual({ have: 19.5, need: 20, met: false, provable: true });
    expect(c.flyingDays).toEqual({ have: 30, need: 30, met: true, provable: true });
    expect(c.sites).toBeUndefined(); // P3 names no sites requirement
  });

  it('a partial requirement yields facts only for the metrics it names', () => {
    const c = ledgerAgainst(ledger({ totalHours: 5 }), { rating: 'custom', hours: 10 });
    expect(c.hours).toEqual({ have: 5, need: 10, met: false, provable: true });
    expect(c.flights).toBeUndefined();
    expect(c.flyingDays).toBeUndefined();
    expect(c.sites).toBeUndefined();
  });
});

describe('ledgerAgainst — sites bounds', () => {
  const req = { rating: 'custom', sites: 5 };

  it('met when the named-site count alone crosses the need — siteless flights irrelevant', () => {
    const c = ledgerAgainst(ledger({ uniqueSites: 5, flightsWithoutSite: 12 }), req);
    expect(c.sites).toEqual({ have: 5, need: 5, met: true, provable: true });
  });

  it('unprovable when siteless flights could hide the missing sites', () => {
    // 3 named + 4 unattributed: those 4 could be 2+ new sites — or reflights.
    const c = ledgerAgainst(ledger({ uniqueSites: 3, flightsWithoutSite: 4 }), req);
    expect(c.sites).toEqual({ have: 3, need: 5, met: false, provable: false });
  });

  it('provably short only when even the siteless flights could not close the gap', () => {
    const c = ledgerAgainst(ledger({ uniqueSites: 3, flightsWithoutSite: 1 }), req);
    expect(c.sites).toEqual({ have: 3, need: 5, met: false, provable: true });
  });

  it('with no siteless flights the verdict is always settled', () => {
    const c = ledgerAgainst(ledger({ uniqueSites: 4, flightsWithoutSite: 0 }), req);
    expect(c.sites).toEqual({ have: 4, need: 5, met: false, provable: true });
  });
});
