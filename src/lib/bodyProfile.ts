/**
 * bodyProfile.ts — pure form logic for the body-stats profile (expenditure
 * build, Pass B). Mirrors benchmarkForm.ts: no React, no storage, no LLM, so
 * the screen and the tests drive the same path.
 *
 * The profile exists for exactly one consumer: the cold-start baseline TDEE
 * (core/baselineTdee.ts) — the labeled-weak predicted number that measurement
 * replaces. Weight is deliberately NOT a profile field: it comes from logged
 * weigh-ins (the trend), never a second form that can go stale. Birth year is
 * stored instead of age so the profile never drifts; age is derived at read
 * time as a calendar-year approximation (±1 year ≈ ±5 BMR kcal — noise next
 * to the prediction band, documented).
 *
 * `activityLevel` is Route 1 (locked): the user's own "how active are you,
 * typically?" — a transparent placeholder with honest descriptions, never
 * derived from logged training (training data never predicts burn).
 */
import type { ActivityLevel, BodyMetrics, Sex } from '@core/baselineTdee';

export type BodyProfile = {
  heightCm: number;
  birthYear: number;
  sex: Sex;
  bodyFatPct?: number; // absent ≠ 0 — omitted entirely when not given
  activityLevel: ActivityLevel;
};

export type HeightUnit = 'cm' | 'ftin';

/** Raw form state — numeric fields are strings (TextInput values), parsed at build. */
export type BodyProfileForm = {
  heightUnit: HeightUnit;
  heightCm: string; // cm mode
  heightFt: string; // ft/in mode
  heightIn: string;
  birthYear: string;
  sex: Sex | null;
  bodyFatPct: string; // optional; blank = not given
  activityLevel: ActivityLevel | null;
};

export function emptyBodyProfileForm(heightUnit: HeightUnit = 'cm'): BodyProfileForm {
  return {
    heightUnit,
    heightCm: '',
    heightFt: '',
    heightIn: '',
    birthYear: '',
    sex: null,
    bodyFatPct: '',
    activityLevel: null,
  };
}

const CM_PER_FT = 30.48;
const CM_PER_IN = 2.54;
const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Height in cm from whichever unit the form is in; null when unparseable. */
export function parseHeightCm(form: BodyProfileForm): number | null {
  if (form.heightUnit === 'cm') {
    const cm = parseFloat(form.heightCm);
    return Number.isFinite(cm) && cm > 0 ? round1(cm) : null;
  }
  const ft = parseFloat(form.heightFt);
  const inches = form.heightIn.trim() === '' ? 0 : parseFloat(form.heightIn);
  if (!Number.isFinite(ft) || ft <= 0 || !Number.isFinite(inches) || inches < 0) return null;
  return round1(ft * CM_PER_FT + inches * CM_PER_IN);
}

/** cm → whole feet + rounded inches, for prefilling the ft/in fields. */
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - ft * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ft, inches };
}

/** Age as the calendar-year difference — a documented ±1-year approximation. */
export function ageFrom(birthYear: number, nowYear: number): number {
  return nowYear - birthYear;
}

/** Route-1 activity self-report: five levels, described in plain terms so the
 *  guess is transparent. The copy describes a life, never grades one. */
export const ACTIVITY_OPTIONS: ReadonlyArray<{
  value: ActivityLevel;
  label: string;
  detail: string;
}> = [
  { value: 'sedentary', label: 'Sedentary', detail: 'Mostly sitting; little planned movement.' },
  { value: 'light', label: 'Light', detail: 'On your feet part of the day, or 1–3 easy sessions a week.' },
  { value: 'moderate', label: 'Moderate', detail: 'Training 3–5 days a week.' },
  { value: 'active', label: 'Active', detail: 'Hard training most days, or a physical job.' },
  { value: 'veryActive', label: 'Very active', detail: 'Heavy daily training plus a physical job.' },
];

/** Plausibility bounds — generous; they catch typos, not people. */
const HEIGHT_CM_MIN = 90;
const HEIGHT_CM_MAX = 250;
const MAX_AGE_YEARS = 120;

/** Null when valid; otherwise a short, user-facing reason. */
export function validateBodyProfileForm(form: BodyProfileForm, nowYear: number): string | null {
  const heightCm = parseHeightCm(form);
  if (heightCm == null) return 'Enter your height.';
  if (heightCm < HEIGHT_CM_MIN || heightCm > HEIGHT_CM_MAX) return 'Enter a valid height.';

  const year = parseInt(form.birthYear, 10);
  if (!Number.isFinite(year) || form.birthYear.trim().length !== 4) return 'Enter your birth year.';
  if (year >= nowYear || year < nowYear - MAX_AGE_YEARS) return 'Enter a valid birth year.';

  if (form.sex == null) return 'Pick which formula sex applies.';

  if (form.bodyFatPct.trim() !== '') {
    const bf = parseFloat(form.bodyFatPct);
    if (!Number.isFinite(bf) || bf <= 0 || bf >= 100) {
      return 'Body fat should be between 0 and 100 — or leave it blank.';
    }
  }

  if (form.activityLevel == null) return 'Pick how active you typically are.';
  return null;
}

/** The profile to persist, built from a validated form. Throws on an invalid
 *  form — the screen validates first (mirrors buildBenchmarkFields). */
export function buildBodyProfile(form: BodyProfileForm, nowYear: number): BodyProfile {
  const reason = validateBodyProfileForm(form, nowYear);
  if (reason) throw new Error(`buildBodyProfile: ${reason}`);
  const bodyFat = form.bodyFatPct.trim() === '' ? undefined : parseFloat(form.bodyFatPct);
  return {
    heightCm: parseHeightCm(form)!,
    birthYear: parseInt(form.birthYear, 10),
    sex: form.sex!,
    ...(bodyFat != null ? { bodyFatPct: bodyFat } : {}),
    activityLevel: form.activityLevel!,
  };
}

/** Hydrate the form from a saved profile (edit mode). Both height
 *  representations are prefilled so a unit toggle needs no re-entry. */
export function formFromProfile(profile: BodyProfile, heightUnit: HeightUnit = 'cm'): BodyProfileForm {
  const { ft, inches } = cmToFtIn(profile.heightCm);
  return {
    heightUnit,
    heightCm: String(profile.heightCm),
    heightFt: String(ft),
    heightIn: String(inches),
    birthYear: String(profile.birthYear),
    sex: profile.sex,
    bodyFatPct: profile.bodyFatPct != null ? String(profile.bodyFatPct) : '',
    activityLevel: profile.activityLevel,
  };
}

/** Marry the stored profile to a *measured* weight (the trend's latest point —
 *  weight is never a profile field) for the baseline engine. */
export function metricsFrom(profile: BodyProfile, weightKg: number, nowYear: number): BodyMetrics {
  return {
    heightCm: profile.heightCm,
    age: ageFrom(profile.birthYear, nowYear),
    sex: profile.sex,
    weightKg,
    ...(profile.bodyFatPct != null ? { bodyFatPct: profile.bodyFatPct } : {}),
  };
}
