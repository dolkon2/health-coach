/**
 * breathwork.test.ts — integrity of the vendored dataset (P2): breathwork pattern library.
 * Counts and invariants here are the vendor-time contract — a failing test
 * means the data drifted, not the code.
 */
import { describe, expect, it } from '@jest/globals';

import { breathPatternById, breathPatterns } from '@/data/breathwork';

// ─── Breathwork patterns ─────────────────────────────────────────────────────

describe('breathwork — vendored pattern integrity', () => {
  const patterns = breathPatterns();

  it('carries 8 patterns with unique ids', () => {
    expect(patterns).toHaveLength(8);
    expect(new Set(patterns.map((p) => p.id)).size).toBe(8);
  });

  it('every pattern has exactly one of defaultCycles / defaultMinutes', () => {
    for (const p of patterns) {
      const has = [p.defaultCycles, p.defaultMinutes].filter((x) => x != null);
      expect(has).toHaveLength(1);
    }
  });

  it('phases are timed unless explicitly untimed (null seconds ⇔ untimed)', () => {
    for (const p of patterns) {
      for (const ph of p.phases) {
        if (ph.seconds == null) expect(ph.untimed).toBe(true);
        else expect(ph.untimed).toBeUndefined();
        expect(['inhale', 'hold', 'exhale', 'holdEmpty']).toContain(ph.type);
      }
    }
  });

  it('WHM retention is the only capture phase: untimed holdEmpty, cautions intact', () => {
    const whm = breathPatternById('whm');
    const retention = whm?.phases.find((ph) => ph.capture === 'retention');
    expect(retention?.type).toBe('holdEmpty');
    expect(retention?.untimed).toBe(true);
    expect(retention?.seconds).toBeNull();
    // The non-negotiable safety copy survived vendoring verbatim.
    expect(whm?.cautions.some((c) => c.includes('NEVER practice in or near water'))).toBe(true);
    expect(whm?.cautions).toHaveLength(5);
    // No other pattern captures retention.
    const others = patterns.filter((p) => p.id !== 'whm');
    for (const p of others) {
      expect(p.phases.every((ph) => ph.capture == null)).toBe(true);
    }
  });

  it('every pattern carries a cautions array (may be empty, never absent)', () => {
    for (const p of patterns) expect(Array.isArray(p.cautions)).toBe(true);
  });

  it('every phase group id resolves to a group definition', () => {
    for (const p of patterns) {
      for (const ph of p.phases) {
        if (ph.group != null) expect(p.groups?.[ph.group]?.repeat).toBeGreaterThan(0);
      }
    }
  });
});

