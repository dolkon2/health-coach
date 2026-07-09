/**
 * flightDetector.ts — takeoff/landing segmentation, shared by IGC import and
 * live GPS (research: planning/sky-research-track-b.md §2/§3b, the
 * XCSoar/SkyLines precedent of one detector code path for both).
 *
 * A hysteresis state machine over 10 s CENTERED moving averages of horizontal
 * speed `h` (m/s) and vertical speed magnitude `|v|` (m/s, from GPS elevation
 * deltas — no phone barometer plumbing exists yet). Never compares single
 * fixes: every surveyed real-world tool (igc-xc-score, XCSoar, igc_lib,
 * Flytec, Flymaster, XCTrack) smooths before thresholding.
 *
 * Two passes:
 *  1. `rawSegments` — the state machine, producing raw air/ground segments
 *     with pre/post-roll (a segment boundary is proposed late by design, on
 *     purpose — Flyskyhy's 30 s pre-roll, Flytec's +1 min post-roll).
 *  2. `mergeShortGroundGaps` — an activity-dependent merge window absorbs
 *     brief ground contacts (foot drags, touch-and-gos, ski touches) back
 *     into one continuous air segment, per the igc_lib-vs-igc-xc-score
 *     divergence the research calls "the key insight."
 *
 * Honesty rules (constitution: heuristics are tunable, documented with their
 * error band):
 *  - Every threshold below is cited to a real tool in the research doc; where
 *    a value differs between IGC (baro-quality) and live phone GPS (noisier,
 *    no baro), `trackSource` selects the wider phone floor — this is a
 *    documented heuristic, not a verified constant (the research flags phone
 *    barometer characteristics as unestablished).
 *  - A window with no computable speed/vario (missing elevation, or fixes too
 *    sparse to fill the window) never fabricates a trigger — the state
 *    simply doesn't confirm, biasing toward under- not over-detection. All
 *    detected boundaries are proposals: the caller stamps them
 *    `provenance: 'auto'` and the UI lets the user edit or discard them
 *    (Naviter ships a landing-confirmation UI for the same reason).
 *  - Ski-vs-air is provably undecidable from speed+vario alone (§2 — ski
 *    descent sits on the paraglider trim band); this module does not attempt
 *    it. The resolved product answer is a user-set per-session tag, carried
 *    on SkyBlock.onSkis, not detected here.
 */
import type { GeoPoint } from '@core/observation';
import { cumulativeDistanceM } from './geo';

export type SkyDetectorActivity = 'paragliding' | 'hikeAndFly' | 'speedflying' | 'parakiting';

export type DetectedSegmentKind = 'air' | 'ground';

export type DetectedSegment = {
  kind: DetectedSegmentKind;
  startIdx: number;
  endIdx: number;
};

// ─── Cited parameters (§3b) ─────────────────────────────────────────────────

const SMOOTHING_WINDOW_SEC = 10; // igc-xc-score `maPeriod`
const AIR_TRIGGER_SPEED_MS = 5; // igc-xc-score definitionFlight {xt:5}; 18 km/h clears hiking
const AIR_TRIGGER_VARIO_MS = 0.9; // igc-xc-score definitionFlight {zt:0.9}
const AIR_CONFIRM_SPEED_MS = 1.5; // igc-xc-score {x0:1.5}
/** igc-xc-score's {z0:0.05} is baro-quality; phone-GPS-only elevation noise
 * (PLOS One: vertical error 2-5x horizontal) makes that floor unreliable —
 * raised to the research's suggested 0.3 for a live capture with no baro. */
const AIR_CONFIRM_VARIO_MS_IGC = 0.05;
const AIR_CONFIRM_VARIO_MS_LIVE_GPS = 0.3;
const AIR_CONFIRM_SEC = 60; // igc-xc-score {t:60}
const ALTITUDE_DEPARTURE_M = 30; // Flytec 6030 official manual V3.21 (corrected value)
const ALTITUDE_DEPARTURE_WINDOW_SEC = 60; // Flytec manual
const GROUND_TRIGGER_SPEED_MS = 2.5; // igc-xc-score definitionGround
const GROUND_TRIGGER_VARIO_MS = 0.1; // igc-xc-score definitionGround
const GROUND_SUSTAIN_SEC = 20; // igc-xc-score ground dwell
const PRE_ROLL_SEC = 30; // Flyskyhy pre-roll
const POST_ROLL_SEC = 60; // Flytec +1 min

/** XC / hike&fly: merge ground gaps under 5 min into one flight (igc_lib
 * `min_landing_time`) — a real landing rarely resumes flight that fast. */
