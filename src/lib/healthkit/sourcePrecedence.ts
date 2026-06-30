/**
 * sourcePrecedence.ts — pick ONE authoritative source per metric per day.
 *
 * Apple Health commonly has overlapping writers (iPhone pedometer + Apple Watch
 * + Garmin). Summing across them double-counts. The spec says: prefer wearable
 * over phone, alphabetical for determinism after that.
 *
 *   wearable-ingestion-spec.md § Source precedence / dedup
 */

const RANK_WEARABLE_PRIMARY = 0; // Garmin, Apple Watch — sovereign for steps/sleep
const RANK_PHONE = 1; // iPhone pedometer / iPhone sleep estimate
const RANK_OTHER = 2; // any third-party writer
const RANK_UNKNOWN = 3;

const WEARABLE_BUNDLES = new Set([
  'com.garmin.connect.mobile', // Garmin Connect
  'com.apple.health', // Apple Watch writes via this on iOS (any model)
]);

const PHONE_BUNDLES = new Set([
  'com.apple.Health', // iPhone Health app pedometer source
  'com.apple.mobileslideshow', // unlikely but seen in some pedometer flows
]);

export type CandidateSource = { sourceBundleId: string; sourceName: string };

export function rankSource(bundleId: string): number {
  if (!bundleId) return RANK_UNKNOWN;
  if (WEARABLE_BUNDLES.has(bundleId)) return RANK_WEARABLE_PRIMARY;
  if (PHONE_BUNDLES.has(bundleId)) return RANK_PHONE;
  return RANK_OTHER;
}

/** Returns the single authoritative source from a candidate set, or null
 *  if the list is empty. Tie-break is alphabetical on bundleIdentifier so
 *  the choice is deterministic across runs. */
export function pickAuthoritativeSource<T extends CandidateSource>(
  candidates: readonly T[]
): T | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestRank = rankSource(best.sourceBundleId);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    const r = rankSource(c.sourceBundleId);
    if (r < bestRank || (r === bestRank && c.sourceBundleId < best.sourceBundleId)) {
      best = c;
      bestRank = r;
    }
  }
  return best;
}
