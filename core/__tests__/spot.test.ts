/**
 * Spot helper tests. The entity itself is a thin bag of facts; the honesty
 * surface worth proving is the meta accessor: an unrecorded membership
 * requirement is `undefined`, never fabricated into false.
 */
import { describe, it, expect } from '@jest/globals';
import { spotRequiresUshpaMembership, spotForecastPanels, type Spot } from '@core/spot';

function site(meta?: Record<string, unknown>, sport?: string): Spot {
  return {
    id: 's-1',
    name: 'Cliffside',
    lat: 45.66,
    lng: -121.55,
    kind: 'flying-site',
    ...(sport !== undefined ? { sport } : {}),
    ...(meta !== undefined ? { meta } : {}),
  };
}

describe('spotRequiresUshpaMembership', () => {
  it('returns true when recorded true', () => {
    expect(spotRequiresUshpaMembership(site({ requiresMembership: true }))).toBe(true);
  });

  it('returns false when recorded false — a recorded "no" is a fact', () => {
    expect(spotRequiresUshpaMembership(site({ requiresMembership: false }))).toBe(false);
  });

  it('returns undefined when the spot has no meta at all', () => {
    expect(spotRequiresUshpaMembership(site())).toBeUndefined();
  });

  it('returns undefined when meta exists but the fact was never recorded', () => {
    expect(spotRequiresUshpaMembership(site({ ushpaAffiliated: true }))).toBeUndefined();
  });

  it('returns undefined for a non-boolean value — never coerced into an answer', () => {
    expect(spotRequiresUshpaMembership(site({ requiresMembership: 'yes' }))).toBeUndefined();
  });
});

describe('spotForecastPanels', () => {
  it('returns the recorded panel set when present, overriding the sport default', () => {
    expect(
      spotForecastPanels(site({ forecastPanels: ['meteo', 'wind'] }, 'paragliding'))
    ).toEqual(['meteo', 'wind']);
  });

  it('falls back to the sport-derived default when unrecorded — never "unknown"', () => {
    expect(spotForecastPanels(site(undefined, 'kayak'))).toEqual(['gauge']);
    expect(spotForecastPanels(site(undefined, 'wingfoil'))).toEqual(['wind']);
    expect(spotForecastPanels(site())).toEqual(['rain-shine']); // untagged
  });

  it('falls back to the default when meta exists but forecastPanels was never set', () => {
    expect(spotForecastPanels(site({ requiresMembership: true }, 'hike'))).toEqual(['rain-shine']);
  });

  it('falls back to the default for a malformed (non-string-array) recorded value', () => {
    expect(spotForecastPanels(site({ forecastPanels: 'wind' }, 'kayak'))).toEqual(['gauge']);
    expect(spotForecastPanels(site({ forecastPanels: [] }, 'kayak'))).toEqual(['gauge']);
    expect(spotForecastPanels(site({ forecastPanels: [1, 2] }, 'kayak'))).toEqual(['gauge']);
  });
});