export const XC_MERGE_GROUND_GAP_SEC = 300;
/** Parakite / speedfly touch-and-go: Dylan's chosen starting value (2026-07-08,
 * research §4 flag 1 — no community-quantified touchdown counts exist yet).
 * Ship as the default; tune once there are real dune tracks to look at. */
export const PARAKITE_MERGE_GROUND_GAP_SEC = 30;

/** The merge-window default per activity — parakite and speedfly both get
 * the short touch-and-go window; paragliding/hike&fly get the XC window. A
 * lookup keyed on the full activity union (rather than a growing ternary)
 * so a 5th sky activity can't be added without deciding its value here. */
const MERGE_GROUND_GAP_SEC_BY_ACTIVITY: Record<SkyDetectorActivity, number> = {
  paragliding: XC_MERGE_GROUND_GAP_SEC,
  hikeAndFly: XC_MERGE_GROUND_GAP_SEC,
  speedflying: PARAKITE_MERGE_GROUND_GAP_SEC,
  parakiting: PARAKITE_MERGE_GROUND_GAP_SEC,
};

export function mergeGroundGapSecForActivity(activity: SkyDetectorActivity): number {
  return MERGE_GROUND_GAP_SEC_BY_ACTIVITY[activity];
}

export type DetectFlightSegmentsOptions = {
  /** 'igc' (baro-quality recorder) vs 'liveGps' (phone, no baro) — selects the
   * air-confirm vertical floor. Defaults to 'liveGps' (the wider, safer floor). */
  trackSource?: 'igc' | 'liveGps';
  /** Ground-gap duration under which a gap between two air segments is
   * absorbed into one continuous air segment. Defaults per activity via
   * {@link mergeGroundGapSecForActivity}. */
  mergeGroundGapSec?: number;
};

type Smoothed = { hMS: number | undefined; vMS: number | undefined; eleAvgM: number | undefined };

/** Centered moving averages of horizontal speed, (signed) vertical rate, and
 * elevation, one entry per point. `undefined` when the point's window can't
 * support a reading (no time spread, or no elevation-carrying fix inside the
 * window) — never a fabricated value. `eleAvgM` (mean elevation over the
 * window) backs the altitude-departure OR-path so it never compares two raw
 * single fixes — phone-GPS vertical noise (2-5x horizontal, per the research)
 * could otherwise spike a spurious 30 m "departure" off one bad fix. */
function computeSmoothed(points: GeoPoint[], windowSec: number): Smoothed[] {
  const n = points.length;
  const cumM = cumulativeDistanceM(points);

  const half = windowSec / 2;
  const out: Smoothed[] = new Array(n);
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    const t = points[i].tsSec;
    while (lo < n - 1 && t - points[lo].tsSec > half) lo++;
    while (hi < n - 1 && points[hi + 1].tsSec - t <= half) hi++;

    const dt = points[hi].tsSec - points[lo].tsSec;
    const hMS = dt > 0 ? (cumM[hi] - cumM[lo]) / dt : undefined;

    let firstEle: number | undefined;
    let lastEle: number | undefined;
    let firstT = 0;
    let lastT = 0;
    let eleSum = 0;
    let eleCount = 0;
    for (let k = lo; k <= hi; k++) {
      const ele = points[k].eleM;
      if (ele == null) continue;
      if (firstEle === undefined) {
        firstEle = ele;
        firstT = points[k].tsSec;
      }
      lastEle = ele;
      lastT = points[k].tsSec;
      eleSum += ele;
      eleCount += 1;
    }
    const vdt = lastT - firstT;
    const vMS =
      firstEle !== undefined && lastEle !== undefined && vdt > 0
        ? (lastEle - firstEle) / vdt
        : undefined;
    const eleAvgM = eleCount > 0 ? eleSum / eleCount : undefined;

    out[i] = { hMS, vMS, eleAvgM };
  }
  return out;
}

/** The largest index >= `minIdx` whose time is >= `t - PRE_ROLL_SEC` — walks
 * backward from `fromIdx` to include the pre-roll buffer, never crossing
 * `minIdx` (the start of the segment being carved from). */
function preRollIdx(points: GeoPoint[], fromIdx: number, minIdx: number): number {
  const cutoff = points[fromIdx].tsSec - PRE_ROLL_SEC;
  let i = fromIdx;
  while (i - 1 >= minIdx && points[i - 1].tsSec >= cutoff) i--;
  return i;
}

/** The largest index <= `maxIdx` whose time is <= `fromT + POST_ROLL_SEC` —
 * walks forward from `fromIdx` to include the post-roll buffer. */
function postRollIdx(points: GeoPoint[], fromIdx: number, maxIdx: number): number {
  const cutoff = points[fromIdx].tsSec + POST_ROLL_SEC;
  let i = fromIdx;
  while (i + 1 <= maxIdx && points[i + 1].tsSec <= cutoff) i++;
  return i;
}

