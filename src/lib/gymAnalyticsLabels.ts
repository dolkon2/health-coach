/**
 * gymAnalyticsLabels.ts — display copy for core/gymAnalytics.ts's
 * MuscleGroup vocabulary. Kept out of core (display strings aren't engine
 * math) and out of the screen files (shared between training-progress.tsx
 * and any future tonnage surface).
 */
import type { MuscleGroup } from '@core/gymAnalytics';

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
