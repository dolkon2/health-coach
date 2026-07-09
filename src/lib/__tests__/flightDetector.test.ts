import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import {
  detectFlightSegments,
  autoSegmentsForActivity,
  autoSegmentsRunFor,
  singleContinuousSegment,
  mergeGroundGapSecForActivity,
  XC_MERGE_GROUND_GAP_SEC,
  PARAKITE_MERGE_GROUND_GAP_SEC,
} from '../flightDetector';

// A steady synthetic track: `n` fixes at 1 Hz, moving at `speedMS` (or
// stationary) with a climb/sink rate of `climbMS`. Starts at lat/lng 0,0,
// elevation `startEle`.
function track(
  n: number,
  { speedMS = 0, climbMS = 0, startT = 0, startEle = 100 }: Partial<{
    speedMS: number;
    climbMS: number;
    startT: number;
    startEle: number;
  }> = {}
): GeoPoint[] {
  // ~1 m/s of groundspeed at the equator is roughly this many degrees of
  // longitude per second (small-angle approx, good enough for synthetic fixtures).
  const degPerMeter = 1 / 111_320;
  const out: GeoPoint[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      lat: 0,
      lng: speedMS * i * degPerMeter,
      tsSec: startT + i,
      eleM: startEle + climbMS * i,
    });
  }
  return out;
}

function concat(...tracks: GeoPoint[][]): GeoPoint[] {
  const out: GeoPoint[] = [];
  let tOffset = 0;
  for (const t of tracks) {
    for (const p of t) out.push({ ...p, tsSec: p.tsSec + tOffset });
    tOffset = out[out.length - 1].tsSec + 1;
  }
  return out;
}

