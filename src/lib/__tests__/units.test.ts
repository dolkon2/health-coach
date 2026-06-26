import { describe, it, expect } from '@jest/globals';
import { kgToDisplay, displayToKg, formatWeight, formatDelta } from '../units';

describe('units', () => {
  it('round-trips kg <-> lb without drift', () => {
    const kg = 78.3;
    const lb = kgToDisplay(kg, 'lb');
    expect(displayToKg(lb, 'lb')).toBeCloseTo(kg, 6);
  });

  it('kg is identity', () => {
    expect(kgToDisplay(80, 'kg')).toBe(80);
    expect(displayToKg(80, 'kg')).toBe(80);
  });

  it('formats weight to one decimal with unit', () => {
    expect(formatWeight(78.3, 'lb')).toBe('172.6 lb');
    expect(formatWeight(78.3, 'kg')).toBe('78.3 kg');
  });

  it('formats a downward delta with a down arrow', () => {
    expect(formatDelta(-0.45, 'kg')).toBe('↓ 0.5 kg');
    expect(formatDelta(0.45, 'kg')).toBe('↑ 0.5 kg');
  });
});
