/**
 * Gear + kit persistence tests (Water dimension, migration 010). The contract's
 * proof points:
 *   - migration 010 applies cleanly on a fresh db (explicit table-exists check);
 *   - a GearItem round-trips identical, including the JSON GearSpec column;
 *   - omit-when-absent: absent spec/dates/notes come back absent, never null;
 *   - retirement is the ONLY removal — listGear excludes retired by default,
 *     includeRetired shows them, and getGearItem still resolves a retired item
 *     (session history must resolve);
 *   - kits round-trip (gear_ids JSON) and MAY be hard-deleted.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import type { GearItem, Kit } from '@core/gear';
import { makeTestDb } from './sqliteTestDb';
import { runMigrations, type SqlDatabase } from '../db';
import {
  createGearItem,
  updateGearItem,
  retireGearItem,
  listGearItems,
  getGearItem,
  createKit,
  deleteKit,
  listKits,
  getKit,
} from '../gear';

function gearItem(over: Partial<GearItem> = {}): GearItem {
  return {
    id: 'gear-1',
    name: '9m Duotone Unit',
    category: 'wing',
    spec: { sizeM2: 9 },
    acquiredOn: '2025-04-12',
    notes: 'light-wind wing',
    createdAt: '2026-07-01T10:00:00.000Z',
    ...over,
  };
}

describe('migration 014 (dimension unify)', () => {
  it('creates the gear, kits, and spots tables on a fresh db', async () => {
    const db = makeTestDb();
    await runMigrations(db);
    const tables = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('gear', 'kits', 'spots') ORDER BY name;`
    );
    expect(tables.map((t) => t.name)).toEqual(['gear', 'kits', 'spots']);
  });
});

describe('gear storage', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = makeTestDb();
    await runMigrations(db);
  });

  it('round-trips a full GearItem, JSON spec intact', async () => {
    const g = gearItem({
      id: 'gear-foil',
      name: 'Armstrong HA 925',
      category: 'foil',
      spec: { areaCm2: 925, mastLengthCm: 85 },
    });
    await createGearItem(g, db);
    const back = await getGearItem('gear-foil', db);
    expect(back).toEqual(g);
    expect(back?.spec).toEqual({ areaCm2: 925, mastLengthCm: 85 });
  });

  it('keeps absent optional fields absent (never null-filled)', async () => {
    const g: GearItem = {
      id: 'gear-boat',
      name: 'Jackson Antix 2.0',
      category: 'kayak',
      createdAt: '2026-07-01T10:00:00.000Z',
    };
    await createGearItem(g, db);
    const back = await getGearItem('gear-boat', db);
    expect(back).toEqual(g);
    expect(back).not.toHaveProperty('spec');
    expect(back).not.toHaveProperty('acquiredOn');
    expect(back).not.toHaveProperty('retiredOn');
    expect(back).not.toHaveProperty('notes');
  });

  it('updateGearItem persists changed fields including a rewritten spec', async () => {
    await createGearItem(gearItem(), db);
    const updated = gearItem({
      name: '8m Duotone Unit',
      spec: { sizeM2: 8 },
      notes: 'traded down a size',
    });
    await updateGearItem(updated, db);
    expect(await getGearItem('gear-1', db)).toEqual(updated);
  });

  it('retireGearItem soft-deletes: default list hides it, includeRetired and getGearItem resolve it', async () => {
    await createGearItem(gearItem({ id: 'gear-old', createdAt: '2026-07-01T10:00:00.000Z' }), db);
    await createGearItem(
      gearItem({ id: 'gear-new', name: '6m Slick', spec: { sizeM2: 6 }, createdAt: '2026-07-02T10:00:00.000Z' }),
      db
    );

    await retireGearItem('gear-old', '2026-07-04', db);

    const active = await listGearItems({}, db);
    expect(active.map((g) => g.id)).toEqual(['gear-new']);

    const all = await listGearItems({ includeRetired: true }, db);
    expect(all.map((g) => g.id)).toEqual(['gear-new', 'gear-old']);

    // History must resolve: a retired item is still fetchable by id.
    const retired = await getGearItem('gear-old', db);
    expect(retired?.retiredOn).toBe('2026-07-04');
    expect(retired?.name).toBe('9m Duotone Unit');
  });

  it('getGearItem returns null for an unknown id', async () => {
    expect(await getGearItem('nope', db)).toBeNull();
  });
});

describe('kit storage', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = makeTestDb();
    await runMigrations(db);
  });

  it('round-trips a kit with its gearIds JSON list', async () => {
    const k: Kit = {
      id: 'kit-1',
      name: 'Light-wind setup',
      gearIds: ['gear-board', 'gear-wing-9m', 'gear-foil'],
      createdAt: '2026-07-01T10:00:00.000Z',
    };
    await createKit(k, db);
    expect(await getKit('kit-1', db)).toEqual(k);
    expect(await listKits(db)).toEqual([k]);
  });

  it('deleteKit hard-deletes (WindBlock denormalizes resolved gearIds)', async () => {
    const k: Kit = {
      id: 'kit-gone',
      name: 'Storm kit',
      gearIds: ['gear-wing-4m'],
      createdAt: '2026-07-01T10:00:00.000Z',
    };
    await createKit(k, db);
    await deleteKit('kit-gone', db);
    expect(await getKit('kit-gone', db)).toBeNull();
    expect(await listKits(db)).toEqual([]);
  });
});
