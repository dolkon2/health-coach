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
    expect(r.points[0]).toEqual({
      lat: 45.5,
      lng: -122.6,
      tsSec: 1782921600,
      eleM: 100,
      eleSource: 'gps',
    });

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
    // A recorded <trk>'s gain is labeled 'gps' (⚑ E-9: device unknowable from
    // a file — understate, never claim barometric).
    expect(r.elevationGainSource).toBe('gps');
  });

  // Some exporters emit an empty <ele></ele> (or <ele/>) for fixes without
  // altitude. Number('') is 0 — accepting it would fabricate a sea-level
  // reading, stamp it 'gps', and explode the hysteresis gain (null ≠ 0).
  it('an empty <ele> tag is no reading: no eleM, no label, gain unaffected', () => {
    const r = parseGpx(`<gpx version="1.1"><trk><trkseg>
      <trkpt lat="45.000" lon="-122.0"><ele>1500</ele></trkpt>
      <trkpt lat="45.001" lon="-122.0"><ele></ele></trkpt>
      <trkpt lat="45.002" lon="-122.0"><ele/></trkpt>
      <trkpt lat="45.003" lon="-122.0"><ele>  </ele></trkpt>
      <trkpt lat="45.004" lon="-122.0"><ele>1510</ele></trkpt>
    </trkseg></trk></gpx>`);
    for (const i of [1, 2, 3]) {
      expect('eleM' in r.points[i]).toBe(false);
      expect('eleSource' in r.points[i]).toBe(false);
    }
    // 1500 → 1510 over the real readings: +10, not the +1510 a phantom
    // sea-level point in the middle would produce.
    expect(r.elevationGainM).toBe(10);
  });

  // E2: a point WITH <ele> is labeled eleSource 'gps' (device unknowable from a
  // file — understate, never claim barometric, ⚑ E-9); a point WITHOUT <ele>
  // carries NEITHER eleM nor eleSource — no label without a reading.
  it('labels elevation provenance per point: <ele> → gps, no <ele> → no label at all', () => {
    const recorded = parseGpx(RECORDED);
    for (const p of recorded.points) expect(p.eleSource).toBe('gps');

    const mixed = parseGpx(`<gpx version="1.1"><trk><trkseg>
      <trkpt lat="45.0" lon="-122.0"><ele>100</ele></trkpt>
      <trkpt lat="45.001" lon="-122.0"/>
    </trkseg></trk></gpx>`);
    expect(mixed.points[0].eleSource).toBe('gps');
    expect('eleM' in mixed.points[1]).toBe(false);
    expect('eleSource' in mixed.points[1]).toBe(false);
  });

  it('imports a planned <rte> file as geometry with no fabricated time fields', () => {
    const r = parseGpx(PLANNED);
    expect(r.name).toBe('Planned out-and-back');
    expect(r.points).toHaveLength(2);
    // No <ele> anywhere → neither an elevation nor a provenance label.
    expect(r.points.every((p) => !('eleM' in p) && !('eleSource' in p))).toBe(true);
    expect(r.durationMin).toBeUndefined();
    expect(r.startTime).toBeUndefined();
    expect(r.elevationGainM).toBeUndefined();
    expect(r.distanceM).toBeGreaterThan(1000);
    expect(r.distanceM).toBeLessThan(1250);
  });

  // An <rte> declares by structure that NO device recorded it — its <ele>
  // values are route-planner/terrain-model output. The readings are kept (the
  // gain is honest arithmetic on the file) but neither the points nor the gain
  // get a 'gps' label: that would overstate, the direction ⚑ E-9 forbids.
  it('a planned <rte> WITH <ele> keeps the readings but stamps no gps provenance', () => {
    const r = parseGpx(`<gpx version="1.1">
      <rte>
        <rtept lat="45.00" lon="-122.0"><ele>100</ele></rtept>
        <rtept lat="45.01" lon="-122.0"><ele>180</ele></rtept>
      </rte>
    </gpx>`);
    expect(r.points[0].eleM).toBe(100);
    expect(r.points[1].eleM).toBe(180);
    expect(r.points.every((p) => !('eleSource' in p))).toBe(true);
    expect(r.elevationGainM).toBe(80);
    expect('elevationGainSource' in r).toBe(false);
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
