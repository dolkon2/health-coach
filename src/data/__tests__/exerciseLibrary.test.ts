/**
 * exerciseLibrary.test.ts — integrity of the vendored Free Exercise DB and the
 * four vendor-time derivations (P2). These tests are the audit trail: if
 * upstream data or the derivation table drifts, they fail loudly.
 */
import { describe, expect, it } from '@jest/globals';

import {
  MUSCLE_PATTERN,
  NULL_EQUIPMENT_PATCH,
  REVIEWED,
  derivePattern,
  derivePickerScope,
  exerciseById,
  exerciseLibrary,
} from '@/data/exerciseLibrary';

const PATTERNS = [
  'upper-push',
  'upper-pull',
  'hip-hinge',
  'quad-dom',
  'core',
  'carry',
  'rotation',
  'unilateral-leg',
  'isolation',
  'other',
];

describe('exerciseLibrary — vendored dataset integrity', () => {
  const lib = exerciseLibrary();

  it('carries exactly 873 exercises with unique ids', () => {
    expect(lib).toHaveLength(873);
    expect(new Set(lib.map((e) => e.id)).size).toBe(873);
  });

  it('patched exactly the 14 null-equipment strength/plyo rows to body only', () => {
    expect(NULL_EQUIPMENT_PATCH).toHaveLength(14);
    for (const id of NULL_EQUIPMENT_PATCH) {
      const e = exerciseById(id);
      expect(e).toBeDefined();
      expect(e?.equipment).toBe('body only');
      expect(['strength', 'plyometrics']).toContain(e?.category);
    }
    // No OTHER strength/plyo row is left with null equipment.
    const stillNull = lib.filter(
      (e) => e.equipment == null && (e.category === 'strength' || e.category === 'plyometrics'),
    );
    expect(stillNull).toHaveLength(0);
  });

  it('gives every exercise a movementPattern from the engine union', () => {
    for (const e of lib) expect(PATTERNS).toContain(e.movementPattern);
  });

  it('gives every exercise an intentional pickerScope', () => {
    for (const e of lib) {
      expect(['gym', 'calisthenics', 'both', 'hidden']).toContain(e.pickerScope);
    }
  });

  it('hides exactly the stretching + cardio rows (SMR included)', () => {
    const hidden = lib.filter((e) => e.pickerScope === 'hidden');
    const stretchingOrCardio = lib.filter(
      (e) => e.category === 'stretching' || e.category === 'cardio',
    );
    expect(hidden.length).toBe(stretchingOrCardio.length);
    expect(hidden.length).toBe(137); // 123 stretching + 14 cardio at vendor time
    // The 13 -SMR rows all fall inside the hidden set.
    const smr = lib.filter((e) => e.id.endsWith('-SMR'));
    expect(smr).toHaveLength(13);
    for (const e of smr) expect(e.pickerScope).toBe('hidden');
  });

  it("keeps 'other'-equipment strength rows in the gym picker deliberately", () => {
    const otherStrength = lib.filter(
      (e) => e.equipment === 'other' && e.category === 'strength',
    );
    expect(otherStrength.length).toBeGreaterThan(0);
    for (const e of otherStrength) expect(e.pickerScope).toBe('gym');
  });

  it('puts body-only non-hidden rows in both pickers', () => {
    const bodyOnly = lib.filter(
      (e) => e.equipment === 'body only' && e.pickerScope !== 'hidden',
    );
    expect(bodyOnly.length).toBeGreaterThan(0);
    for (const e of bodyOnly) expect(e.pickerScope).toBe('both');
  });
});

describe('exerciseLibrary — pattern derivation table', () => {
  it('maps the full 17-muscle upstream vocabulary (no unmapped muscle)', () => {
    const muscles = new Set(exerciseLibrary().flatMap((e) => e.primaryMuscles));
    for (const m of muscles) expect(MUSCLE_PATTERN[m]).toBeDefined();
    expect(Object.keys(MUSCLE_PATTERN)).toHaveLength(17);
  });

  it("derives 'other' when mechanic AND force are both null — never a guess", () => {
    expect(derivePattern(null, null, ['chest'])).toBe('other');
    const bothNull = exerciseLibrary().filter(
      (e) => e.mechanic == null && e.force == null && !e.patternReviewed,
    );
    for (const e of bothNull) expect(e.movementPattern).toBe('other');
  });

  it('applies the documented rules on known shapes', () => {
    expect(derivePattern('isolation', 'pull', ['biceps'])).toBe('isolation'); // rule 3
    expect(derivePattern('compound', 'push', ['quadriceps'])).toBe('quad-dom');
    expect(derivePattern('compound', 'pull', ['lower back'])).toBe('hip-hinge');
    expect(derivePattern('compound', 'push', ['shoulders'])).toBe('upper-push'); // byForce
    expect(derivePattern('compound', 'pull', ['shoulders'])).toBe('upper-pull'); // byForce
    expect(derivePattern('compound', 'pull', ['chest'])).toBe('upper-pull'); // rule 5 flip
  });

  it('scope rules: stretching/cardio hidden, body-only both, rest gym', () => {
    expect(derivePickerScope('stretching', 'foam roll')).toBe('hidden');
    expect(derivePickerScope('cardio', null)).toBe('hidden');
    expect(derivePickerScope('strength', 'body only')).toBe('both');
    expect(derivePickerScope('strength', 'other')).toBe('gym');
    expect(derivePickerScope('powerlifting', 'barbell')).toBe('gym');
  });
});

describe('exerciseLibrary — hand-review pass', () => {
  it('every reviewed id exists in the dataset', () => {
    for (const id of Object.keys(REVIEWED)) {
      expect(exerciseById(id)).toBeDefined();
    }
  });

  it('reviewed entries auto-fill their reviewed pattern', () => {
    expect(exerciseById('Barbell_Squat')).toMatchObject({
      movementPattern: 'quad-dom',
      patternReviewed: true,
    });
    expect(exerciseById('Barbell_Lunge')).toMatchObject({
      movementPattern: 'unilateral-leg', // corrects the table's quad-dom
      patternReviewed: true,
    });
    expect(exerciseById('Russian_Twist')).toMatchObject({
      movementPattern: 'rotation', // corrects the table's core
      patternReviewed: true,
    });
    expect(exerciseById('Farmers_Walk')).toMatchObject({
      movementPattern: 'carry',
      patternReviewed: true,
    });
  });

  it('unreviewed entries stay marked for visible-editable prefill', () => {
    const unreviewed = exerciseLibrary().filter((e) => !e.patternReviewed);
    expect(unreviewed.length).toBe(873 - Object.keys(REVIEWED).length);
    expect(Object.keys(REVIEWED).length).toBeGreaterThanOrEqual(100); // the ~100 promise
  });

  it("seeds entryType 'duration' from force static + review, reps stays absent", () => {
    expect(exerciseById('Plank')?.entryType).toBe('duration');
    expect(exerciseById('Side_Bridge')?.entryType).toBe('duration');
    expect(exerciseById('Isometric_Chest_Squeezes')?.entryType).toBe('duration'); // via static
    expect(exerciseById('Barbell_Squat')?.entryType).toBeUndefined(); // reps = default
  });
});
