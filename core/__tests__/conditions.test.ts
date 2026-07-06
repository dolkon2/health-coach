/**
 * Conditions tests (pure, no live network): the URL builder requests every
 * variable the freeze needs, and the normalizer proves the honesty rules —
 * nearest-hour selection (incl. tie + boundary), null API gaps staying absent
 * (never zero-filled), and the current-block-preferred surface.
 *
 * The fixture is a realistic hand-built Open-Meteo response: timezone=auto
 * shape (spot-local hourly.time strings + utc_offset_seconds), parallel
 * hourly arrays with null gaps. Offset is PDT (−25200 s), so a capturedAt of
 * 21:20Z is 14:20 at the spot.
 */
import { describe, it, expect } from '@jest/globals';
import {
  buildOpenMeteoUrl,
  normalizeOpenMeteo,
  openMeteoDateLocal,
  type OpenMeteoResponse,
  type SnapshotMeta,
} from '@core/conditions';

const META: SnapshotMeta = {
  id: 'snap-1',
  spotId: 'spot-1',
  capturedAt: '2026-07-05T21:20:00Z', // 14:20 spot-local (PDT)
  dateLocal: '2026-07-05',
};

function fixture(): OpenMeteoResponse {
  return {
    utc_offset_seconds: -25200, // PDT
    current: {
      time: '2026-07-05T14:15',
      temperature_2m: 23.9,
      wind_speed_10m: 4.4,
      wind_direction_10m: 282,
      wind_gusts_10m: 6.1,
      precipitation: 0,
    },
    hourly: {
      time: [
        '2026-07-05T13:00',
        '2026-07-05T14:00',
        '2026-07-05T15:00',
        '2026-07-05T16:00',
      ],
      temperature_2m: [22.1, 23.4, 24.0, 24.3],
      wind_speed_10m: [3.2, 4.1, 4.8, 5.5],
      wind_direction_10m: [270, 280, 285, 290],
      wind_gusts_10m: [5.0, null, 7.2, 8.0], // null gap at the 14:00 hour
      precipitation: [0, 0, 0, 0],
      wind_speed_850hPa: [6.5, 7.2, 7.9, 8.4],
      wind_direction_850hPa: [300, 305, null, 310],
      temperature_850hPa: [12.4, 12.8, 13.1, 13.3],
      // 700 hPa entirely missing from the model run — every entry null.
      wind_speed_700hPa: [null, null, null, null],
      wind_direction_700hPa: [null, null, null, null],
      temperature_700hPa: [null, null, null, null],
    },
  };
}

describe('buildOpenMeteoUrl', () => {
  const url = buildOpenMeteoUrl(45.66, -121.55);

  it('targets the standard forecast endpoint with the spot coordinates', () => {
    expect(url).toContain('https://api.open-meteo.com/v1/forecast?');
    expect(url).toContain('latitude=45.66');
    expect(url).toContain('longitude=-121.55');
  });

  it('requests every surface and pressure-level variable', () => {
    for (const v of [
      'temperature_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'precipitation',
      'wind_speed_850hPa',
      'wind_direction_850hPa',
      'temperature_850hPa',
      'wind_speed_700hPa',
      'wind_direction_700hPa',
      'temperature_700hPa',
    ]) {
      expect(url).toContain(v);
    }
  });

  it('requests m/s winds and the spot-local timezone', () => {
    expect(url).toContain('wind_speed_unit=ms');
    expect(url).toContain('timezone=auto');
  });

  it('carries a current block for the surface freeze', () => {
    expect(url).toMatch(/current=[^&]*wind_speed_10m/);
  });
});

