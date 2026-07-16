/**
 * usgsClient.ts — the network client the pure USGS parsers sit behind
 * (core/lib split per the Water contract §0.7; foodSearch.ts is the
 * template). USGS Water Data OGC API, no key, STRICT param validation
 * (unknown params → 400), site ids MUST be 'USGS-' prefixed.
 *
 * BACKDATE-CORRECT: `fetchGaugeSnapshot` takes the SESSION time and fetches
 * the river as it was THEN. A recent session (≤2h) may use the
 * latest-continuous collection; anything older reads a bounded interval of
 * the continuous collection around the session time. A failed fetch is a
 * typed null — never a throw, never stale data, and NEVER a now-reading
 * frozen onto a backdated session.
 */
import type { GaugeReading, GaugeSnapshot } from '@core/conditions/snapshot';
import {
  parseLatestReadings,
  parseSeries,
  parseSiteSearch,
  type GaugeSite,
  type ParsedGaugeReading,
} from '@core/conditions/usgs';
import { computeTrend } from '@core/conditions/gaugeTrend';
import { fetchJson, type FetchJsonDeps } from './fetchJson';

const BASE = 'https://api.waterdata.usgs.gov/ogcapi/v0';

/** ≤ this many seconds ago counts as "now" → latest-continuous path. */
const RECENT_CUTOFF_S = 2 * 3600;
/** Bounded historical window: session time ±3h per parameter. */
const HALF_WINDOW_S = 3 * 3600;
/** Trend series length: 6h ENDING at the session time. */
const TREND_WINDOW_S = 6 * 3600;

const PARAMETER_CODES = ['00060', '00065'] as const;

export type ConditionsDeps = FetchJsonDeps;

/** Epoch seconds → RFC3339 UTC without fractional seconds ('...Z'). */
function epochToRfc3339(sec: number): string {
  return new Date(Math.round(sec) * 1000).toISOString().replace('.000Z', 'Z');
}

/** Callers may pass bare digits ('14123500'); the API requires 'USGS-…'. */
function normalizeSiteId(siteId: string): string {
  const s = siteId.trim();
  return /^\d+$/.test(s) ? `USGS-${s}` : s;
}

/** Seconds between a reading's timestamp and the session time. */
function distanceS(r: { timeUtc: string }, whenUtcSec: number): number {
  return Math.abs(Date.parse(r.timeUtc) / 1000 - whenUtcSec);
}

/** Strip per-reading provenance down to the locked snapshot shape. */
function toGaugeReading(r: ParsedGaugeReading): GaugeReading {
  return { parameter: r.parameter, value: r.value, unit: r.unit, timeUtc: r.timeUtc };
}

/**
 * Freeze the river's state at `whenUtcSec` for `siteId`.
 *
 * Recent (now − when ≤ 2h): latest-continuous with limit=100 (parameter-rich
 * sites overflow the default limit of 10). Older: per-parameter bounded
 * intervals of the continuous collection (when−3h)/(when+3h), nearest
 * reading picked — live-probed 2026-07-05, the bounded `time=` form works.
 * Trend rides a 6h series ending at `when`; a trend failure degrades to a
 * snapshot WITHOUT trend (never blocks the readings). No readings → null.
 */
