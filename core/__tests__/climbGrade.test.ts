/**
 * The Proof — parseClimbGrade classifies which scale a grade string matches
 * and never fabricates a difficulty score:
 *   1. A recognized grade returns its scale name (real sandbag call, no
 *      mocking — same pattern as E3's real-fetch-fixture tests).
 *   2. Case is irrelevant in BOTH directions. Verified directly against the
 *      installed package (v0.0.55): Font/French/Ewbank/Saxon/Norwegian/UIAA/
 *      Brazilian Crux need LOWERCASE (their isType regex has the `/i` flag so
 *      it misleadingly accepts uppercase, but the internal getScore table
 *      lookup is a bare `===` and silently returns 0 for it); WI/AI (ice)
 *      need UPPERCASE — the opposite direction. Trying all three case forms
 *      against isType() (not getScore) sidesteps both, in both directions.
 *   3. Style resolves the genuine "6a" ambiguity between Font (bouldering)
 *      and French (route) — same string, different style, different scale.
 *   4. Unparseable input (freeform text, empty, whitespace-only) returns
 *      null — never a fabricated match.
 *   5. No score is ever returned — sandbag's getScore silently fabricates 0
 *      for some regex-valid-but-out-of-table-range grades (verified: VScale
 *      'V44', UIAA '99' and '13' all isType()=true but getScore()=0 with no
 *      warning), so parseClimbGrade never calls it at all.
 */
import { describe, it, expect } from '@jest/globals';
import { parseClimbGrade } from '@core/climbGrade';

describe('parseClimbGrade', () => {
  it('parses a V-scale grade with no style hint', () => {
    expect(parseClimbGrade('V4')).toBe('vscale');
  });

  it('is case-insensitive for scales that need lowercase (Font)', () => {
    expect(parseClimbGrade('6A', 'boulder')).toBe('font');
    expect(parseClimbGrade('6a', 'boulder')).toBe('font');
  });

  it('is case-insensitive for scales that need UPPERCASE (WI/AI ice)', () => {
    expect(parseClimbGrade('wi4')).toBe('wi');
    expect(parseClimbGrade('WI4')).toBe('wi');
    expect(parseClimbGrade('ai3+')).toBe('ai');
    expect(parseClimbGrade('AI3+')).toBe('ai');
  });

  it('resolves the Font/French "6a" ambiguity by style', () => {
    expect(parseClimbGrade('6a', 'boulder')).toBe('font');
    expect(parseClimbGrade('6a', 'sport')).toBe('french');
  });

  it('parses a YDS route grade for sport/trad styles', () => {
    expect(parseClimbGrade('5.10a', 'sport')).toBe('yds');
    expect(parseClimbGrade('5.10a', 'trad')).toBe('yds');
  });

  it('tries boulder scales first with no style bias (gym)', () => {
    expect(parseClimbGrade('V5', 'gym')).toBe('vscale');
  });

  it('returns null for freeform, empty, or whitespace-only input', () => {
    expect(parseClimbGrade('garbage')).toBeNull();
    expect(parseClimbGrade('')).toBeNull();
    expect(parseClimbGrade('   ')).toBeNull();
  });

  it('classifies an out-of-table-range grade by format, never a fabricated score', () => {
    // 'V44' passes VScale's regex (real climbed grades top out far lower) —
    // this is a real, if unlikely, classification, distinguishable from the
    // fabricated-0-score bug only by the fact that no score is ever returned.
    expect(parseClimbGrade('V44', 'boulder')).toBe('vscale');
  });
});
