/**
 * spotHeadline.ts — the one-line "what's it doing" reading for a spot card
 * (pinned-spots-spec.md P2: "gauge ft/cfs for kayak spots, temp + wind
 * otherwise"). Pure formatting over a CurrentConditions reading — no fetch,
 * no storage. Null-honest throughout: a missing feed or a still-loading
 * fetch renders '—', never a fabricated number.
 */
import type { ConditionsFeed } from '@core/conditions/feedForSport';
import type { CurrentConditions } from './conditions/current';
import type { Spot } from '@core/spot';

const GAUGE_UNIT_LABEL: Record<string, string> = {
  'ft^3/s': 'cfs',
  ft: 'ft',
};

/** The primary gauge reading to headline: discharge (cfs) when the site
 *  publishes it, else whatever the site has (gauge height). */
function primaryGaugeReading(gauge: NonNullable<CurrentConditions['gauge']>) {
  return gauge.readings.find((r) => r.parameter === 'discharge') ?? gauge.readings[0];
}

/**
 * The card's headline reading: gauge value for a 'gauge'-feed spot with a
 * reading, else temp + wind from weather, else '—' (no data yet, or the
 * fetch came back empty). Never mixes feeds — a kayak spot's headline is
 * always its gauge when one exists, weather never substitutes for it.
 */
export function spotHeadlineReading(
  feed: ConditionsFeed | null,
  current: CurrentConditions | undefined
): string {
  if (!current) return '—';

  if (feed === 'gauge' && current.gauge && current.gauge.readings.length > 0) {
    const reading = primaryGaugeReading(current.gauge);
    const unit = GAUGE_UNIT_LABEL[reading.unit] ?? reading.unit;
    return `${Math.round(reading.value)} ${unit}`;
  }

  if (current.weather) {
    const parts: string[] = [];
    if (current.weather.tempC != null) parts.push(`${Math.round(current.weather.tempC)}°C`);
    if (current.weather.windSpeedKmh != null) parts.push(`${Math.round(current.weather.windSpeedKmh)} km/h`);
    if (parts.length > 0) return parts.join(' · ');
  }

  return '—';
}

/** "updated 3m ago" / "updated just now" — the honesty stamp beside a
 *  possibly-stale cached reading. Null when there's nothing cached yet. */
export function updatedAtLabel(current: CurrentConditions | undefined, nowMs: number): string | null {
  if (!current) return null;
  const ageMs = nowMs - Date.parse(current.fetchedAt);
  if (ageMs < 60_000) return 'updated just now';
  const minutes = Math.round(ageMs / 60_000);
  if (minutes < 60) return `updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `updated ${hours}h ago`;
}

/**
 * Sort spots newest-created first — the shared honest fallback for
 * "most-recently-visited" (the spec's stated ordering), used by both the
 * Spots list and Home's glance module until a sessions-at-spot query exists
 * (P3's listSessionsForSpot) to order by actual visit recency.
 */
export function sortSpotsByRecency(spots: Spot[]): Spot[] {
  return [...spots].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}