describe('normalizeOpenMeteo — surface', () => {
  it('prefers the current block: the conditions AT capture, not the modeled hour', () => {
    const snap = normalizeOpenMeteo(fixture(), META);
    expect(snap.surface).toEqual({
      tempC: 23.9,
      windSpeedMS: 4.4,
      windDirDeg: 282,
      gustMS: 6.1,
      precipMm: 0,
    });
  });

  it('falls back to the nearest hour when the response has no current block', () => {
    const raw = fixture();
    delete raw.current;
    const snap = normalizeOpenMeteo(raw, META);
    // 14:20 local → nearest hour 14:00 (index 1); gusts are null there → absent.
    expect(snap.surface).toEqual({
      tempC: 23.4,
      windSpeedMS: 4.1,
      windDirDeg: 280,
      precipMm: 0,
    });
    expect(snap.surface).not.toHaveProperty('gustMS');
  });

  it('a null field in the current block stays absent, never zero', () => {
    const raw = fixture();
    raw.current!.wind_gusts_10m = null;
    const snap = normalizeOpenMeteo(raw, META);
    expect(snap.surface).not.toHaveProperty('gustMS');
    expect(snap.surface!.precipMm).toBe(0); // a real reported 0 IS kept
  });

  it('omits surface entirely when nothing was reported', () => {
    const snap = normalizeOpenMeteo({ utc_offset_seconds: -25200 }, META);
    expect(snap.surface).toBeUndefined();
    expect(snap.aloft).toBeUndefined();
  });
});

describe('normalizeOpenMeteo — aloft (nearest-hour rule)', () => {
  it('picks the hour nearest capturedAt: 14:20 local → the 14:00 row', () => {
    const snap = normalizeOpenMeteo(fixture(), META);
    expect(snap.aloft?.p850).toEqual({ windSpeedMS: 7.2, windDirDeg: 305, tempC: 12.8 });
  });

  it('an exact half-hour tie goes to the EARLIER hour', () => {
    // 21:30Z = 14:30 local — equidistant from 14:00 and 15:00.
    const snap = normalizeOpenMeteo(fixture(), { ...META, capturedAt: '2026-07-05T21:30:00Z' });
    expect(snap.aloft?.p850?.windSpeedMS).toBe(7.2); // 14:00, not 15:00
  });

  it('a capture before the first hour snaps to the first, after the last to the last', () => {
    const early = normalizeOpenMeteo(fixture(), { ...META, capturedAt: '2026-07-05T10:00:00Z' });
    expect(early.aloft?.p850?.windSpeedMS).toBe(6.5);
    const late = normalizeOpenMeteo(fixture(), { ...META, capturedAt: '2026-07-06T09:00:00Z' });
    expect(late.aloft?.p850?.windSpeedMS).toBe(8.4);
  });

  it('null gaps inside a level stay absent; an all-null level is omitted', () => {
    const snap = normalizeOpenMeteo(fixture(), { ...META, capturedAt: '2026-07-05T22:00:00Z' });
    // 15:00 row: 850 wind direction is null there — speed/temp still present.
    expect(snap.aloft?.p850).toEqual({ windSpeedMS: 7.9, tempC: 13.1 });
    expect(snap.aloft?.p850).not.toHaveProperty('windDirDeg');
    // 700 hPa is null across the board → no p700 key at all.
    expect(snap.aloft).not.toHaveProperty('p700');
  });

  it('omits aloft entirely when the response has no hourly block', () => {
    const raw = fixture();
    delete raw.hourly;
    const snap = normalizeOpenMeteo(raw, META);
    expect(snap.aloft).toBeUndefined();
    expect(snap.surface).toBeDefined(); // current block still freezes the surface
  });

  it('carries the meta through untouched with source open-meteo', () => {
    const snap = normalizeOpenMeteo(fixture(), META);
    expect(snap.id).toBe('snap-1');
    expect(snap.spotId).toBe('spot-1');
    expect(snap.capturedAt).toBe('2026-07-05T21:20:00Z');
    expect(snap.dateLocal).toBe('2026-07-05');
    expect(snap.source).toBe('open-meteo');
  });
});

describe('openMeteoDateLocal', () => {
  it('uses the response offset: a UTC instant past midnight is still yesterday at the spot', () => {
    // 05:30Z on the 6th is 22:30 on the 5th in PDT.
    expect(openMeteoDateLocal({ utc_offset_seconds: -25200 }, '2026-07-06T05:30:00Z')).toBe(
      '2026-07-05'
    );
  });

  it('rolls forward across midnight for positive offsets', () => {
    expect(openMeteoDateLocal({ utc_offset_seconds: 7200 }, '2026-07-05T23:30:00Z')).toBe(
      '2026-07-06'
    );
  });
});
