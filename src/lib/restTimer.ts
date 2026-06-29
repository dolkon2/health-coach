/**
 * restTimer.ts — pure rest-timer math, platform-free so the hook and the tests
 * drive the same logic. The hook (hooks/useRestTimer.ts) wraps this with React
 * state, an interval, and a scheduled local notification.
 *
 * The timer is a user-started utility, not a nudge: it begins only when the user
 * marks a set done, and it never pushes content on its own (constitution: pull,
 * not push — no engagement theater).
 */
export type RestTimerState = {
  startedAtMs: number; // epoch ms when the rest started
  durationSec: number; // configured rest length
};

/** Whole seconds left, clamped at 0. */
export function restRemainingSec(state: RestTimerState, nowMs: number): number {
  const elapsedSec = (nowMs - state.startedAtMs) / 1000;
  return Math.max(0, Math.ceil(state.durationSec - elapsedSec));
}

export function isRestComplete(state: RestTimerState, nowMs: number): boolean {
  return restRemainingSec(state, nowMs) <= 0;
}

/** Seconds → "m:ss" (e.g. 90 → "1:30"). */
export function formatRest(remainingSec: number): string {
  const safe = Math.max(0, Math.round(remainingSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
