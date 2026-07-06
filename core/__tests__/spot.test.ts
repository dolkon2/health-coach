/**
 * Spot helper tests. The entity itself is a thin bag of facts; the honesty
 * surface worth proving is the meta accessor: an unrecorded membership
 * requirement is `undefined`, never fabricated into false.
 */
import { describe, it, expect } from '@jest/globals';
import { spotRequiresUshpaMembership, type Spot } from '@core/spot';

function site(meta?: Record<string, unknown>): Spot {
  return {
    id: 's-1',
    name: 'Cliffside',
    lat: 45.66,
    lng: -121.55,
    kind: 'flying-site',
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
