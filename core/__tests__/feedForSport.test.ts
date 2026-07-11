/**
 * feedForSport tests — gauge/wind/swell family membership, weather-only
 * fallback, and the untagged/absent-sport case.
 */
import { describe, it, expect } from '@jest/globals';
import { feedForSport } from '@core/conditions/feedForSport';

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