export async function fetchGaugeSnapshot(
  siteId: string,
  whenUtcSec: number,
  deps?: ConditionsDeps
): Promise<GaugeSnapshot | null> {
  const site = normalizeSiteId(siteId);
  const nowSec = Date.now() / 1000;

  let picked: ParsedGaugeReading[];
  if (nowSec - whenUtcSec <= RECENT_CUTOFF_S) {
    const url = `${BASE}/collections/latest-continuous/items?monitoring_location_id=${encodeURIComponent(site)}&limit=100&f=json`;
    picked = parseLatestReadings(await fetchJson(url, deps));
  } else {
    // Historical: one bounded query per parameter, nearest reading each.
    const interval = `${epochToRfc3339(whenUtcSec - HALF_WINDOW_S)}/${epochToRfc3339(whenUtcSec + HALF_WINDOW_S)}`;
    picked = [];
    for (const code of PARAMETER_CODES) {
      const url =
        `${BASE}/collections/continuous/items?monitoring_location_id=${encodeURIComponent(site)}` +
        `&parameter_code=${code}&time=${interval}&limit=100&f=json`;
      const readings = parseLatestReadings(await fetchJson(url, deps));
      if (readings.length === 0) continue;
      readings.sort((a, b) => distanceS(a, whenUtcSec) - distanceS(b, whenUtcSec));
      picked.push(readings[0]);
    }
  }
  if (picked.length === 0) return null;

  // Reading time nearest the session — the snapshot's observation moment.
  const nearest = [...picked].sort(
    (a, b) => distanceS(a, whenUtcSec) - distanceS(b, whenUtcSec)
  )[0];

  // Provisional anywhere taints the snapshot (surfaced per USGS policy).
  const statuses = picked.map((r) => r.approvalStatus).filter((s): s is string => !!s);
  const approvalStatus = statuses.includes('Provisional') ? 'Provisional' : statuses[0];

  // Trend from a 6h series ENDING at the session time, on the nearest
  // reading's parameter. limit=100 REQUIRED: the default limit of 10
  // truncates a 15-min-cadence 6h window to ~2.25h (fixture-proven).
  let trend: GaugeSnapshot['trend'];
  const trendCode = nearest.parameter === 'discharge' ? '00060' : '00065';
  const trendInterval = `${epochToRfc3339(whenUtcSec - TREND_WINDOW_S)}/${epochToRfc3339(whenUtcSec)}`;
  const trendUrl =
    `${BASE}/collections/continuous/items?monitoring_location_id=${encodeURIComponent(site)}` +
    `&parameter_code=${trendCode}&time=${trendInterval}` +
    `&sortby=-time&limit=100&skipGeometry=true&properties=time,value&f=json`;
  const series = parseSeries(await fetchJson(trendUrl, deps));
  const direction = computeTrend(series);
  if (direction !== null) trend = direction;

  return {
    siteId: site,
    readings: picked.map(toGaugeReading),
    ...(trend !== undefined ? { trend } : {}),
    observedAtUtc: nearest.timeUtc,
    fetchedAtUtc: new Date().toISOString(),
    source: 'usgs',
    ...(approvalStatus !== undefined ? { approvalStatus } : {}),
  };
}

/**
 * Search monitoring locations by name fragment (CQL2 LIKE, uppercased —
 * USGS location names are stored uppercase). USGS-agency sites only.
 */
export async function searchGaugeSitesByName(
  text: string,
  deps?: ConditionsDeps
): Promise<GaugeSite[]> {
  const q = text.trim().toUpperCase();
  if (!q) return [];
  // Escape single quotes for the CQL2 string literal.
  const filter = `monitoring_location_name LIKE '%${q.replace(/'/g, "''")}%'`;
  const url = `${BASE}/collections/monitoring-locations/items?f=json&filter=${encodeURIComponent(filter)}&limit=100`;
  return parseSiteSearch(await fetchJson(url, deps));
}

/**
 * Search stream monitoring locations inside a bounding box
 * [west, south, east, north]. `site_type_code=ST` keeps it to streams;
 * USGS-agency filter drops cooperator sites the data collections can't
 * serve. `next` cursor links are ignored at limit=100.
 */
export async function searchGaugeSitesByBbox(
  bbox: [west: number, south: number, east: number, north: number],
  deps?: ConditionsDeps
): Promise<GaugeSite[]> {
  const url =
    `${BASE}/collections/monitoring-locations/items?f=json` +
    `&bbox=${bbox.join(',')}&site_type_code=ST&limit=100`;
  return parseSiteSearch(await fetchJson(url, deps));
}
