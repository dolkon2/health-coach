/**
 * exercisePicker.test.ts — P3 library query layer: normalization, the two
 * picker datasets (gym vs calisthenics), prefix-over-substring ranking, and
 * the ladder-step pattern assignments the picker autofills from.
 */
import { describe, expect, it } from '@jest/globals';

import {
  CHAIN_PATTERN,
  STEP_PATTERN_OVERRIDES,
  calisthenicsPickerEntries,
  gymPickerEntries,
  normalizeExerciseName,
  pickerEntriesForActivity,
  pickerEntryById,
  searchExercises,
} from '../exercisePicker';
import { exerciseLibrary } from '@/data/exerciseLibrary';
import { ladderChains } from '@/data/ladders';

describe('normalizeExerciseName', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeExerciseName('  Pull-Up ')).toBe('pull up');
    expect(normalizeExerciseName('Barbell Bench Press - Medium Grip')).toBe(
      'barbell bench press medium grip'
    );
    expect(normalizeExerciseName('3/4  Sit-Up!')).toBe('3 4 sit up');
    expect(normalizeExerciseName('')).toBe('');
  });
});

describe('picker datasets', () => {
  it('gym = library scoped gym|both, hidden rows never listed', () => {
    const gym = gymPickerEntries();
    const expected = exerciseLibrary().filter(
      (e) => e.pickerScope === 'gym' || e.pickerScope === 'both'
    );
    expect(gym).toHaveLength(expected.length);
    expect(gym.some((e) => e.id === 'Barbell_Squat')).toBe(true);
    // A stretching row is hidden — not set-loggable in any picker.
    expect(gym.some((e) => e.id === 'Ankle_Circles')).toBe(false);
    expect(gym.every((e) => e.source === 'library')).toBe(true);
  });

  it('calisthenics = all 71 ladder steps first, then body-only library rows', () => {
    const cali = calisthenicsPickerEntries();
    const stepCount = ladderChains().reduce((n, c) => n + c.steps.length, 0);
    expect(cali.slice(0, stepCount).every((e) => e.source === 'ladder')).toBe(true);
    // Barbell work is gym-only; bodyweight strength appears in both datasets.
    expect(cali.some((e) => e.id === 'Barbell_Squat')).toBe(false);
    expect(cali.some((e) => e.id === 'Pushups')).toBe(true);
    expect(gymPickerEntries().some((e) => e.id === 'Pushups')).toBe(true);
  });

  it('only the calisthenics identity gets the ladder dataset', () => {
    expect(pickerEntriesForActivity('calisthenics')).toBe(calisthenicsPickerEntries());
    expect(pickerEntriesForActivity('gym')).toBe(gymPickerEntries());
    expect(pickerEntriesForActivity(undefined)).toBe(gymPickerEntries());
  });

  it('ladder entries carry entryType from setType and a hand-assigned pattern', () => {
    const tuckLever = pickerEntryById('front-lever-tuck');
    expect(tuckLever).toMatchObject({
      source: 'ladder',
      chainId: 'front-lever-line',
      entryType: 'duration',
      movementPattern: 'upper-pull',
      patternReviewed: true,
    });
    const weightedDip = pickerEntryById('dip-weighted');
    expect(weightedDip).toMatchObject({ entryType: 'reps', movementPattern: 'upper-push' });
    // Single-leg steps override their chain's pattern.
    expect(pickerEntryById('squat-shrimp-advanced')?.movementPattern).toBe('unilateral-leg');
    expect(pickerEntryById('squat-full')?.movementPattern).toBe('quad-dom');
  });

  it('every chain has a pattern and every override targets a real step', () => {
    const chainIds = new Set(ladderChains().map((c) => c.id));
    const stepIds = new Set(ladderChains().flatMap((c) => c.steps.map((s) => s.id)));
    for (const id of chainIds) expect(CHAIN_PATTERN[id]).toBeDefined();
    for (const id of Object.keys(STEP_PATTERN_OVERRIDES)) expect(stepIds.has(id)).toBe(true);
  });

  it('pickerEntryById resolves both id namespaces', () => {
    expect(pickerEntryById('Barbell_Squat')?.source).toBe('library');
    expect(pickerEntryById('lsit-tuck')?.source).toBe('ladder');
    expect(pickerEntryById('nope')).toBeUndefined();
  });
});

describe('searchExercises', () => {
  it('matches through punctuation differences (normalized both sides)', () => {
    const hits = searchExercises(gymPickerEntries(), 'bench press', 50);
    expect(hits.some((e) => e.id === 'Barbell_Bench_Press_-_Medium_Grip')).toBe(true);
  });

  it('ranks prefix matches above substring matches', () => {
    const hits = searchExercises(gymPickerEntries(), 'squat', 200);
    expect(hits.length).toBeGreaterThan(0);
    const firstSubstring = hits.findIndex((e) => !e.normName.startsWith('squat'));
    if (firstSubstring >= 0) {
      // Once the substring band starts, no prefix match may follow it.
      for (let i = firstSubstring; i < hits.length; i++) {
        expect(hits[i].normName.startsWith('squat')).toBe(false);
      }
    }
  });

  it('empty or whitespace query returns nothing, never the full list', () => {
    expect(searchExercises(gymPickerEntries(), '')).toHaveLength(0);
    expect(searchExercises(gymPickerEntries(), '   ')).toHaveLength(0);
  });

  it('respects the limit', () => {
    expect(searchExercises(gymPickerEntries(), 'press', 3)).toHaveLength(3);
  });

  it('finds ladder steps in the calisthenics dataset, prefix first', () => {
    const hits = searchExercises(calisthenicsPickerEntries(), 'front lever', 10);
    const ladderHits = hits.filter((e) => e.source === 'ladder');
    // "Front lever" (the anchor) prefix-matches; the tuck/straddle steps are
    // substring matches and follow in progression order.
    expect(ladderHits[0]?.id).toBe('front-lever-full');
    expect(ladderHits.map((e) => e.id)).toContain('front-lever-tuck');
    expect(ladderHits.every((e) => e.chainId === 'front-lever-line')).toBe(true);
  });
});
