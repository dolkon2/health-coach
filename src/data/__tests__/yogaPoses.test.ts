/**
 * yogaPoses.test.ts — integrity of the vendored dataset (P2): yoga poses + snapshotted SVGs.
 * Counts and invariants here are the vendor-time contract — a failing test
 * means the data drifted, not the code.
 */
import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import { slugifyPoseName, yogaPoseMeta, yogaPoses } from '@/data/yogaPoses';

// ─── Yoga poses ──────────────────────────────────────────────────────────────

describe('yogaPoses — vendored pose integrity + upstream corrections', () => {
  const poses = yogaPoses();

  it('carries 48 poses with unique ids and MIT attribution in meta', () => {
    expect(poses).toHaveLength(48);
    expect(new Set(poses.map((p) => p.id)).size).toBe(48);
    expect(yogaPoseMeta().license).toContain('MIT');
    expect(yogaPoseMeta().source).toContain('yoga-api');
  });

  it('applies the Bridge categorization correction (upstream ships it empty)', () => {
    const bridge = poses.find((p) => p.english_name === 'Bridge');
    expect(bridge?.categories).toEqual(['Backbend Yoga', 'Chest Opening Yoga']);
    expect(bridge?.difficulty).toEqual(['Beginner']);
  });

  it('applies the two sanskrit typo corrections', () => {
    expect(poses.find((p) => p.id === 11)?.sanskrit_name_adapted).toBe('Savasana');
    expect(poses.find((p) => p.id === 43)?.sanskrit_name_adapted).toBe(
      'Urdhva Mukha Svanasana',
    );
    // No pose anywhere still carries an upstream typo string.
    const all = JSON.stringify(poses);
    expect(all).not.toContain('Sivasana');
    expect(all).not.toContain('Svsnssana');
  });

  it('every pose has a categorization and a difficulty after corrections', () => {
    for (const p of poses) {
      expect(p.categories.length).toBeGreaterThan(0);
      expect(p.difficulty.length).toBeGreaterThan(0);
    }
  });

  it('has a non-empty snapshotted SVG for all 48 poses (assets/yoga-poses)', () => {
    const dir = path.join(__dirname, '..', '..', '..', 'assets', 'yoga-poses');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'));
    expect(files).toHaveLength(48);
    for (const p of poses) {
      const file = path.join(dir, `${slugifyPoseName(p.english_name)}.svg`);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(0);
    }
  });
});

