/**
 * similar.ts — the "what did I ride last time in these conditions?" query.
 *
 * Pure, descriptive, no IO. Given past wind-sport sessions and a target wind
 * reading, rank the sessions by how close their frozen WindSnapshot was to the
 * target. The caller reads gearIds/kitId off the returned sessions' payloads —
 * this module only ranks history, it NEVER recommends (constitution:
 * descriptive by default; ranked facts, no "you should").
 *
 * Scoring — LOWER score = MORE similar. The score is a weighted distance:
 *
 *   score = |speedDelta kts|  +  DIRECTION_WEIGHT_KTS × (circularDelta° / 180)
 *
 * Speed delta is the primary term, measured directly in knots. Direction is
 * the secondary term: the circular delta (wraparound-aware, 350°→10° = 20°)
 * is normalized to 0..1 over the maximum possible 180° and scaled so a fully
 * opposite wind costs DIRECTION_WEIGHT_KTS knots of equivalent distance.
 * When either side lacks a direction the term is simply omitted — absent
 * means absent, never a fabricated 0° (constitution: null ≠ 0).
 */

import type { ObservationOf } from '../observation';

/**
 * Knots-equivalent cost of a fully opposite (180°) wind direction. 3 kts keeps
 * speed dominant: a dead-on direction match never outranks a session 3+ kts
 * closer in speed. ⚑ judgment call — tune with real use.
 */
const DIRECTION_WEIGHT_KTS = 3;

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MAX_SPEED_DELTA_KTS = 6;

export type SimilarWindTarget = {
  speedKts: number;
  directionDeg?: number; // meteorological (wind FROM); optional
};

export type SimilarWindOptions = {
  maxResults?: number; // default 5
  maxSpeedDeltaKts?: number; // default 6; sessions beyond this are excluded
};

export type SimilarWindMatch = {
  session: ObservationOf<'session'>;
  /** Weighted distance in knots-equivalent units. Lower = more similar. */
  score: number;
};

/**
 * Shortest angular distance between two compass bearings, degrees 0..180.
 * Handles wraparound: 350° vs 10° = 20°, never 340°.
 */
export function circularDeltaDeg(aDeg: number, bDeg: number): number {
  const raw = Math.abs(aDeg - bDeg) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/**
 * Rank past sessions by wind-condition similarity to `target`.
 *
 * - Only sessions carrying a frozen wind snapshot (`payload.wind?.wind`)
 *   participate; everything else is ignored, never scored.
 * - Sessions whose speed differs from the target by more than
 *   `maxSpeedDeltaKts` are excluded — a 25 kt day is not "similar" to a
 *   12 kt day no matter how the direction lines up.
 * - Result is sorted best-first (ascending score) and capped at `maxResults`.
 *
 * DESCRIPTIVE ONLY: returns ranked history, no recommendation.
 */
export function findSimilarWindSessions(
  sessions: ObservationOf<'session'>[],
  target: SimilarWindTarget,
  opts?: SimilarWindOptions
): SimilarWindMatch[] {
  const maxResults = opts?.maxResults ?? DEFAULT_MAX_RESULTS;
  const maxSpeedDeltaKts = opts?.maxSpeedDeltaKts ?? DEFAULT_MAX_SPEED_DELTA_KTS;

  const matches: SimilarWindMatch[] = [];
  for (const session of sessions) {
    const wind = session.payload.wind?.wind;
    if (!wind) continue; // no frozen snapshot → nothing factual to compare

    const speedDelta = Math.abs(wind.speedKts - target.speedKts);
    if (speedDelta > maxSpeedDeltaKts) continue;

    let score = speedDelta;
    // Direction term only when BOTH sides carry one — absent means absent.
    if (target.directionDeg !== undefined && wind.directionDeg !== undefined) {
      const dirDelta = circularDeltaDeg(wind.directionDeg, target.directionDeg);
      score += DIRECTION_WEIGHT_KTS * (dirDelta / 180);
    }
    matches.push({ session, score });
  }

  matches.sort((a, b) => a.score - b.score);
  return matches.slice(0, Math.max(0, maxResults));
}
