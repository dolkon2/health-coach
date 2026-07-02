import { describe, it, expect } from '@jest/globals';
import { parseGpx } from '../gpxImport';

// A small recorded track: two segments (a pause splits them), elevation + time
// on every point. Segment gap distance must NOT count as travelled distance.
const RECORDED = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Tuesday Loop</name>
    <trkseg>
      <trkpt lat="45.5000" lon="-122.6000"><ele>100</ele><time>2026-07-01T16:00:00Z</time></trkpt>
      <trkpt lat="45.5010" lon="-122.6000"><ele>104</ele><time>2026-07-01T16:01:00Z</time></trkpt>
      <trkpt lat="45.5020" lon="-122.6000"><ele>103</ele><time>2026-07-01T16:02:00Z</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="45.5100" lon="-122.6000"><ele>110</ele><time>2026-07-01T16:10:00Z</time></trkpt>
      <trkpt lat="45.5110" lon="-122.6000"><ele>118</ele><time>2026-07-01T16:12:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

// A planned route file: <rte>, no timestamps, no elevation.
const PLANNED = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
  <metadata><name>Planned out-and-back</name></metadata>
  <rte>
    <rtept lat="45.0" lon="-122.0"/>
    <rtept lat="45.01" lon="-122.0"/>
  </rte>
</gpx>`;

describe('parseGpx', () => {
  it('parses a recorded track: points, name, distance per segment, duration, start', () => {
    const r = parseGpx(RECORDED);
    expect(r.name).toBe('Tuesday Loop');
    expect(r.pointCount).toBe(5);
    expect(r.points).toHaveLength(5);
    expect(r.points[0]).toEqual({ lat: 45.5, lng: -122.6, tsSec: 1782921600, eleM: 100 });

    // ~0.001° lat ≈ 111 m. In-segment hops: 2×111 + 1×111 ≈ 333 m. The ~0.008°
    // (~890 m) jump BETWEEN segments must not be counted.
    expect(r.distanceM).toBeGreaterThan(300);
    expect(r.distanceM).toBeLessThan(370);

    // 16:00 → 16:12 across both segments.
    expect(r.durationMin).toBeCloseTo(12, 5);
    expect(r.startTime).toBe('2026-07-01T16:00:00.000Z');
  });

  it('elevation gain uses hysteresis: jitter below the 3 m threshold does not count', () => {
    const r = parseGpx(RECORDED);
    // 100→104 (+4 counts), 104→103 (−1 ignored), 103/104→110 (+6 from ref 104), 110→118 (+8) = 18.
    expect(r.elevationGainM).toBe(18);
  });

  it('imports a planned <rte> file as geometry with no fabricated time fields', () => {
    const r = parseGpx(PLANNED);
    expect(r.name).toBe('Planned out-and-back');
    expect(r.points).toHaveLength(2);
    expect(r.durationMin).toBeUndefined();
    expect(r.startTime).toBeUndefined();
    expect(r.elevationGainM).toBeUndefined();
    expect(r.distanceM).toBeGreaterThan(1000);
    expect(r.distanceM).toBeLessThan(1250);
  });

  it('thins huge tracks for storage but computes stats on the full set', () => {
    const pts = Array.from({ length: 9000 }, (_, i) => {
      const t = new Date(Date.UTC(2026, 6, 1, 16, 0, i)).toISOString();
      return `<trkpt lat="${45 + i * 0.0001}" lon="-122"><time>${t}</time></trkpt>`;
    }).join('');
    const xml = `<gpx version="1.1"><trk><trkseg>${pts}</trkseg></trk></gpx>`;
    const r = parseGpx(xml);
    expect(r.pointCount).toBe(9000);
    expect(r.points.length).toBeLessThanOrEqual(4000);
    // Full-resolution distance: 8999 hops × ~11.1 m ≈ 100 km.
    expect(r.distanceM).toBeGreaterThan(99000);
    // Last point always survives thinning.
    expect(r.points[r.points.length - 1].lat).toBeCloseTo(45 + 8999 * 0.0001, 6);
  });

  it('rejects non-GPX and empty files with user-facing messages', () => {
    expect(() => parseGpx('{"not":"xml"}')).toThrow(/GPX/);
    expect(() => parseGpx('<html><body>hi</body></html>')).toThrow(/GPX/);
    expect(() => parseGpx('<gpx version="1.1"><trk><trkseg/></trk></gpx>')).toThrow(
      /track points/i
    );
  });

  it('skips malformed points instead of failing the file', () => {
    const xml = `<gpx version="1.1"><trk><trkseg>
      <trkpt lat="45.0" lon="-122.0"/>
      <trkpt lat="not-a-number" lon="-122.0"/>
      <trkpt lat="45.001" lon="-122.0"/>
    </trkseg></trk></gpx>`;
    const r = parseGpx(xml);
    expect(r.pointCount).toBe(2);
  });
});
