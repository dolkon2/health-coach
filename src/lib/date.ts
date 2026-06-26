/**
 * Local civil-day helpers. Time is the user's local day (data-model principle 4):
 * an 11:30pm and a 12:30am entry are different days.
 */

/** e.g. "Thursday, June 26" — rendered uppercase by the display type variant. */
export function todayLocalLabel(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** e.g. "2026" */
export function yearLabel(d: Date = new Date()): string {
  return String(d.getFullYear());
}
