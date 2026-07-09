/**
 * conditions.ts — the frozen external-context snapshot (Dimension: Earth, E3).
 *
 * Conditions are PULL-ONLY context frozen onto a session at log time (⚑ E-2:
 * best-effort fetch at save, short timeout, offline → session saves without
 * conditions, no retry queue). They describe what the world was doing around a
 * tier-1 session; they never gate, score, or prompt anything.
 *
 * Tier per planning/outdoor-integrations.md:32-37: an instrument reading
 * (SNOTEL station) is tier 1; a model/forecast value (Open-Meteo, an avalanche
 * forecast) is tier 3. A tier-3 value may sit BESIDE a tier-1 fact, never gate
 * or overwrite it. Every reading carries its own provenance (⚑ E-3) so the
 * snapshot stays auditable forever, long after the source has moved on.
 *
 * All value keys are optional: a reading the source didn't have is absent,
 * never a fabricated 0 (null ≠ 0).
 */
import type { ISOInstant, LocalDate } from './observation';

/**
 * Provenance every frozen reading carries (⚑ E-3). `source` names where the
 * numbers came from (e.g. 'open-meteo', 'snotel:651:OR:SNTL',
 * 'avalanche.org'); `fetchedAt` is when WE froze them — distinct from when
 * the source measured or issued them.
 */
export interface ConditionsProvenance {
  /** 1 = instrument reading, 3 = model/forecast (outdoor-integrations.md:32-37). */
  tier: 1 | 3;
  source: string;
  fetchedAt: ISOInstant;
}

/**
 * Open-Meteo model values for the hour nearest the session's start — tier 3
 * (model output, source 'open-meteo'), frozen beside the session's facts.
 * `modelHourUtc` records which hourly slot the values came from, so "nearest
 * hour" stays auditable.
 */
export interface WeatherConditions extends ConditionsProvenance {
  tempC?: number;
  apparentTempC?: number;
  precipMm?: number;
  snowfallCm?: number;
  windSpeedKmh?: number;
  windDirDeg?: number;
  cloudCoverPct?: number;
  freezingLevelM?: number;
  modelHourUtc?: ISOInstant;
}

/**
 * Nearest SNOTEL station's daily readings for the session's civil day —
 * tier 1 (instrument, source 'snotel:<triplet>'). Fidelity note: `distanceKm`
 * is recorded so staleness-by-distance stays visible — a station 40 km from
 * the trailhead is honest context, not the trailhead's snowpack
 * (outdoor-integrations.md:127). Values are the network's native inches.
 */
export interface SnowConditions extends ConditionsProvenance {
  stationTriplet: string;
  stationName: string;
  distanceKm: number;
  stationElevationFt?: number;
  /** WTEQ — snow-water equivalent, inches. */
  sweIn?: number;
  /** SNWD — snow depth, inches. */
  depthIn?: number;
  /** PRCPSA — snow-adjusted precipitation increment, inches of water. */
  precipSnowAdjIn?: number;
  /** The civil day the values describe. */
  date: LocalDate;
}

/**
 * avalanche.org zone forecast for the session's location — tier 3 (a
 * FORECAST, source 'avalanche.org'), frozen WITH its issue/expiry so
 * staleness is visible forever. `dangerLevel` -1 with `danger` 'no rating'
 * (off-season) is a valid frozen fact, not a failure. `issuedAt`/`expiresAt`
 * are kept VERBATIM as the API's center-local naive strings (no zone suffix)
 * — appending one would fabricate precision the source didn't state.
 */
export interface AvalancheConditions extends ConditionsProvenance {
  zoneId: number;
  zoneName: string;
  center: string;
  dangerLevel: number;
  danger: string;
  travelAdvice?: string;
  offSeason?: boolean;
  issuedAt?: string;
  expiresAt?: string;
  link?: string;
}

/**
 * The snapshot frozen onto SessionPayload.conditions — an OPEN struct of
 * per-domain optional sub-objects. Earth owns weather/snow/avalanche; the
 * Water and Sky dimensions add their own optional sub-objects on their
 * branches (same low-conflict pattern as SessionPayload's sport blocks).
 * An empty snapshot is never stored — absence stays absence.
 */
export interface ConditionsSnapshot {
  weather?: WeatherConditions;
  snow?: SnowConditions;
  avalanche?: AvalancheConditions;
}

/**
 * Index of the hour in `times` nearest to `atIso`. `times` is Open-Meteo's
 * hourly axis: "YYYY-MM-DDTHH:MM" strings WITHOUT seconds or zone suffix
 * (with timezone=UTC they ARE UTC — utc_offset_seconds 0). Unparsable
 * entries are skipped; -1 when nothing parses. Ties pick the earlier hour.
 */
export function nearestHourIndex(times: string[], atIso: string): number {
  const at = Date.parse(atIso);
  if (!Number.isFinite(at)) return -1;
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    // Bare "YYYY-MM-DDTHH:MM" → append seconds + Z; anything already zoned parses as-is.
    const ms = Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}:00Z`);
    if (!Number.isFinite(ms)) continue;
    const dist = Math.abs(ms - at);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
