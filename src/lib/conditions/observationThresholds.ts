/**
 * observationThresholds.ts — the single source for F2's "is this station
 * usable" honesty cutoffs (forecast-tab.md §3): liveObservation.ts's
 * isUsable() filters against these, and synopticClient.ts derives its
 * server-side query radius/recency params from the SAME numbers (with a
 * safety margin, since the server-side bound must be a superset of the
 * app-level one or a usable station never even reaches isUsable()). Split
 * into its own module rather than living in liveObservation.ts because
 * liveObservation.ts already imports synopticClient.ts — importing back
 * would be circular.
 *
 * ⚑ Both are placeholders — confirm these numbers, or that they're fine,
 * before either is load-bearing for anything else.
 */

/** How far a station can be and still count as "this spot's weather."
 *  Wind especially is hyper-local; station distance is always shown so the
 *  user can judge relevance themselves regardless, but a cutoff still
 *  exists so a station three states away never appears at all. */
export const MAX_STATION_RADIUS_KM = 50;

/** Most stations report hourly at worst; 90 min gives slower-reporting
 *  road/RAWS stations room without letting a truly dead station read as
 *  "live." */
export const STALE_READING_CUTOFF_MIN = 90;
