/**
 * describeTemplateShape — a one-line, descriptive (never prescriptive)
 * summary of a SessionTemplate's shape ("3 exercises", "5 km · aerobic").
 * Extracted out of the Training tab's inline library section (rework
 * Session 4) so `TemplateCard` renders it from one shared source.
 */
import type {
  SessionTemplate,
  GymTemplateShape,
  GpsTemplateShape,
  PracticeTemplateShape,
  ClimbingTemplateShape,
  SwimTemplateShape,
} from '@core/sessionTemplate';

export function describeTemplateShape(t: SessionTemplate): string {
  switch (t.shape.surface) {
    case 'gym': {
      const s = t.shape as GymTemplateShape;
      const n = s.exercises.length;
      return n === 1 ? '1 exercise' : `${n} exercises`;
    }
    case 'gps': {
      const s = t.shape as GpsTemplateShape;
      if (s.targetDistanceM != null) {
        const km = (s.targetDistanceM / 1000).toFixed(s.targetDistanceM % 1000 === 0 ? 0 : 1);
        return `${km} km · ${s.energySystem}`;
      }
      return s.energySystem;
    }
    case 'practice': {
      const s = t.shape as PracticeTemplateShape;
      const parts = [s.targetDurationMin != null ? `${s.targetDurationMin} min` : null, s.style];
      return parts.filter(Boolean).join(' · ') || 'practice';
    }
    case 'climbing': {
      const s = t.shape as ClimbingTemplateShape;
      const parts = [s.style, s.targetGradeRange, s.targetSends != null ? `${s.targetSends} sends` : null];
      return parts.filter(Boolean).join(' · ');
    }
    case 'swim': {
      const s = t.shape as SwimTemplateShape;
      if (s.mode === 'pool' && s.poolLengthM != null && s.targetLaps != null) {
        return `${s.targetLaps} × ${s.poolLengthM} m`;
      }
      if (s.targetDistanceM != null) {
        return `${s.targetDistanceM} m`;
      }
      return s.mode;
    }
  }
}
