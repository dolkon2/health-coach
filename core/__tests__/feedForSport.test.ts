/**
 * feedForSport tests — gauge/wind/swell family membership, weather-only
 * fallback, and the untagged/absent-sport case.
 */
import { describe, it, expect } from '@jest/globals';
import { feedForSport, defaultForecastPanels } from '@core/conditions/feedForSport';

describe('feedForSport', () => {
  it('kayak/whitewater resolve to gauge', () => {
    expect(feedForSport('kayak')).toBe('gauge');
    expect(feedForSport('whitewater')).toBe('gauge');
  });

  it('the wind family resolves to wind', () => {
    for (const id of ['wingfoil', 'windsurf', 'kitesurf', 'parawing', 'sail', 'paragliding', 'hikeAndFly']) {
      expect(feedForSport(id)).toBe('wind');
    }
  });

  it('speedflying and parakiting are NOT wired to wind (spec names only two Sky activities)', () => {
    expect(feedForSport('speedflying')).toBeNull();
    expect(feedForSport('parakiting')).toBeNull();
  });

  it('surf resolves to swell', () => {
    expect(feedForSport('surf')).toBe('swell');
  });

  it('weather-only activities resolve to null', () => {
    expect(feedForSport('run')).toBeNull();
    expect(feedForSport('climb')).toBeNull();
    expect(feedForSport('hike')).toBeNull();
  });

  it('untagged (absent/null/undefined) resolves to null', () => {
    expect(feedForSport(undefined)).toBeNull();
    expect(feedForSport(null)).toBeNull();
    expect(feedForSport('')).toBeNull();
  });
});

describe('defaultForecastPanels', () => {
  it('gauge-family defaults to Gauge', () => {
    expect(defaultForecastPanels('kayak')).toEqual(['gauge']);
    expect(defaultForecastPanels('whitewater')).toEqual(['gauge']);
  });

  it('the wind family defaults to Wind', () => {
    for (const id of ['wingfoil', 'windsurf', 'kitesurf', 'parawing', 'sail', 'paragliding', 'hikeAndFly']) {
      expect(defaultForecastPanels(id)).toEqual(['wind']);
    }
  });

  it('surf (swell) defaults to Wind too — the honest interim, no swell panel yet', () => {
    expect(defaultForecastPanels('surf')).toEqual(['wind']);
  });

  it('weather-only activities and untagged spots default to Rain/Shine', () => {
    expect(defaultForecastPanels('run')).toEqual(['rain-shine']);
    expect(defaultForecastPanels('climb')).toEqual(['rain-shine']);
    expect(defaultForecastPanels('hike')).toEqual(['rain-shine']);
    expect(defaultForecastPanels(undefined)).toEqual(['rain-shine']);
    expect(defaultForecastPanels(null)).toEqual(['rain-shine']);
  });

  it('never defaults Meteo — opt-in only, no activity resolves to it', () => {
    for (const id of ['kayak', 'wingfoil', 'surf', 'run', 'speedflying', '']) {
      expect(defaultForecastPanels(id)).not.toContain('meteo');
    }
  });
});
