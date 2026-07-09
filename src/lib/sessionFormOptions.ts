/**
 * sessionFormOptions.ts — shared chip-option arrays for session and template forms.
 *
 * Both the log-session screen (actual sessions) and the edit-template screen
 * (saved shapes) need the same value lists for movement patterns, energy
 * systems, climbing styles, swim modes/strokes. Defining them once here means
 * "add a new pattern" or "rename a style" is one edit, not two.
 */
import type { ChipOption } from '@/components';
import type { ClimbOutcome, EnergySystem, MovementPattern, SwimStroke } from '@core/observation';
import type { ClimbStyle, SwimMode } from '@/lib/session';

export const PATTERNS: ChipOption<MovementPattern>[] = [
  { value: 'upper-push', label: 'Upper push' },
  { value: 'upper-pull', label: 'Upper pull' },
  { value: 'hip-hinge', label: 'Hip hinge' },
  { value: 'quad-dom', label: 'Quad dom' },
  { value: 'core', label: 'Core' },
  { value: 'carry', label: 'Carry' },
  { value: 'rotation', label: 'Rotation' },
  { value: 'unilateral-leg', label: 'Unilat leg' },
  { value: 'isolation', label: 'Isolation' },
  { value: 'other', label: 'Other' },
];

export const ENERGY_SYSTEMS: ChipOption<EnergySystem>[] = [
  { value: 'aerobic', label: 'Aerobic' },
  { value: 'glycolytic', label: 'Glycolytic' },
  { value: 'mixed', label: 'Mixed' },
];

export const CLIMB_STYLES: ChipOption<ClimbStyle>[] = [
  { value: 'boulder', label: 'Boulder' },
  { value: 'sport', label: 'Sport' },
  { value: 'top-rope', label: 'Top rope' },
  { value: 'trad', label: 'Trad' },
];

// Independent of style — you can boulder or sport climb either place (⚑ E-17).
export const CLIMB_LOCATIONS: ChipOption<'indoor' | 'outdoor'>[] = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
];

export const CLIMB_OUTCOMES: ChipOption<ClimbOutcome>[] = [
  { value: 'attempt', label: 'Attempt' },
  { value: 'redpoint', label: 'Redpoint' },
  { value: 'flash', label: 'Flash' },
  { value: 'onsight', label: 'Onsight' },
  { value: 'pinkpoint', label: 'Pinkpoint' },
  { value: 'fell-hung', label: 'Fell/hung' },
];

export const SWIM_MODES: ChipOption<SwimMode>[] = [
  { value: 'pool', label: 'Pool' },
  { value: 'open', label: 'Open water' },
];

export const SWIM_STROKES: ChipOption<SwimStroke>[] = [
  { value: 'freestyle', label: 'Free' },
  { value: 'breaststroke', label: 'Breast' },
  { value: 'backstroke', label: 'Back' },
  { value: 'butterfly', label: 'Fly' },
  { value: 'medley', label: 'Medley' },
  { value: 'mixed', label: 'Mixed' },
];

/** 1–10 effort scale chips, shared between log (RPE) and any future template use. */
export const EFFORT: ChipOption<number>[] = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

/** 0–6 day-of-week chips for the template editor's optional dayAssignment. */
export const DAYS_OF_WEEK: ChipOption<number>[] = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];
