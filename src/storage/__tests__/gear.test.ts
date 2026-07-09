/**
 * The Proof — the gear table (migration 010) holds declared facts and nothing
 * derived:
 *   1. Migration 010 applies on a fresh database and the table round-trips a
 *      full record, spec JSON included.
 *   2. Retire stamps retiredOn and filters the row from the default (active)
 *      list — the row itself survives, history intact; includeRetired opts in.
 *   3. Delete is a hard remove for mistakes and reports whether a row matched.
 *   4. Corrupt spec JSON degrades to an absent spec — the gear stays readable,
 *      never a throw.
 * Real SQL via better-sqlite3 in-memory (house rule: never mock the DB).
 */
import { describe, it, expect } from '@jest/globals';
import { runMigrations } from '../db';
import { makeTestDb } from './sqliteTestDb';
import {
  createGear,
  deleteGear,
  getGearById,
  listGear,
  retireGear,
  updateGear,
  type GearRecord,
} from '../gear';

const SHOES: GearRecord = {
  id: 'g-shoes',
  name: 'Speedgoat 5',
  category: 'shoes',
  acquiredOn: '2026-04-01',
  spec: { targetKm: 500 },
  notes: 'trail pair',
  createdAt: '2026-04-01T10:00:00Z',
};

const CHAIN: GearRecord = {
  id: 'g-chain',
  name: 'XT chain',
  category: 'bike-component',
  parentId: 'g-bike',
  acquiredOn: '2026-07-01',
  spec: { componentType: 'chain', serviceIntervalKm: 300 },
  createdAt: '2026-07-01T10:00:00Z',
};

describe('gear storage (migration 010)', () => {
  it('applies migration 010 and round-trips a record including spec JSON', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGear(SHOES, db);
    expect(await getGearById('g-shoes', db)).toEqual(SHOES);

    // The discriminated arm survives the JSON column intact.
    await createGear(CHAIN, db);
    const back = await getGearById('g-chain', db);
    expect(back).toEqual(CHAIN);
    expect(back?.category === 'bike-component' && back.spec?.componentType).toBe('chain');
  });

  it('omits absent optional fields on hydrate rather than nulling them', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const bare: GearRecord = {
      id: 'g-bare',
      name: 'Old bike',
      category: 'bike',
      createdAt: '2026-01-01T00:00:00Z',
    };
    await createGear(bare, db);
    const back = await getGearById('g-bare', db);
    expect(back).toEqual(bare);
    expect(back && 'spec' in back).toBe(false);
    expect(back && 'parentId' in back).toBe(false);
  });

  it('updateGear merges a patch in place and throws on an unknown id', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await createGear(SHOES, db);

    const updated = await updateGear('g-shoes', { spec: { targetKm: 650 } }, db);
    expect(updated.spec).toEqual({ targetKm: 650 });
    expect((await getGearById('g-shoes', db))?.spec).toEqual({ targetKm: 650 });

    await expect(updateGear('nope', { name: 'x' }, db)).rejects.toThrow('no gear with id');
  });

  it('retire stamps retiredOn and filters from the default list; includeRetired opts in', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await createGear(SHOES, db);
    await createGear(CHAIN, db);

    await retireGear('g-shoes', '2026-07-04', db);

    const active = await listGear({}, db);
    expect(active.map((g) => g.id)).toEqual(['g-chain']);

    const all = await listGear({ includeRetired: true }, db);
    expect(all).toHaveLength(2);
    expect(all.find((g) => g.id === 'g-shoes')?.retiredOn).toBe('2026-07-04');
    // Retire never deletes — the row and its declared facts survive.
    expect((await getGearById('g-shoes', db))?.name).toBe('Speedgoat 5');
  });

  it('deleteGear hard-removes and reports whether a row matched', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await createGear(SHOES, db);

    expect(await deleteGear('g-shoes', db)).toBe(true);
    expect(await getGearById('g-shoes', db)).toBeNull();
    expect(await deleteGear('g-shoes', db)).toBe(false);
  });

  it('degrades corrupt spec JSON to an absent spec instead of throwing', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await db.runAsync(
      `INSERT INTO gear (id, name, category, spec, createdAt)
       VALUES ('g-corrupt', 'Mystery skis', 'skis', 'not json', '2026-01-01T00:00:00Z');`
    );
    const back = await getGearById('g-corrupt', db);
    expect(back?.name).toBe('Mystery skis');
    expect(back?.spec).toBeUndefined();
    // And the corrupt row doesn't poison the list either.
    expect((await listGear({}, db)).map((g) => g.id)).toContain('g-corrupt');
  });
});
