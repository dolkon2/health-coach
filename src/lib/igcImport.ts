/**
 * igcImport.ts — client-side IGC parsing for the file-import path (Sky
 * activities: paraglide, hang glide, speedfly).
 *
 * An IGC file (FAI flight-recorder format: plaintext, one record per line) is
 * parsed entirely on-device into the same shape gpxImport.ts produces, so both
 * import paths feed the same consumers. B-records carry only a UTC time-of-day;
 * the flight DATE comes from the HFDTE header, and a large backwards jump in
 * time-of-day means the flight crossed UTC midnight (the date advances).
 *
 * Honesty rules:
 * - distance/elevation/duration are computed from the FULL fix set, before any
 *   downsampling for storage.
 * - void fixes (validity 'V') are dropped — a fix the recorder itself marked
 *   invalid is not data.
 * - altitude prefers the GNSS value, falls back to pressure; when BOTH read 0
 *   (the recorder had neither) the point carries no elevation — absent, never
 *   a fabricated 0.
 */
import type { GeoPoint } from '@core/observation';
import { elevationGainM, haversineM, thinTrack } from './geo';

export type IgcImportResult = {
  name?: string; // HFGID glider ID, else HFPLT pilot
  points: GeoPoint[]; // downsampled if huge (see MAX_STORED_POINTS)
  pointCount: number; // original valid-fix count, before downsampling
  distanceM: number; // haversine over consecutive fixes, full-resolution
  elevationGainM?: number; // 3 m hysteresis accumulator; absent if no altitude
  durationMin?: number; // last fix − first
  startTime?: string; // ISO of the first fix
};

// Legacy "HFDTEDDMMYY" and newer "HFDTEDATE:DDMMYY[,NN]" (flight-of-day suffix
// and an optional space around DATE: tolerated).
const HFDTE = /^HFDTE\s?(?:DATE\s?:\s?)?(\d{2})(\d{2})(\d{2})/;

// B-record fixed prefix: B HHMMSS DDMMmmm(N|S) DDDMMmmm(E|W) (A|V) PPPPP GGGGG.
// Altitudes are metres and may be negative ("-0012"). No trailing anchor:
// I-record extensions append fields past column 35 and are ignored.
const B_RECORD =
  /^B(\d{2})(\d{2})(\d{2})(\d{2})(\d{5})([NS])(\d{3})(\d{5})([EW])([AV])(-\d{4}|\d{5})(-\d{4}|\d{5})/;

// A genuine midnight crossing jumps time-of-day back by nearly 24 h; a fix a
// second or two out of order must not advance the date.
const ROLLOVER_MARGIN_SEC = 12 * 3600;

type Fix = { secOfDay: number; lat: number; lng: number; eleM?: number };

function parseB(line: string): Fix | null {
  const m = B_RECORD.exec(line);
  if (!m) return null;
  if (m[10] === 'V') return null; // void fix: no valid position
  const secOfDay = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  const lat = (Number(m[4]) + Number(m[5]) / 1000 / 60) * (m[6] === 'S' ? -1 : 1);
  const lng = (Number(m[7]) + Number(m[8]) / 1000 / 60) * (m[9] === 'W' ? -1 : 1);
  const pAlt = Number(m[11]);
  const gAlt = Number(m[12]);
  const fix: Fix = { secOfDay, lat, lng };
  if (gAlt !== 0) fix.eleM = gAlt;
  else if (pAlt !== 0) fix.eleM = pAlt;
  return fix;
}

/**
 * Parses an IGC document. Throws with a user-facing message when the file has
 * no HFDTE date header or fewer than two valid fixes. All other record types
 * (A/I/C/L/G/…) are ignored.
 */
export function parseIgc(text: string): IgcImportResult {
  const lines = text.split(/\r?\n/);

  let date: { y: number; m: number; d: number } | null = null;
  let glider: string | undefined;
  let pilot: string | undefined;

  for (const line of lines) {
    if (date === null) {
      const dm = HFDTE.exec(line);
      if (dm) {
        const yy = Number(dm[3]);
        // Two-digit year: pivot at 80 (GNSS recorders predate 2000).
        date = { d: Number(dm[1]), m: Number(dm[2]), y: yy >= 80 ? 1900 + yy : 2000 + yy };
        continue;
      }
    }
    if (glider === undefined) {
      const g = /^HFGID[^:]*:(.*)$/.exec(line);
      if (g && g[1].trim()) {
        glider = g[1].trim();
        continue;
      }
    }
    if (pilot === undefined) {
      const p = /^HFPLT[^:]*:(.*)$/.exec(line);
      if (p && p[1].trim()) pilot = p[1].trim();
    }
  }

  if (date === null) {
    throw new Error('No flight date (HFDTE header) found — not a readable IGC file.');
  }
  const baseSec = Date.UTC(date.y, date.m - 1, date.d) / 1000;

  const points: GeoPoint[] = [];
  let dayOffset = 0;
  let prevSecOfDay: number | null = null;

  for (const line of lines) {
    if (!line.startsWith('B')) continue;
    const fix = parseB(line);
    if (fix === null) continue; // void or malformed: skip, never fail the file
    if (prevSecOfDay !== null && prevSecOfDay - fix.secOfDay > ROLLOVER_MARGIN_SEC) {
      dayOffset += 1;
    }
    prevSecOfDay = fix.secOfDay;
    const p: GeoPoint = {
      lat: fix.lat,
      lng: fix.lng,
      tsSec: baseSec + dayOffset * 86400 + fix.secOfDay,
    };
    if (fix.eleM !== undefined) p.eleM = fix.eleM;
    points.push(p);
  }

  if (points.length < 2) throw new Error('No flight fixes found in this file.');

  let distanceM = 0;
  for (let i = 1; i < points.length; i++) distanceM += haversineM(points[i - 1], points[i]);

  const startSec = points[0].tsSec;
  const endSec = points[points.length - 1].tsSec;
  const durationMin = endSec > startSec ? (endSec - startSec) / 60 : undefined;
  const gain = elevationGainM(points);
  const name = glider ?? pilot;

  return {
    ...(name !== undefined ? { name } : {}),
    points: thinTrack(points),
    pointCount: points.length,
    distanceM: Math.round(distanceM),
    ...(gain !== undefined ? { elevationGainM: gain } : {}),
    ...(durationMin !== undefined ? { durationMin } : {}),
    startTime: new Date(startSec * 1000).toISOString(),
  };
}
