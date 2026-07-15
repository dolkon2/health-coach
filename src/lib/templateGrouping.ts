/**
 * templateGrouping — splits the template library into the three groups
 * Dylan settled on (rework-phase4-session-playbook.md R2, confirmed
 * 2026-07-14): a template with no `dayAssignment` was never slotted into a
 * program and reads as a "one-off" — the active/deactivated distinction is
 * meaningless for it (Dylan: "a gym routine you like to hit... neither
 * active or deactive because u dont program like that"). A template WITH a
 * day assignment is a scheduled program entry, split by `isActive` into
 * Active (auto-populates, Pass 4) vs Deactivated (paused, kept for
 * reference). Pure grouping only — no new field, no schema change.
 */
import type { SessionTemplate } from '@core/sessionTemplate';

export type GroupedTemplates = {
  oneOffs: SessionTemplate[];
  active: SessionTemplate[];
  deactivated: SessionTemplate[];
};

export function groupTemplatesForLibrary(templates: SessionTemplate[]): GroupedTemplates {
  const oneOffs: SessionTemplate[] = [];
  const active: SessionTemplate[] = [];
  const deactivated: SessionTemplate[] = [];

  for (const t of templates) {
    if (t.dayAssignment == null) {
      oneOffs.push(t);
    } else if (t.isActive) {
      active.push(t);
    } else {
      deactivated.push(t);
    }
  }

  return { oneOffs, active, deactivated };
}
