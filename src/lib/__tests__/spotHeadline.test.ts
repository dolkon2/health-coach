/**
 * spotHeadline tests — gauge reading preferred for a gauge-feed spot,
 * weather fallback, unit label mapping, and honest '—' when there's
 * nothing to show.
 */
import { describe, it, expect } from '@jest/globals';
import { spotHeadlineReading, updatedAtLabel } from '../spotHeadline';
import type { CurrentConditions } from '../conditions/current';

const NOW_ISO = '2026-07-11T12:00:00.000Z';

describe('spotHeadlineReading', () => {
  it('a gauge-feed spot with a discharge reading shows cfs', () => {
    const current: CurrentConditions = {
      gauge: {
        readings: [{ parameter: 'discharge', value: 2834.6, unit: 'ft^3/s', timeUtc: NOW_ISO }],
        observedAtUtc: NOW_ISO,
        fetchedAtUtc: NOW_ISO,
        source: 'usgs',
      },
      weather: null,
      fetchedAt: NOW_ISO,
    };
    expect(spotHeadlineReading('gauge', current)).toBe('2835 cfs');
  });

  it('a gauge-feed spot with only a gaugeHeight reading shows ft', () => {
    const current: CurrentConditions = {
      gauge: {
        readings: [{ parameter: 'gaugeHeight', value: 4.2, unit: 'ft', timeUtc: NOW_ISO }],
        observedAtUtc: NOW_ISO,
        fetchedAtUtc: NOW_ISO,
        source: 'usgs',
      },
      weather: null,
      fetchedAt: NOW_ISO,
    };
    expect(spotHeadlineReading('gauge', current)).toBe('4 ft');
  });

  it('a gauge-feed spot with no gauge reading yet falls back to weather', () => {
    const current: CurrentConditions = {
      gauge: null,
      weather: { tier: 3, source: 'open-meteo', fetchedAt: NOW_ISO, tempC: 18.4, windSpeedKmh: 12 },
      fetchedAt: NOW_ISO,
    };
    expect(spotHeadlineReading('gauge', current)).toBe('18°C · 12 km/h');
  });

  it('a weather-only spot (no feed) shows temp + wind', () => {
    const current: CurrentConditions = {
      gauge: null,
      weather: { tier: 3, source: 'open-meteo', fetchedAt: NOW_ISO, tempC: 22, windSpeedKmh: 5 },
      fetchedAt: NOW_ISO,
    };
    expect(spotHeadlineReading(null, current)).toBe('22°C · 5 km/h');
  });

  it('temp-only weather (no wind reading) shows temp alone', () => {
    const current: CurrentConditions = {
      gauge: null,
      weather: { tier: 3, source: 'open-meteo', fetchedAt: NOW_ISO, tempC: 22 },
      fetchedAt: NOW_ISO,
    };
    expect(spotHeadlineReading(null, current)).toBe('22°C');
  });

  it('no current conditions at all: honest dash, never fabricated', () => {
    expect(spotHeadlineReading(null, undefined)).toBe('—');
  });

  it('current conditions exist but both feeds are null: honest dash', () => {
    const current: CurrentConditions = { gauge: null, weather: null, fetchedAt: NOW_ISO };
    expect(spotHeadlineReading('gauge', current)).toBe('—');
  });
});

describe('updatedAtLabel', () => {
  it('null when nothing cached yet', () => {
    expect(updatedAtLabel(undefined, Date.parse(NOW_ISO))).toBeNull();
  });

  it('"just now" under a minute old', () => {
    const current: CurrentConditions = { gauge: null, weather: null, fetchedAt: NOW_ISO };
    expect(updatedAtLabel(current, Date.parse(NOW_ISO) + 30_000)).toBe('updated just now');
  });

  it('minutes ago under an hour', () => {
    const current: CurrentConditions = { gauge: null, weather: null, fetchedAt: NOW_ISO };
    expect(updatedAtLabel(current, Date.parse(NOW_ISO) + 5 * 60_000)).toBe('updated 5m ago');
  });

  it('hours ago past an hour', () => {
    const current: CurrentConditions = { gauge: null, weather: null, fetchedAt: NOW_ISO };
    expect(updatedAtLabel(current, Date.parse(NOW_ISO) + 3 * 3_600_000)).toBe('updated 3h ago');
  });
});
