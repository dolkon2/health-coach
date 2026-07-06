/**
 * Storage round-trip tests for Spot (migration 011).
 *
 * Real SQL via better-sqlite3 in-memory — exercises migration 011, the
 * serializer (meta JSON round-trip), and the CRUD module.
 */
import { describe, it, expect } from '@jest/globals';
import type { Spot } from '@core/spot';
import { spotRequiresUshpaMembership } from '@core/spot';
import { runMigrations } from '../db';
import { createSpot, listSpots, getSpotById, updateSpot, deleteSpot } from '../spots';
import { makeTestDb } from './sqliteTestDb';

function flyingSite(id: string, overrides: Partial<Spot> = {}): Spot {
  return {
    id,
    name: 'Cliffside',
    lat: 45.6612,
    lng: -121.5498,
    kind: 'flying-site',
    meta: { requiresMembership: true, ushpaAffiliated: true },
    notes: 'NW launch, LZ by the river',
    ...overrides,
  };
}

function bareSpot(id: string, kind = 'put-in'): Spot {
  return { id, name: 'River Left', lat: 45.71, lng: -121.51, kind };
}

describe('spots storage', () => {
  it('round-trips a spot with meta and notes intact', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = flyingSite('sp-1');
    await createSpot(original, db);

    const back = await getSpotById('sp-1', db);
    expect(back).toEqual(original);
    expect(spotRequiresUshpaMembership(back!)).toBe(true);
  });

  it('omits absent optional fields on the way back (no null leakage)', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createSpot(bareSpot('sp-bare'), db);

    const back = await getSpotById('sp-bare', db);
    expect(back!.meta).toBeUndefined();
    expect(back!.notes).toBeUndefined();
    expect('meta' in back!).toBe(false);
    expect(spotRequiresUshpaMembership(back!)).toBeUndefined();
  });

  it('lists newest-created first and filters by kind', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createSpot(flyingSite('sp-old'), db, '2026-07-01T10:00:00Z');
    await createSpot(bareSpot('sp-water'), db, '2026-07-02T10:00:00Z');
    await createSpot(flyingSite('sp-new'), db, '2026-07-03T10:00:00Z');

    const all = await listSpots({}, db);
    expect(all.map((s) => s.id)).toEqual(['sp-new', 'sp-water', 'sp-old']);

    const flying = await listSpots({ kind: 'flying-site' }, db);
    expect(flying.map((s) => s.id)).toEqual(['sp-new', 'sp-old']);
  });

  it('updateSpot merges the patch and preserves the rest', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const original = flyingSite('sp-1');
    await createSpot(original, db);

    await updateSpot('sp-1', { name: 'Cliffside Launch', meta: { requiresMembership: false } }, db);

    const back = await getSpotById('sp-1', db);
    expect(back!.name).toBe('Cliffside Launch');
    expect(spotRequiresUshpaMembership(back!)).toBe(false);
    expect(back!.lat).toBe(original.lat);
    expect(back!.notes).toBe(original.notes);
    expect(back!.kind).toBe('flying-site');
  });

  it('updateSpot throws when the id does not exist', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await expect(updateSpot('ghost', { name: 'whatever' }, db)).rejects.toThrow(
      /no spot with id ghost/
    );
  });

  it('deleteSpot removes the row and returns true; false when missing', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createSpot(flyingSite('sp-1'), db);

    expect(await deleteSpot('sp-1', db)).toBe(true);
    expect(await getSpotById('sp-1', db)).toBeNull();
    expect(await deleteSpot('sp-1', db)).toBe(false);
  });
});