/**
 * Pass 1: the hysteresis state machine. Produces raw air/ground segments
 * covering every index, pre/post-rolled, with no merge applied yet.
 */
function rawSegments(points: GeoPoint[], smoothed: Smoothed[], airConfirmVarioMS: number): DetectedSegment[] {
  const n = points.length;
  const segments: DetectedSegment[] = [];
  let state: DetectedSegmentKind = 'ground';
  let segStartIdx = 0;

  let airTriggerIdx: number | null = null;
  let airConfirmHoldStartIdx: number | null = null;
  let groundHoldStartIdx: number | null = null;

  for (let i = 0; i < n; i++) {
    const { hMS, vMS } = smoothed[i];

    if (state === 'ground') {
      const strongTrigger =
        hMS !== undefined && vMS !== undefined && hMS > AIR_TRIGGER_SPEED_MS && Math.abs(vMS) > AIR_TRIGGER_VARIO_MS;
      if (airTriggerIdx === null && strongTrigger) airTriggerIdx = i;

      if (airTriggerIdx !== null) {
        const confirmCond =
          hMS !== undefined && vMS !== undefined && hMS > AIR_CONFIRM_SPEED_MS && Math.abs(vMS) > airConfirmVarioMS;
        if (confirmCond) {
          if (airConfirmHoldStartIdx === null) airConfirmHoldStartIdx = i;
          const heldSec = points[i].tsSec - points[airConfirmHoldStartIdx].tsSec;

          // Smoothed (windowed) elevation, never two raw single fixes — see
          // computeSmoothed's eleAvgM doc.
          const baseEle = smoothed[airTriggerIdx].eleAvgM;
          const curEle = smoothed[i].eleAvgM;
          const withinDepartureWindow =
            points[i].tsSec - points[airTriggerIdx].tsSec <= ALTITUDE_DEPARTURE_WINDOW_SEC;
          const departed =
            baseEle !== undefined &&
            curEle !== undefined &&
            withinDepartureWindow &&
            Math.abs(curEle - baseEle) > ALTITUDE_DEPARTURE_M;

          if (heldSec >= AIR_CONFIRM_SEC || departed) {
            const startIdx = preRollIdx(points, airTriggerIdx, segStartIdx);
            if (startIdx > segStartIdx) {
              segments.push({ kind: 'ground', startIdx: segStartIdx, endIdx: startIdx - 1 });
            }
            segStartIdx = startIdx;
            state = 'air';
            airTriggerIdx = null;
            airConfirmHoldStartIdx = null;
            groundHoldStartIdx = null;
          }
        } else {
          // The softer confirm condition broke — the candidate never held;
          // require a fresh strong trigger before trying again.
          airTriggerIdx = null;
          airConfirmHoldStartIdx = null;
        }
      }
    } else {
      const groundCond =
        hMS !== undefined && vMS !== undefined && hMS < GROUND_TRIGGER_SPEED_MS && Math.abs(vMS) < GROUND_TRIGGER_VARIO_MS;
      if (groundCond) {
        if (groundHoldStartIdx === null) groundHoldStartIdx = i;
        const heldSec = points[i].tsSec - points[groundHoldStartIdx].tsSec;
        if (heldSec >= GROUND_SUSTAIN_SEC) {
          const endIdx = postRollIdx(points, groundHoldStartIdx, n - 1);
          segments.push({ kind: 'air', startIdx: segStartIdx, endIdx });
          segStartIdx = Math.min(endIdx + 1, n - 1);
          state = 'ground';
          groundHoldStartIdx = null;
          // The post-roll buffer can reach past the loop's current position
          // (GROUND_SUSTAIN_SEC, the confirm latency, is shorter than
          // POST_ROLL_SEC, the padding it then applies) — fast-forward so a
          // re-launch inside that already-claimed range is evaluated fresh
          // from segStartIdx, never re-triggering a candidate at an index
          // behind it (which would hand preRollIdx a startIdx < segStartIdx
          // and corrupt the next segment's boundaries).
          if (endIdx > i) i = endIdx;
        }
      } else {
        groundHoldStartIdx = null;
      }
    }
  }

  // The final open segment, whatever state we ended in.
  if (segments.length === 0 || segments[segments.length - 1].endIdx < n - 1) {
    segments.push({ kind: state, startIdx: segStartIdx, endIdx: n - 1 });
  }
  return segments;
}

/**
 * Pass 2: absorb a ground segment strictly between two air segments into one
 * continuous air segment when its duration is under `mergeGroundGapSec` — a
 * brief ground contact (foot drag, touch-and-go, ski touch) never splits the
 * flight. Leading/trailing ground (before the first liftoff, after the final
 * landing) is left alone regardless of duration — there's no flight on both
 * sides to merge with.
 */
