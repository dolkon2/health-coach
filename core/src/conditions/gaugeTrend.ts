/**
 * conditions/gaugeTrend.ts — is the river rising, falling, or steady?
 *
 * A dropping 2,800 cfs and a rising 2,800 cfs are different rivers; the
 * snapshot records level AND direction. Computed from a 6h series ENDING
 * at the session time (never a window around "now" for a backdated
 * session — the fetch client owns that guarantee).
 *
 * Threshold: ±5% relative change between the window's chronological
 * endpoints. ⚑ Judgment call (contract §11) — 5% over 6h ignores sensor
 * jitter on big rivers while catching a real creek bump; tune with use.
 */
import type { SeriesPoint } from './usgs';

/** Relative-change threshold: |Δ|/|start| beyond this is a real move. */
export const TREND_THRESHOLD = 0.05;

export type GaugeTrendDirection = 'rising' | 'falling' | 'steady';

/**
 * Compare the endpoints of a chronologically sorted series (oldest first —
 * `parseSeries` output). Returns null when the window has fewer than two
 * points: one reading has no direction, and we never fabricate one.
 */
export function computeTrend(points: SeriesPoint[]): GaugeTrendDirection | null {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;

  if (first === 0) {
    // No baseline to take a relative change against: any flow appearing on a
    // dry gauge is rising; still zero is steady.
    if (last > 0) return 'rising';
    if (last < 0) return 'falling';
    return 'steady';
  }

  const rel = (last - first) / Math.abs(first);
  if (rel > TREND_THRESHOLD) return 'rising';
  if (rel < -TREND_THRESHOLD) return 'falling';
  return 'steady';
}