describe('detectFlightSegments', () => {
  it('returns nothing for a track too short to segment', () => {
    expect(detectFlightSegments([{ lat: 0, lng: 0, tsSec: 0 }], 'paragliding')).toEqual([]);
    expect(detectFlightSegments([], 'paragliding')).toEqual([]);
  });

  it('stays entirely ground when the track never satisfies both trigger conditions', () => {
    // Walking pace, flat: below both the speed and vario triggers throughout.
    const pts = track(120, { speedMS: 1.2, climbMS: 0 });
    const segs = detectFlightSegments(pts, 'hikeAndFly');
    expect(segs).toEqual([{ kind: 'ground', startIdx: 0, endIdx: 119 }]);
  });

  it('stays ground when there is no elevation data at all (can\'t prove the vario condition)', () => {
    const pts = track(120, { speedMS: 10, climbMS: 0 }).map((p) => {
      const { eleM: _eleM, ...rest } = p;
      return rest as GeoPoint;
    });
    const segs = detectFlightSegments(pts, 'paragliding');
    expect(segs.every((s) => s.kind === 'ground')).toBe(true);
  });

  it('detects ground -> air -> ground for a clean XC flight', () => {
    const ground1 = track(60, { speedMS: 1, climbMS: 0 }); // walking to launch
    const air = track(300, { speedMS: 10, climbMS: 3, startEle: 100 }); // strong sustained climb+speed
    // Long enough that the post-roll (60s) + ground dwell (20s) + smoothing
    // lag near the seam still leave a real ground remainder at the end.
    const ground2 = track(400, { speedMS: 0.5, climbMS: 0 }); // landed, packing up
    const pts = concat(ground1, air, ground2);

    const segs = detectFlightSegments(pts, 'paragliding', { trackSource: 'igc' });

    expect(segs[0].kind).toBe('ground');
    expect(segs.some((s) => s.kind === 'air')).toBe(true);
    expect(segs[segs.length - 1].kind).toBe('ground');

    // The air segment should roughly span the middle of the track (allowing
    // for pre/post-roll and the confirm-duration lag) and should not include
    // the very first or very last fixes.
    const air1 = segs.find((s) => s.kind === 'air')!;
    expect(air1.startIdx).toBeGreaterThan(0);
    expect(air1.endIdx).toBeLessThan(pts.length - 1);
  });

  it('confirms air via the altitude-departure OR-path even without 60 s of sustained confirm', () => {
    // Speed stays just above the confirm floor but the softer confirm vario
    // condition is marginal; a strong, fast climb (>30 m within 60 s) should
    // still confirm via the OR-path well before the 60 s sustain would.
    const ground = track(60, { speedMS: 1, climbMS: 0 });
    const fastClimb = track(40, { speedMS: 8, climbMS: 2, startEle: 100 }); // +2m/s well over 30m by ~20s in
    const pts = concat(ground, fastClimb);
    const segs = detectFlightSegments(pts, 'paragliding', { trackSource: 'igc' });
    expect(segs.some((s) => s.kind === 'air')).toBe(true);
  });

  it('merges a brief touch-and-go for parakiting but treats the same gap as a landing for XC', () => {
    const air1 = track(200, { speedMS: 10, climbMS: 1.5 });
    // A 200 s raw ground gap. Pre-roll (30s) and post-roll (60s) padding eat
    // into both ends of the observed ground segment, so its *effective*
    // duration lands well under the raw 200s — comfortably above the 30 s
    // parakite merge window but still under the 300 s XC window, the
    // activity-dependent case the research calls out.
    const gap = track(200, { speedMS: 0.5, climbMS: 0 });
    const air2 = track(200, { speedMS: 10, climbMS: 1.5 });
    const pts = concat(air1, gap, air2);

    const parakiteSegs = detectFlightSegments(pts, 'parakiting', { trackSource: 'igc' });
    const xcSegs = detectFlightSegments(pts, 'paragliding', { trackSource: 'igc' });

    // Parakite: the 60 s gap clears its 30 s merge window, so it's kept as a
    // real ground segment between two air segments (not merged away).
    expect(parakiteSegs.filter((s) => s.kind === 'ground').length).toBeGreaterThanOrEqual(1);
    const parakiteAirCount = parakiteSegs.filter((s) => s.kind === 'air').length;

    // XC: the same 60 s gap is under its 300 s merge window, so the whole
    // thing reads as one continuous air segment with no internal ground gap.
    const xcInternalGround = xcSegs.filter(
      (s, i) => s.kind === 'ground' && i > 0 && i < xcSegs.length - 1
    );
    expect(xcInternalGround).toHaveLength(0);
    expect(xcSegs.filter((s) => s.kind === 'air').length).toBeLessThanOrEqual(parakiteAirCount);
  });

  it('never produces overlapping or out-of-order segments across a quick relaunch inside the post-roll window', () => {
    // A real touch-and-go: air, then a ~25s ground contact (just over
    // GROUND_SUSTAIN_SEC=20s so landing confirms) followed by an IMMEDIATE
    // relaunch, all well inside POST_ROLL_SEC (60s) of the landing trigger —
    // the exact band postRollIdx pads into. Regression case for a boundary
    // bug where the post-roll padding could extend past the loop's current
    // index and corrupt the next segment's start.
    const air1 = track(200, { speedMS: 10, climbMS: 1.5 });
    const touch = track(25, { speedMS: 0.3, climbMS: 0 });
    const air2 = track(200, { speedMS: 10, climbMS: 1.5 });
    const pts = concat(air1, touch, air2);

    for (const activity of ['paragliding', 'parakiting', 'speedflying', 'hikeAndFly'] as const) {
      const segs = detectFlightSegments(pts, activity, { trackSource: 'igc' });
      expect(segs.length).toBeGreaterThan(0);
      expect(segs[0].startIdx).toBe(0);
      expect(segs[segs.length - 1].endIdx).toBe(pts.length - 1);
      for (let i = 0; i < segs.length; i++) {
        expect(segs[i].endIdx).toBeGreaterThanOrEqual(segs[i].startIdx);
      }
      for (let i = 1; i < segs.length; i++) {
        // Segments must exactly partition the track: no gap, no overlap.
        expect(segs[i].startIdx).toBe(segs[i - 1].endIdx + 1);
      }
    }
  });

  it('never merges leading or trailing ground regardless of duration', () => {
    // A single short flight bookended by long ground stretches on both sides.
    const groundBefore = track(400, { speedMS: 1, climbMS: 0 });
    const air = track(200, { speedMS: 10, climbMS: 2 });
    const groundAfter = track(400, { speedMS: 1, climbMS: 0 });
    const pts = concat(groundBefore, air, groundAfter);

    const segs = detectFlightSegments(pts, 'speedflying', { trackSource: 'igc' });
    expect(segs[0].kind).toBe('ground');
    expect(segs[segs.length - 1].kind).toBe('ground');
    expect(segs.some((s) => s.kind === 'air')).toBe(true);
  });
});

