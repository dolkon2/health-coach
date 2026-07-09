/**
 * importExerciseResolve.test.ts — Strong/Hevy name -> Free Exercise DB
 * resolution (Body P5): exact rewrite, alias table, Jaccard fuzzy match,
 * ambiguous/unmatched fallbacks.
 */
import { describe, expect, it } from '@jest/globals';
import { rewriteStrongHevyName, EXERCISE_ALIASES } from '../importAliases';
import { resolveExerciseName } from '../importExerciseResolve';
import { exerciseLibrary } from '@/data/exerciseLibrary';

describe('rewriteStrongHevyName', () => {
  it('moves parenthetical equipment to the front', () => {
    expect(rewriteStrongHevyName('Bench Press (Barbell)')).toBe('Barbell Bench Press');
    expect(rewriteStrongHevyName('Lat Pulldown (Cable)')).toBe('Cable Lat Pulldown');
  });

  it('passes through a name with no parenthetical unchanged', () => {
    expect(rewriteStrongHevyName('Push Up')).toBe('Push Up');
    expect(rewriteStrongHevyName('Plank')).toBe('Plank');
  });
});

describe('EXERCISE_ALIASES', () => {
  it('every alias target is an exact, real Free Exercise DB name', () => {
    const names = new Set(exerciseLibrary().map((e) => e.name));
    for (const [key, targetName] of Object.entries(EXERCISE_ALIASES)) {
      expect(names.has(targetName)).toBe(true);
      expect(key.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveExerciseName', () => {
  it('resolves an exact FEDB name via the mechanical rewrite (no alias needed)', () => {
    const r = resolveExerciseName('Squat (Barbell)');
    expect(r.status).toBe('exact');
    expect(r.exerciseId).toBe('Barbell_Squat');
  });

  it('resolves via the alias table when the mechanical rewrite misses', () => {
    const r = resolveExerciseName('Bench Press (Barbell)');
    expect(r.status).toBe('alias');
    expect(r.exerciseId).toBeDefined();
  });

  it('resolves a bodyweight exercise with no parenthetical', () => {
    const r = resolveExerciseName('Push Up');
    expect(['exact', 'alias', 'fuzzy']).toContain(r.status);
  });

  it('returns unmatched for a nonsense name, never a guess exerciseId', () => {
    const r = resolveExerciseName('Zorbotron Death Press (Exotic)');
    expect(r.status === 'unmatched' || r.status === 'ambiguous').toBe(true);
    expect(r.exerciseId).toBeUndefined();
    expect(r.movementPattern).toBe('other');
  });

  it('an unmatched/ambiguous exercise never blocks — pattern is always a valid value', () => {
    const r = resolveExerciseName('Completely Made Up Movement');
    expect(r.movementPattern).toBeTruthy();
  });
});
