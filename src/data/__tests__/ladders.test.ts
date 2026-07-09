/**
 * ladders.test.ts — integrity of the vendored dataset (P2): calisthenics skill ladders.
 * Counts and invariants here are the vendor-time contract — a failing test
 * means the data drifted, not the code.
 */
import { describe, expect, it } from '@jest/globals';

import { ladderChainById, ladderChains, ladderStepById } from '@/data/ladders';

// ─── Calisthenics ladders ────────────────────────────────────────────────────

describe('ladders — vendored chain integrity', () => {
  const chains = ladderChains();

  it('carries 13 chains and 71 steps', () => {
    expect(chains).toHaveLength(13);
    expect(chains.reduce((n, c) => n + c.steps.length, 0)).toBe(71);
  });

  it('chain ids and step ids are globally unique', () => {
    const chainIds = chains.map((c) => c.id);
    expect(new Set(chainIds).size).toBe(chainIds.length);
    const stepIds = chains.flatMap((c) => c.steps.map((s) => s.id));
    expect(new Set(stepIds).size).toBe(stepIds.length);
  });

  it('every step has a positive factor and a full advancement threshold', () => {
    for (const c of chains) {
      for (const s of c.steps) {
        expect(s.leverageFactor).toBeGreaterThan(0);
        expect(s.advancement.sets).toBeGreaterThan(0);
        expect(s.advancement.repsOrSeconds).toBeGreaterThan(0);
        expect(['reps', 'duration']).toContain(s.setType);
      }
    }
  });

  it('factors rise strictly except the documented loadable-continuity steps', () => {
    for (const c of chains) {
      c.steps.forEach((s, i) => {
        if (i === 0) return;
        const prev = c.steps[i - 1].leverageFactor;
        if (s.loadable) {
          // Loadable steps deliberately EQUAL their unweighted anchor —
          // position comes from effectiveLeverage, not raw factor.
          expect(s.leverageFactor).toBeGreaterThanOrEqual(prev);
        } else {
          expect(s.leverageFactor).toBeGreaterThan(prev);
        }
      });
    }
  });

  it("keeps loadable on exactly weighted dip + weighted pull-up (⚑ 'loadable KEPT')", () => {
    const loadable = chains.flatMap((c) => c.steps.filter((s) => s.loadable === true));
    expect(loadable.map((s) => s.id).sort()).toEqual(['dip-weighted', 'pullup-weighted']);
  });

  it('resolves lookups referentially (chain by id, step to its own chain)', () => {
    expect(ladderChainById('pushup-line')?.name).toBe('Push-up');
    const hit = ladderStepById('dip-weighted');
    expect(hit?.chain.id).toBe('dip-line');
    expect(hit?.chain.steps[hit.stepIndex].id).toBe('dip-weighted');
    expect(ladderStepById('nope')).toBeUndefined();
  });
});