function mergeShortGroundGaps(
  raw: DetectedSegment[],
  points: GeoPoint[],
  mergeGroundGapSec: number
): DetectedSegment[] {
  const out: DetectedSegment[] = [];
  let i = 0;
  while (i < raw.length) {
    const seg = raw[i];
    const prev = out[out.length - 1];
    const next = raw[i + 1];
    if (seg.kind === 'ground' && prev?.kind === 'air' && next?.kind === 'air') {
      const durationSec = points[seg.endIdx].tsSec - points[seg.startIdx].tsSec;
      if (durationSec < mergeGroundGapSec) {
        prev.endIdx = next.endIdx; // absorb the gap AND the following air segment
        i += 2;
        continue;
      }
    }
    out.push({ ...seg });
    i += 1;
  }
  return out;
}

/**
 * Detect takeoff/landing segments over a track. Returns `[]` for a track too
 * short to segment (fewer than 2 points) — nothing detected is an honest
 * empty result, not a fabricated single segment.
 */
export function detectFlightSegments(
  points: GeoPoint[],
  activity: SkyDetectorActivity,
  opts: DetectFlightSegmentsOptions = {}
): DetectedSegment[] {
  if (points.length < 2) return [];

  const trackSource = opts.trackSource ?? 'liveGps';
  const airConfirmVarioMS =
    trackSource === 'igc' ? AIR_CONFIRM_VARIO_MS_IGC : AIR_CONFIRM_VARIO_MS_LIVE_GPS;
  const mergeGroundGapSec = opts.mergeGroundGapSec ?? mergeGroundGapSecForActivity(activity);

  const smoothed = computeSmoothed(points, SMOOTHING_WINDOW_SEC);
  const raw = rawSegments(points, smoothed, airConfirmVarioMS);
  return mergeShortGroundGaps(raw, points, mergeGroundGapSec);
}

/** One segment spanning the whole track, unconditionally `kind: 'air'` — the
 * default {@link autoSegmentsForActivity} falls back to for the activities
 * ground-contact detection doesn't suit. `[]` for a track too short to have
 * a duration, matching `detectFlightSegments`' own empty-result convention. */
export function singleContinuousSegment(points: GeoPoint[]): DetectedSegment[] {
  if (points.length < 2) return [];
  return [{ kind: 'air', startIdx: 0, endIdx: points.length - 1 }];
}

/** Whether an activity gets automatic ground-contact/hysteresis segmentation
 * at all (the {@link autoSegmentsForActivity} pass). Only Hike & Fly has a
 * genuine hike-then-fly mode switch to find — Dylan's real XC paraglide
 * flight over-split into 4 air segments on exactly the failure this excludes:
 * a long calm inter-thermal glide (or a low save) can read as "on the ground"
 * — `h<2.5 AND |v|<0.1` for 20s — without the pilot ever landing, and Dylan's
 * read (2026-07-08, dev-log/dimension-sky-pass-2.md) is that the same
 * ambiguity applies to speedflying and parakiting tracks too. A lookup keyed
 * on the full activity union (rather than an `=== 'hikeAndFly'` check) so a
 * 5th sky activity can't be added without deciding its value here — the same
 * pattern {@link MERGE_GROUND_GAP_SEC_BY_ACTIVITY} already uses. Exported so
 * the UI can gate the manual "Check for a landing" escape hatch (only
 * meaningful for an activity that doesn't already auto-segment) off this
 * same source of truth instead of a second hardcoded check. */
const AUTO_SEGMENTS_BY_ACTIVITY: Record<SkyDetectorActivity, boolean> = {
  paragliding: false,
  hikeAndFly: true,
  speedflying: false,
  parakiting: false,
};

export function autoSegmentsRunFor(activity: SkyDetectorActivity): boolean {
  return AUTO_SEGMENTS_BY_ACTIVITY[activity];
}

/**
 * The activity-gated entry point every call site should use instead of
 * calling `detectFlightSegments` directly for an automatic (non-user-
 * requested) detection pass. Activities {@link autoSegmentsRunFor} excludes
 * default to one continuous air segment instead. A real top-landing/relaunch
 * is still recoverable — the caller can always invoke `detectFlightSegments`
 * directly as a user-requested manual check (log-session.tsx's "Check for a
 * landing" action) — this function only governs the automatic pass.
 */
export function autoSegmentsForActivity(
  points: GeoPoint[],
  activity: SkyDetectorActivity,
  opts: DetectFlightSegmentsOptions = {}
): DetectedSegment[] {
  if (autoSegmentsRunFor(activity)) return detectFlightSegments(points, activity, opts);
  return singleContinuousSegment(points);
}
