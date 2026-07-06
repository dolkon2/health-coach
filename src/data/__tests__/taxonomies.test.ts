/**
 * taxonomies.test.ts — integrity of the vendored dataset (P2): the four practice/PT taxonomies.
 * Counts and invariants here are the vendor-time contract — a failing test
 * means the data drifted, not the code.
 */
import { describe, expect, it } from '@jest/globals';

import {
  danceContextTags,
  danceFamilies,
  mobilityZones,
  romTests,
  yogaStyles,
} from '@/data/taxonomies';

// ─── Taxonomies ──────────────────────────────────────────────────────────────

describe('taxonomies — vendored vocabularies', () => {
  it('yoga: 10 styles, unique ids, descriptive-only intensity vocabulary', () => {
    const styles = yogaStyles();
    expect(styles).toHaveLength(10);
    expect(new Set(styles.map((s) => s.id)).size).toBe(10);
    for (const s of styles) {
      expect(['low', 'medium', 'high']).toContain(s.typicalIntensity);
      expect(typeof s.mindfulnessEligible).toBe('boolean');
    }
  });

  it('dance: 6 families, globally unique style ids, barre keeps hkOverride', () => {
    const families = danceFamilies();
    expect(families).toHaveLength(6);
    const styleIds = families.flatMap((f) => f.styles.map((s) => s.id));
    expect(new Set(styleIds).size).toBe(styleIds.length);
    const barre = families.flatMap((f) => f.styles).find((s) => s.id === 'barre');
    expect(barre?.hkOverride).toBe('barre');
    const tags = danceContextTags();
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) expect(t.hkMapping.length).toBeGreaterThan(0);
  });

  it('mobility: exactly 10 zones, unique ids, sided is explicit on every zone', () => {
    const zones = mobilityZones();
    expect(zones).toHaveLength(10);
    expect(new Set(zones.map((z) => z.id)).size).toBe(10);
    for (const z of zones) expect(typeof z.sided).toBe('boolean');
  });

  it('rom: exactly 8 tests, unique ids, validated flag survives on every test', () => {
    const tests = romTests();
    expect(tests).toHaveLength(8);
    expect(new Set(tests.map((t) => t.id)).size).toBe(8);
    for (const t of tests) {
      expect(typeof t.validated).toBe('boolean');
      expect(['cm', 'degrees']).toContain(t.unit);
      expect(t.protocol.length).toBeGreaterThan(0);
    }
    // The one honesty-flagged unvalidated protocol stays marked unvalidated.
    expect(tests.find((t) => t.id === 'couch-knee-to-wall')?.validated).toBe(false);
  });
});
