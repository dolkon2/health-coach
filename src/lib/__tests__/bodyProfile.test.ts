/**
 * Body-profile form tests (expenditure build, Pass B). Proof:
 *   - height parses in both units and round-trips through ft/in;
 *   - validation catches each missing/invalid field with a user-facing reason;
 *   - build → hydrate is an inverse (a saved profile re-opens as the same form);
 *   - age comes from birth year (calendar approximation, documented).
 */
import { describe, it, expect } from '@jest/globals';
import {
  emptyBodyProfileForm,
  parseHeightCm,
  cmToFtIn,
  ageFrom,
  validateBodyProfileForm,
  buildBodyProfile,
  formFromProfile,
  metricsFrom,
  ACTIVITY_OPTIONS,
  type BodyProfile,
} from '@/lib/bodyProfile';

const NOW_YEAR = 2026;

function completeForm() {
  const f = emptyBodyProfileForm();
  f.heightUnit = 'cm';
  f.heightCm = '180';
  f.birthYear = '1996';
  f.sex = 'male';
  f.activityLevel = 'moderate';
  return f;
}

describe('height parsing', () => {
  it('parses cm directly', () => {
    const f = completeForm();
    expect(parseHeightCm(f)).toBe(180);
  });

  it('parses ft/in and converts (5\'11" ≈ 180.3 cm)', () => {
    const f = completeForm();
    f.heightUnit = 'ftin';
    f.heightFt = '5';
    f.heightIn = '11';
    expect(parseHeightCm(f)).toBeCloseTo(180.3, 1);
  });

  it('treats blank inches as 0 (6\'0" = 182.9 cm)', () => {
    const f = completeForm();
    f.heightUnit = 'ftin';
    f.heightFt = '6';
    f.heightIn = '';
    expect(parseHeightCm(f)).toBeCloseTo(182.9, 1);
  });

  it('round-trips cm → ft/in → cm within half an inch', () => {
    for (const cm of [150, 165, 180, 200]) {
      const { ft, inches } = cmToFtIn(cm);
      const back = ft * 30.48 + inches * 2.54;
      expect(Math.abs(back - cm)).toBeLessThan(1.27);
    }
  });
});

describe('validation (user-facing reasons)', () => {
  it('passes a complete form', () => {
    expect(validateBodyProfileForm(completeForm(), NOW_YEAR)).toBeNull();
  });

  it('catches each missing field', () => {
    const noHeight = { ...completeForm(), heightCm: '' };
    expect(validateBodyProfileForm(noHeight, NOW_YEAR)).toMatch(/height/i);

    const noYear = { ...completeForm(), birthYear: '' };
    expect(validateBodyProfileForm(noYear, NOW_YEAR)).toMatch(/birth year/i);

    const noSex = { ...completeForm(), sex: null };
    expect(validateBodyProfileForm(noSex, NOW_YEAR)).not.toBeNull();

    const noActivity = { ...completeForm(), activityLevel: null };
    expect(validateBodyProfileForm(noActivity, NOW_YEAR)).toMatch(/active/i);
  });

  it('rejects an implausible height or birth year', () => {
    expect(validateBodyProfileForm({ ...completeForm(), heightCm: '30' }, NOW_YEAR)).not.toBeNull();
    expect(
      validateBodyProfileForm({ ...completeForm(), birthYear: String(NOW_YEAR + 1) }, NOW_YEAR)
    ).not.toBeNull();
    expect(
      validateBodyProfileForm({ ...completeForm(), birthYear: '1850' }, NOW_YEAR)
    ).not.toBeNull();
  });

  it('bodyfat is optional, but a nonsense value is rejected', () => {
    expect(validateBodyProfileForm({ ...completeForm(), bodyFatPct: '' }, NOW_YEAR)).toBeNull();
    expect(validateBodyProfileForm({ ...completeForm(), bodyFatPct: '20' }, NOW_YEAR)).toBeNull();
    expect(
      validateBodyProfileForm({ ...completeForm(), bodyFatPct: '120' }, NOW_YEAR)
    ).not.toBeNull();
    expect(
      validateBodyProfileForm({ ...completeForm(), bodyFatPct: '0' }, NOW_YEAR)
    ).not.toBeNull();
  });
});

describe('build ↔ hydrate', () => {
  it('builds a profile and hydrates it back to an equivalent form', () => {
    const form = completeForm();
    form.bodyFatPct = '18.5';
    const profile = buildBodyProfile(form, NOW_YEAR);
    expect(profile).toEqual({
      heightCm: 180,
      birthYear: 1996,
      sex: 'male',
      bodyFatPct: 18.5,
      activityLevel: 'moderate',
    });

    const back = formFromProfile(profile);
    expect(parseHeightCm(back)).toBe(180);
    expect(back.birthYear).toBe('1996');
    expect(back.sex).toBe('male');
    expect(back.bodyFatPct).toBe('18.5');
    expect(back.activityLevel).toBe('moderate');
    // Both height representations are prefilled so a unit toggle needs no re-entry.
    expect(back.heightFt).not.toBe('');
  });

  it('omits bodyfat when blank (absent ≠ 0)', () => {
    const profile = buildBodyProfile(completeForm(), NOW_YEAR);
    expect('bodyFatPct' in profile).toBe(false);
  });

  it('throws on an invalid form (screen validates first)', () => {
    expect(() => buildBodyProfile({ ...completeForm(), sex: null }, NOW_YEAR)).toThrow();
  });
});

describe('engine assembly', () => {
  it('ageFrom is the calendar-year difference', () => {
    expect(ageFrom(1996, 2026)).toBe(30);
  });

  it('metricsFrom marries the stored profile to a measured weight', () => {
    const profile: BodyProfile = {
      heightCm: 180,
      birthYear: 1996,
      sex: 'male',
      activityLevel: 'moderate',
    };
    expect(metricsFrom(profile, 80, NOW_YEAR)).toEqual({
      heightCm: 180,
      age: 30,
      sex: 'male',
      weightKg: 80,
    });
  });

  it('offers all five activity levels with transparent descriptions', () => {
    expect(ACTIVITY_OPTIONS).toHaveLength(5);
    for (const opt of ACTIVITY_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.detail.length).toBeGreaterThan(0);
    }
  });
});
