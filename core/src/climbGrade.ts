/**
 * climbGrade.ts — grade scale classification via @openbeta/sandbag
 * (dimension/earth, Pass E4).
 *
 * The native grade string a climber types ("V4", "6a", "5.10a") is always the
 * tier-1 fact — never overwritten, never silently converted (climbing-apps-
 * research.md: "never silently converted" is a convergent finding across the
 * whole market). `parseClimbGrade` only classifies WHICH scale a grade string
 * matches — it does not compute or store a difficulty score. Two independent,
 * verified bugs in sandbag's own getScore (v0.0.55) rule that out: (1) Font's
 * table lookup is case-sensitive and silently returns 0 for uppercase input
 * that isType() itself accepts; (2) VScale/UIAA's regex accepts grades outside
 * their real table range (e.g. "V44") and getScore then falls back to 0 with
 * no warning, indistinguishable from a genuine bottom-of-scale grade. Both are
 * fabricated numbers wearing a plausible face — classification-only sidesteps
 * the whole class rather than patching each one as it's found.
 *
 * sandbag (MIT, zero runtime deps, v0.0.55 pinned) is the grade authority we
 * shouldn't rebuild by hand, but its case handling is inconsistent by
 * DIRECTION, not just by scale: VScale tolerates either case; Font/French/
 * Ewbank/Saxon/Norwegian/UIAA/Brazilian Crux need lowercase (their isType
 * regex has the `/i` flag so it misleadingly accepts uppercase, but the
 * internal table lookup is a bare `===`); WI/AI (ice) need UPPERCASE — the
 * opposite direction, verified directly against the installed package
 * (`getScale('wi').isType('wi4')` is false; `.isType('WI4')` is true). Rather
 * than hand-verify and hard-code every scale's direction, isType() is tried
 * against the raw string and both case variants; whichever matches wins.
 *
 * Grade notation is genuinely ambiguous without context — "6a" is simultaneously
 * a valid Font (bouldering) and French (route) grade, by design of both
 * systems, and UK technical grades ("5b", "6a"...) collide with the same two
 * scales under a THIRD meaning again (verified: `isType('5b')` is true for
 * both font and french). `style` biases which family of scales is tried
 * first; this is a documented heuristic, not a detector — a real ambiguity
 * resolves silently to whichever scale wins the priority order, with no
 * signal left behind that a collision occurred. There is no 'ice' or 'uk'
 * ClimbStyle in this app yet, so ICE_AID_SYSTEMS can only ever be a fallback
 * and UK technical notation is not specifically prioritized; if either style
 * is added, this heuristic needs a matching branch, not just a new style label.
 */
import { getScale, type GradeScalesTypes } from '@openbeta/sandbag';

export type ClimbGradeSystem = GradeScalesTypes;

const BOULDER_SYSTEMS: ClimbGradeSystem[] = ['vscale', 'font'];
const ROUTE_SYSTEMS: ClimbGradeSystem[] = [
  'yds',
  'french',
  'ewbank',
  'uiaa',
  'saxon',
  'norwegian',
  'brazilian_crux',
];
const ICE_AID_SYSTEMS: ClimbGradeSystem[] = ['ai', 'wi', 'aid'];

/**
 * Candidate scales in priority order for a given session style. 'gym' gets no
 * bias (indoor sessions mix boulder and route climbing) — boulder scales are
 * tried first only because indoor gym logging skews bouldering in the market
 * research (climbing-apps-research.md), not because it's more likely correct.
 */
function systemsFor(style: string | undefined): ClimbGradeSystem[] {
  if (style === 'boulder') return [...BOULDER_SYSTEMS, ...ROUTE_SYSTEMS];
  if (style === 'sport' || style === 'trad' || style === 'top-rope') {
    return [...ROUTE_SYSTEMS, ...BOULDER_SYSTEMS, ...ICE_AID_SYSTEMS];
  }
  return [...BOULDER_SYSTEMS, ...ROUTE_SYSTEMS, ...ICE_AID_SYSTEMS];
}

/**
 * True if any of the raw string or its lower/upper variants match the scale's
 * own isType() — sidesteps needing to know which direction each scale wants.
 */
function matchesScale(scale: { isType: (grade: string) => boolean }, grade: string): boolean {
  return scale.isType(grade) || scale.isType(grade.toLowerCase()) || scale.isType(grade.toUpperCase());
}

/**
 * Best-effort classification of a freeform grade string against sandbag's
 * scale tables. Returns null when nothing matches (freeform text, a typo, a
 * scale sandbag doesn't model) — an honest absence, never a fabricated match.
 * `style` narrows which scales are tried first (see systemsFor); omit it to
 * try every scale in a fixed bouldering-first order.
 */
export function parseClimbGrade(raw: string, style?: string): ClimbGradeSystem | null {
  const grade = raw.trim();
  if (!grade) return null;
  for (const system of systemsFor(style)) {
    const scale = getScale(system);
    if (scale && matchesScale(scale, grade)) return system;
  }
  return null;
}
