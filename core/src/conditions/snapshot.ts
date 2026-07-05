/**
 * conditions/snapshot.ts — immutable condition snapshots (Water dimension).
 *
 * Water sports are conditions-freeze sports: "I've run the Gauley" is
 * meaningless without "at 2,800 cfs", a wind session without the wind. The
 * snapshot is frozen onto the session payload AT SAVE and never rewritten —
 * the edit path round-trips it untouched. A failed fetch is an ABSENT
 * snapshot, never a stale one, never a now-reading mislabeled as the
 * session's conditions (backdated sessions fetch for the session time).
 *
 * These are facts with source provenance. They carry no fidelity score —
 * a gauge reading is a measurement, not an estimate.
 */

/** One instantaneous gauge reading. Values are parsed numbers (the USGS OGC
 * API returns them as strings for precision — parseFloat at the boundary). */
export interface GaugeReading {
  parameter: 'discharge' | 'gaugeHeight'; // USGS parameter codes 00060 | 00065
  value: number;
  unit: string; // as returned: 'ft^3/s' | 'ft'
  timeUtc: string; // RFC3339 UTC from the API
}

/** Immutable river-condition snapshot frozen onto a whitewater session. */
export interface GaugeSnapshot {
  /** Agency-prefixed USGS site id ('USGS-14123500'). Absent for manual entry. */
  siteId?: string;
  siteName?: string;
  /** Discharge and/or gauge height — whatever the site publishes; ≥1 entry. */
  readings: GaugeReading[];
  /** From a 6h series ENDING at session time. Level AND trend — a dropping
   * 2,800 and a rising 2,800 are different rivers. */
  trend?: 'rising' | 'falling' | 'steady';
  /** Reading time nearest the session (not the fetch time). */
  observedAtUtc: string;
  /** When the value was frozen. */
  fetchedAtUtc: string;
  source: 'usgs' | 'manual';
  /** 'Provisional' | 'Approved' — recent USGS data is provisional and subject
   * to revision; surfaced per USGS policy, never hidden. */
  approvalStatus?: string;
}

/** Immutable wind snapshot frozen onto a wind-sport session. */
export interface WindSnapshot {
  /** The REQUESTED spot coords — never the model's grid-snapped echo. */
  lat: number;
  lng: number;
  speedKts: number;
  gustKts?: number;
  /** Meteorological convention: the direction the wind blows FROM. */
  directionDeg?: number;
  /** Explicit RFC3339 UTC ('...Z'), derived from unixtime epoch responses. */
  observedAtUtc: string;
  fetchedAtUtc: string;
  /** Forecast-past and archive are different models that disagree for the
   * same hour — a snapshot records which one served it and never mixes. */
  source: 'open-meteo-forecast' | 'open-meteo-archive' | 'manual';
}