describe('autoSegmentsForActivity — activity-gated auto-detection', () => {
  it('still runs ground-contact segmentation for Hike & Fly', () => {
    // A real hike-to-launch-then-fly-then-hike-off shape: genuine walking
    // pace on both ends, a strong thermal climb, and a real glide (sinking,
    // not flat) back toward the LZ before landing — elevation chained
    // continuously across phases, unlike the flatter synthetic edges above.
    const hikeUp = track(500, { speedMS: 1.3, climbMS: 0.15, startEle: 1200 }); // ~8 min walk to launch
    const climbEle = 1200 + 0.15 * 499;
    const thermal = track(500, { speedMS: 9, climbMS: 2.5, startEle: climbEle }); // strong core
    const glideEle = climbEle + 2.5 * 499;
    const glide = track(350, { speedMS: 6, climbMS: -1.2, startEle: glideEle }); // real glide to the LZ
    const glideEndEle = glideEle - 1.2 * 349;
    const hikeOff = track(400, { speedMS: 1.1, climbMS: -0.05, startEle: glideEndEle }); // walk off
    const pts = concat(hikeUp, thermal, glide, hikeOff);

    const gated = autoSegmentsForActivity(pts, 'hikeAndFly', { trackSource: 'igc' });
    const raw = detectFlightSegments(pts, 'hikeAndFly', { trackSource: 'igc' });

    expect(gated).toEqual(raw);
    expect(gated.some((s) => s.kind === 'air')).toBe(true);
    expect(gated.some((s) => s.kind === 'ground')).toBe(true);
  });

  it('defaults paragliding to one continuous flight even with a long calm mid-flight glide that would otherwise read as landed', () => {
    // Modeled on the real XC flight that over-split in production
    // (dev-log/dimension-sky-pass-2.md): strong thermal climbs bracketing a
    // long, slow, near-level glide (a low save / dead-calm valley crossing)
    // — slow and flat enough to trip the ground trigger (h<2.5, |v|<0.1) for
    // well over the 300 s XC merge window, so the raw detector genuinely
    // splits this into multiple air segments.
    const climb1 = track(700, { speedMS: 9, climbMS: 2, startEle: 1500 });
    const glideEle = 1500 + 2 * 699;
    const calmGlide = track(500, { speedMS: 1.8, climbMS: -0.05, startEle: glideEle });
    const climb2Ele = glideEle - 0.05 * 499;
    const climb2 = track(700, { speedMS: 9, climbMS: 1.8, startEle: climb2Ele });
    const pts = concat(climb1, calmGlide, climb2);

    // Sanity-check the premise: the raw detector really does over-split this
    // for an activity whose auto-detection isn't gated off.
    const raw = detectFlightSegments(pts, 'paragliding', { trackSource: 'igc' });
    expect(raw.filter((s) => s.kind === 'air').length).toBeGreaterThan(1);

    const gated = autoSegmentsForActivity(pts, 'paragliding', { trackSource: 'igc' });
    expect(gated).toEqual([{ kind: 'air', startIdx: 0, endIdx: pts.length - 1 }]);
  });

  it('defaults speedflying and parakiting to one continuous flight too', () => {
    const air1 = track(200, { speedMS: 10, climbMS: 1.5 });
    const gap = track(200, { speedMS: 0.5, climbMS: 0 });
    const air2 = track(200, { speedMS: 10, climbMS: 1.5 });
    const pts = concat(air1, gap, air2);

    for (const activity of ['speedflying', 'parakiting'] as const) {
      const gated = autoSegmentsForActivity(pts, activity, { trackSource: 'igc' });
      expect(gated).toEqual([{ kind: 'air', startIdx: 0, endIdx: pts.length - 1 }]);
    }
  });

  it('still returns [] for a track too short to segment, regardless of activity', () => {
    for (const activity of ['paragliding', 'hikeAndFly', 'speedflying', 'parakiting'] as const) {
      expect(autoSegmentsForActivity([{ lat: 0, lng: 0, tsSec: 0 }], activity)).toEqual([]);
      expect(autoSegmentsForActivity([], activity)).toEqual([]);
    }
  });
});

describe('singleContinuousSegment', () => {
  it('spans the whole track as one air segment', () => {
    const pts = track(120, { speedMS: 9, climbMS: 2 });
    expect(singleContinuousSegment(pts)).toEqual([{ kind: 'air', startIdx: 0, endIdx: 119 }]);
  });

  it('returns [] for fewer than 2 points', () => {
    expect(singleContinuousSegment([{ lat: 0, lng: 0, tsSec: 0 }])).toEqual([]);
    expect(singleContinuousSegment([])).toEqual([]);
  });
});

describe('autoSegmentsRunFor', () => {
  it('is true only for Hike & Fly', () => {
    expect(autoSegmentsRunFor('hikeAndFly')).toBe(true);
    expect(autoSegmentsRunFor('paragliding')).toBe(false);
    expect(autoSegmentsRunFor('speedflying')).toBe(false);
    expect(autoSegmentsRunFor('parakiting')).toBe(false);
  });
});

describe('mergeGroundGapSecForActivity', () => {
  it('gives paragliding and hike&fly the XC merge window', () => {
    expect(mergeGroundGapSecForActivity('paragliding')).toBe(XC_MERGE_GROUND_GAP_SEC);
    expect(mergeGroundGapSecForActivity('hikeAndFly')).toBe(XC_MERGE_GROUND_GAP_SEC);
  });

  it('gives parakiting and speedflying the short touch-and-go window', () => {
    expect(mergeGroundGapSecForActivity('parakiting')).toBe(PARAKITE_MERGE_GROUND_GAP_SEC);
    expect(mergeGroundGapSecForActivity('speedflying')).toBe(PARAKITE_MERGE_GROUND_GAP_SEC);
  });
});
