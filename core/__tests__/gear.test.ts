/**
 * Gear pure helpers — active-at-instant, repack due-date math, and the honest
 * wing-hours total (undefined when nothing is known, never a fabricated 0).
 */
import { describe, it, expect } from '@jest/globals';
import {
  gearIsActive,
  repackDueAt,
  wingTotalHours,
  type GearItem,
  type ReserveSpec,
  type WingSpec,
} from '@core/gear';

function wing(overrides: Partial<GearItem> = {}): GearItem {
  const spec: WingSpec = { category: 'wing', style: 'xc', sizeM2: 23, certClass: 'EN B' };
  return { id: 'g1', name: 'Rush 6', spec, ...overrides };
}

describe('gearIsActive', () => {
  it('treats an item with no lifecycle dates as active at any instant', () => {
    expect(gearIsActive(wing(), '2026-07-05T12:00:00Z')).toBe(true);
    expect(gearIsActive(wing(), '1999-01-01T00:00:00Z')).toBe(true);
  });

  it('is inactive before acquiredAt, active from acquiredAt on', () => {
    const item = wing({ acquiredAt: '2026-03-01' });
    expect(gearIsActive(item, '2026-02-28T23:00:00Z')).toBe(false);
    expect(gearIsActive(item, '2026-03-01T00:00:00Z')).toBe(true);
    expect(gearIsActive(item, '2026-07-05T12:00:00Z')).toBe(true);
  });

  it('is active before retiredAt, inactive at and after it', () => {
    const item = wing({ retiredAt: '2026-06-01T00:00:00Z' });
    expect(gearIsActive(item, '2026-05-31T23:59:59Z')).toBe(true);
    expect(gearIsActive(item, '2026-06-01T00:00:00Z')).toBe(false);
    expect(gearIsActive(item, '2026-07-05T12:00:00Z')).toBe(false);
  });

  it('handles both bounds together', () => {
    const item = wing({ acquiredAt: '2024-05-10', retiredAt: '2026-06-01' });
    expect(gearIsActive(item, '2024-05-09T12:00:00Z')).toBe(false);
    expect(gearIsActive(item, '2025-01-01T12:00:00Z')).toBe(true);
    expect(gearIsActive(item, '2026-06-02T12:00:00Z')).toBe(false);
  });

  it('compares date-only and full-instant strings consistently', () => {
    // 'YYYY-MM-DD' parses as UTC midnight — same instant as the explicit form.
    const item = wing({ acquiredAt: '2026-03-01' });
    expect(gearIsActive(item, '2026-03-01')).toBe(true);
  });
});

describe('repackDueAt', () => {
  it('returns undefined when lastRepackAt is missing', () => {
    const spec: ReserveSpec = { category: 'reserve', repackIntervalMonths: 6 };
    expect(repackDueAt(spec)).toBeUndefined();
  });

  it('returns undefined when the interval is missing — no default cadence', () => {
    const spec: ReserveSpec = { category: 'reserve', lastRepackAt: '2026-01-15' };
    expect(repackDueAt(spec)).toBeUndefined();
  });

  it('adds whole calendar months', () => {
    const spec: ReserveSpec = {
      category: 'reserve',
      lastRepackAt: '2026-01-15',
      repackIntervalMonths: 6,
    };
    expect(repackDueAt(spec)).toBe('2026-07-15');
  });

  it('rolls over the year', () => {
    const spec: ReserveSpec = {
      category: 'reserve',
      lastRepackAt: '2026-10-01',
      repackIntervalMonths: 6,
    };
    expect(repackDueAt(spec)).toBe('2027-04-01');
  });

  it('clamps to the end of a shorter target month instead of overflowing', () => {
    const spec: ReserveSpec = {
      category: 'reserve',
      lastRepackAt: '2026-01-31',
      repackIntervalMonths: 1,
    };
    expect(repackDueAt(spec)).toBe('2026-02-28');
  });

  it('clamps to Feb 29 in a leap year', () => {
    const spec: ReserveSpec = {
      category: 'reserve',
      lastRepackAt: '2023-11-30',
      repackIntervalMonths: 3,
    };
    expect(repackDueAt(spec)).toBe('2024-02-29');
  });

  it('accepts a full instant and still returns a plain date', () => {
    const spec: ReserveSpec = {
      category: 'reserve',
      lastRepackAt: '2026-01-15T10:30:00Z',
      repackIntervalMonths: 12,
    };
    expect(repackDueAt(spec)).toBe('2027-01-15');
  });

  it('returns undefined for an unparseable lastRepackAt', () => {
    const spec: ReserveSpec = {
      category: 'reserve',
      lastRepackAt: 'not-a-date',
      repackIntervalMonths: 6,
    };
    expect(repackDueAt(spec)).toBeUndefined();
  });
});

describe('wingTotalHours', () => {
  const specWith = (hoursBaseline?: number): WingSpec => ({
    category: 'wing',
    style: 'xc',
    ...(hoursBaseline !== undefined ? { hoursBaseline } : {}),
  });

  it('sums baseline and tracked hours', () => {
    expect(wingTotalHours(specWith(120), 30.5)).toBe(150.5);
  });

  it('is undefined with no baseline and nothing tracked — never a fabricated 0', () => {
    expect(wingTotalHours(specWith(undefined), 0)).toBeUndefined();
  });

  it('is a legitimate 0 only when the baseline is explicitly 0', () => {
    expect(wingTotalHours(specWith(0), 0)).toBe(0);
  });

  it('returns the tracked sum when no baseline is known — the known floor', () => {
    expect(wingTotalHours(specWith(undefined), 12)).toBe(12);
  });

  it('adds tracked hours onto an explicit zero baseline', () => {
    expect(wingTotalHours(specWith(0), 5)).toBe(5);
  });
});
