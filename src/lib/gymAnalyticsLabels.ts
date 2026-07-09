/**
 * gymAnalyticsLabels.ts — display copy for core/gymAnalytics.ts's
 * MuscleGroup and PrFlag vocabularies. Kept out of core (display strings
 * aren't engine math) and out of the screen files (shared between
 * training-progress.tsx and lift-detail.tsx).
 */
import type { MuscleGroup, PrFlag } from '@core/gymAnalytics';

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  lowerBack: 'Lower back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Core',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductorsAbductors: 'Adductors/abductors',
  calves: 'Calves',
  neck: 'Neck',
};

/** Descriptive labels per PR kind — a reps-at-weight or set-volume PR is a
 *  distinct fact from an e1RM PR and must never be relabeled as one. */
export const PR_KIND_LABELS: Record<PrFlag['kind'], string> = {
  e1rm: 'e1RM',
  repsAtWeight: 'reps at this weight',
  setVolume: 'set volume',
};
