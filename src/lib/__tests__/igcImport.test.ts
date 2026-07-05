import { describe, it, expect } from '@jest/globals';
import { parseIgc } from '../igcImport';

// A realistic recorded flight: A/H/I/C/L/G records around the B fixes, legacy
// HFDTE form, one void fix, one B line lengthened by I-record extensions.
// Valid fixes step 0.001° lat (~111 m) per minute; GNSS eles 1000→1020→1045→1040.
const RECORDED = [
  'AXCC001 Flymaster LIVE',
  'HFDTE250626',
  'HFPLTPILOTINCHARGE:Dylan Clancy',
  'HFGTYGLIDERTYPE:Ozone Rush 6',
  'HFGIDGLIDERID:OZONE-RUSH6',
  'HFDTM100GPSDATUM:WGS-1984',
  'I023638FXA3940SIU',
  'C1000005200000N00006000WTAKEOFF',
  'LCU::comment line, ignored',
  'B1000005200000N00006000WA0098001000',
  'B1001005200060N00006000WA0100001020',
  'B1001305200090N00006000WV0000000000',
  'B1002005200120N00006000WA0102001045003',
  'B1003005200180N00006000WA0101501040',
  'GABCDEF0123456789',
].join('\n');

// Southern hemisphere (S lat, E lon), newer HFDTEDATE: form, and a UTC
// midnight crossing (23:50 → 00:05 next day).
const ROLLOVER = [
  'HFDTEDATE:010326,01',
  'HFPLTPILOTINCHARGE:Dylan Clancy',
  'B2350003345678S15012345EA0050000480',
  'B2355003345738S15012345EA0049000470',
  'B0005003345798S15012345EA0047000450',
].join('\n');

describe('parseIgc', () => {
  it('parses a recorded flight: fixes, name, distance, duration, start', () => {
    const r = parseIgc(RECORDED);
    expect(r.name).toBe('OZONE-RUSH6'); // glider ID preferred over pilot
    expect(r.pointCount).toBe(4); // void fix skipped
    expect(r.points).toHaveLength(4);
    expect(r.points[0]).toEqual({
      lat: 52,
      lng: -0.1, // 000°06.000' W
      tsSec: Date.UTC(2026, 5, 25, 10, 0, 0) / 1000, // date from HFDTE
      eleM: 1000, // GNSS preferred over pressure
    });

    // 3 in-track hops of ~111 m (0.001° lat each).
    expect(r.distanceM).toBeGreaterThan(300);
    expect(r.distanceM).toBeLessThan(370);

    expect(r.durationMin).toBeCloseTo(3, 5);
    expect(r.startTime).toBe('2026-06-25T10:00:00.000Z');
  });

  it('elevation gain uses the shared 3 m hysteresis accumulator', () => {
    const r = parseIgc(RECORDED);
    // 1000→1020 (+20), →1045 (+25), →1040 (−5, ref reset) = 45.
    expect(r.elevationGainM).toBe(45);
  });

  it('handles CRLF line endings', () => {
    const r = parseIgc(RECORDED.replace(/\n/g, '\r\n'));
    expect(r.pointCount).toBe(4);
    expect(r.name).toBe('OZONE-RUSH6');
  });

  it('parses extension-lengthened B lines by their fixed prefix', () => {
    const r = parseIgc(RECORDED);
    expect(r.points[2]).toEqual({
      lat: 52.002,
      lng: -0.1,
      tsSec: Date.UTC(2026, 5, 25, 10, 2, 0) / 1000,
      eleM: 1045,
    });
  });

  it('handles S/W-signed hemispheres, HFDTEDATE: form, and midnight rollover', () => {
    const r = parseIgc(ROLLOVER);
    expect(r.name).toBe('Dylan Clancy'); // no HFGID → pilot
    expect(r.points[0].lat).toBeCloseTo(-(33 + 45.678 / 60), 9);
    expect(r.points[0].lng).toBeCloseTo(150 + 12.345 / 60, 9);
    expect(r.startTime).toBe('2026-03-01T23:50:00.000Z');
    // The 00:05 fix is the NEXT day: 23:50 → 00:05 = 15 min, not −23h45m.
    expect(r.points[2].tsSec).toBe(Date.UTC(2026, 2, 2, 0, 5, 0) / 1000);
    expect(r.durationMin).toBeCloseTo(15, 5);
  });

  it('accepts the spaced "HFDTE DATE:DDMMYY,NN" header variant', () => {
    const r = parseIgc(
      [
        'HFDTE DATE:250626,01',
        'B1000005200000N00006000WA0098001000',
        'B1001005200060N00006000WA0100001020',
      ].join('\n')
    );
    expect(r.startTime).toBe('2026-06-25T10:00:00.000Z');
  });

  it('altitude: GNSS≠0 wins, else pressure (negatives tolerated), else absent', () => {
    const r = parseIgc(
      [
        'HFDTE250626',
        'B1000005200000N00006000WA0058700000', // GNSS 0 → pressure 587
        'B1001005200060N00006000WA-001200000', // GNSS 0 → pressure −12
        'B1002005200120N00006000WA0000000000', // both 0 → no elevation
      ].join('\n')
    );
    expect(r.points[0].eleM).toBe(587);
    expect(r.points[1].eleM).toBe(-12);
    expect(r.points[2].eleM).toBeUndefined();
  });

  it('thins huge flights for storage but computes stats on the full set', () => {
    const bRecords = Array.from({ length: 9000 }, (_, i) => {
      const hh = String(10 + Math.floor(i / 3600)).padStart(2, '0');
      const mm = String(Math.floor((i % 3600) / 60)).padStart(2, '0');
      const ss = String(i % 60).padStart(2, '0');
      const mmm = String(i * 6).padStart(5, '0'); // +0.006'/fix ≈ 11 m
      return `B${hh}${mm}${ss}52${mmm}N00006000WA0100001000`;
    }).join('\n');
    const r = parseIgc(`HFDTE250626\n${bRecords}`);
    expect(r.pointCount).toBe(9000);
    expect(r.points.length).toBeLessThanOrEqual(4000);
    // Full-resolution distance: 8999 hops × ~11.1 m ≈ 100 km.
    expect(r.distanceM).toBeGreaterThan(99000);
    // Last fix always survives thinning.
    expect(r.points[r.points.length - 1].lat).toBeCloseTo(52 + 8999 * 0.0001, 6);
  });

  it('rejects empty files and files without an HFDTE date header', () => {
    expect(() => parseIgc('')).toThrow(/HFDTE/);
    expect(() =>
      parseIgc('B1000005200000N00006000WA0098001000\nB1001005200060N00006000WA0100001020')
    ).toThrow(/HFDTE/);
  });

  it('rejects files with fewer than two valid fixes', () => {
    expect(() => parseIgc('HFDTE250626')).toThrow(/fixes/i);
    expect(() =>
      parseIgc(
        [
          'HFDTE250626',
          'B1000005200000N00006000WA0098001000',
          'B1001005200060N00006000WV0000000000', // void doesn't count
        ].join('\n')
      )
    ).toThrow(/fixes/i);
  });

  it('skips malformed B lines instead of failing the file', () => {
    const r = parseIgc(
      [
        'HFDTE250626',
        'B1000005200000N00006000WA0098001000',
        'Bnot-a-fix',
        'B10015052000',
        'B1001005200060N00006000WA0100001020',
      ].join('\n')
    );
    expect(r.pointCount).toBe(2);
  });
});
