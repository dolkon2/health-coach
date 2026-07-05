/**
 * Storage round-trip tests for GearItem (quiver, migration 010).
 *
 * Real SQL via better-sqlite3 in-memory — exercises migration 010, the
 * serializer, and the CRUD module. One round-trip per category confirms each
 * spec variant survives JSON.stringify/parse with its discriminator intact.
 */
import { describe, it, expect } from '@jest/globals';
import type { GearItem, HarnessSpec, ReserveSpec, WingSpec } from '@core/gear';
import { runMigrations } from '../db';
import {
  createGear,
  listGear,
  getGearById,
  updateGear,
  retireGear,
  deleteGear,
} from '../gear';
import { makeTestDb } from './sqliteTestDb';

function wingItem(id: string, overrides: Partial<GearItem> = {}): GearItem {
  const spec: WingSpec = {
    category: 'wing',
    style: 'xc',
    sizeM2: 23,
    certClass: 'EN B',
    hoursBaseline: 140,
  };
  return {
    id,
    name: 'Ozone Rush 6',
    acquiredAt: '2024-05-10',
    notes: 'Bought used, one previous owner',
    spec,
    ...overrides,
  };
}

function harnessItem(id: string): GearItem {
  const spec: HarnessSpec = { category: 'harness' };
  return { id, name: 'Advance Lightness 3', spec };
}

function reserveItem(id: string): GearItem {
  const spec: ReserveSpec = {
    category: 'reserve',
    lastRepackAt: '2026-02-01',
    repackIntervalMonths: 6,
  };
  return { id, name: 'Companion SQR 120', acquiredAt: '2024-05-10', spec };
}

describe('gear storage', () => {
  it('round-trips a wing with full spec and base fields', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = wingItem('g-wing-1');
    await createGear(original, db);

    const back = await getGearById('g-wing-1', db);
    expect(back).not.toBeNull();
    expect(back).toEqual(original);
    const spec = back!.spec as WingSpec;
    expect(spec.category).toBe('wing');
    expect(spec.style).toBe('xc');
    expect(spec.sizeM2).toBe(23);
    expect(spec.certClass).toBe('EN B');
    expect(spec.hoursBaseline).toBe(140);
  });

  it('round-trips each category with discriminator intact', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGear(wingItem('g-wing'), db);
    await createGear(harnessItem('g-harness'), db);
    await createGear(reserveItem('g-reserve'), db);

    const list = await listGear({}, db);
    expect(list).toHaveLength(3);

    const byCategory = Object.fromEntries(list.map((g) => [g.spec.category, g]));
    expect(byCategory.wing.spec.category).toBe('wing');
    expect(byCategory.harness.spec.category).toBe('harness');
    expect(byCategory.reserve.spec.category).toBe('reserve');
    expect((byCategory.reserve.spec as ReserveSpec).lastRepackAt).toBe('2026-02-01');
  });

  it('omits absent optional base fields on the way back (no null leakage)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGear(harnessItem('g-h'), db); // no acquiredAt/retiredAt/notes

    const back = await getGearById('g-h', db);
    expect(back!.acquiredAt).toBeUndefined();
    expect(back!.retiredAt).toBeUndefined();
    expect(back!.notes).toBeUndefined();
    expect('acquiredAt' in back!).toBe(false);
  });

  it('lists newest-created first', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGear(wingItem('g-old'), db, '2026-07-01T10:00:00Z');
    await createGear(harnessItem('g-new'), db, '2026-07-02T10:00:00Z');

    const list = await listGear({}, db);
    expect(list.map((g) => g.id)).toEqual(['g-new', 'g-old']);
  });

  it('filters by category', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGear(wingItem('g-wing'), db);
    await createGear(harnessItem('g-harness'), db);
    await createGear(reserveItem('g-reserve'), db);

    const wings = await listGear({ category: 'wing' }, db);
    expect(wings.map((g) => g.id)).toEqual(['g-wing']);
    const reserves = await listGear({ category: 'reserve' }, db);
    expect(reserves.map((g) => g.id)).toEqual(['g-reserve']);
  });

  it('excludes retired items by default, includes them on request', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGear(wingItem('g-active'), db, '2026-07-01T10:00:00Z');
    await createGear(wingItem('g-retired'), db, '2026-07-02T10:00:00Z');
    await retireGear('g-retired', '2026-07-03', db);

    const active = await listGear({}, db);
    expect(active.map((g) => g.id)).toEqual(['g-active']);

    const all = await listGear({ includeRetired: true }, db);
    expect(all.map((g) => g.id)).toEqual(['g-retired', 'g-active']);

    const retiredWings = await listGear({ category: 'wing', includeRetired: true }, db);
    expect(retiredWings).toHaveLength(2);
  });

  it('retireGear stamps retiredAt and keeps the row; get still returns it', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGear(wingItem('g-1'), db);
    const retired = await retireGear('g-1', '2026-07-03', db);
    expect(retired.retiredAt).toBe('2026-07-03');

    const back = await getGearById('g-1', db);
    expect(back).not.toBeNull();
    expect(back!.retiredAt).toBe('2026-07-03');
    expect(back!.name).toBe('Ozone Rush 6'); // rest of the row untouched
  });

  it('updateGear patches fields and preserves the rest', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = wingItem('g-1');
    await createGear(original, db);

    const spec: WingSpec = { ...(original.spec as WingSpec), hoursBaseline: 155 };
    await updateGear('g-1', { name: 'Rush 6 (23m)', spec }, db);

    const back = await getGearById('g-1', db);
    expect(back!.name).toBe('Rush 6 (23m)');
    expect((back!.spec as WingSpec).hoursBaseline).toBe(155);
    expect(back!.acquiredAt).toBe(original.acquiredAt);
    expect(back!.notes).toBe(original.notes);
  });

  it('updateGear keeps the category column in sync with spec.category', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGear(wingItem('g-1'), db);
    const harnessSpec: HarnessSpec = { category: 'harness' };
    await updateGear('g-1', { spec: harnessSpec }, db);

    expect(await listGear({ category: 'wing' }, db)).toHaveLength(0);
    const harnesses = await listGear({ category: 'harness' }, db);
    expect(harnesses.map((g) => g.id)).toEqual(['g-1']);
  });

  it('updateGear throws when the id does not exist', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await expect(updateGear('ghost', { name: 'whatever' }, db)).rejects.toThrow(
      /no gear item with id ghost/
    );
  });

  it('deleteGear removes the row and returns true; false when missing', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGear(wingItem('g-1'), db);

    expect(await deleteGear('g-1', db)).toBe(true);
    expect(await getGearById('g-1', db)).toBeNull();
    expect(await listGear({ includeRetired: true }, db)).toHaveLength(0);

    // Idempotent.
    expect(await deleteGear('g-1', db)).toBe(false);
  });
});
