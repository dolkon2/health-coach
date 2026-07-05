/**
 * Spot persistence tests (Water dimension, migration 010):
 *   - a river-section spot (gauge ref, river/section names) and a launch spot
 *     (coords) both round-trip identical;
 *   - omit-when-absent: a coord-less spot comes back without lat/lng
 *     (null ≠ 0 — absent means absent);
 *   - listSpots({kind}) filters; no delete function exists (spotId refs on
 *     session blocks should stay resolvable).
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import type { Spot } from '@core/spot';
import { makeTestDb } from './sqliteTestDb';
import { runMigrations, type SqlDatabase } from '../db';
import { createSpot, updateSpot, listSpots, getSpot } from '../spots';

const riverSpot: Spot = {
  id: 'spot-truss',
  name: 'White Salmon — Green Truss',
  kind: 'river-section',
  riverName: 'White Salmon',
  sectionName: 'Green Truss',
  gaugeSiteId: 'USGS-14123500',
  notes: 'take out above BZ falls',
  createdAt: '2026-07-01T10:00:00.000Z',
};

const launchSpot: Spot = {
  id: 'spot-sandbar',
  name: 'Hood River sandbar',
  kind: 'launch',
  lat: 45.7118,
  lng: -121.4995,
  createdAt: '2026-07-02T10:00:00.000Z',
};

describe('spot storage', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = makeTestDb();
    await runMigrations(db);
  });

  it('round-trips a river-section spot identical (gauge ref included)', async () => {
    await createSpot(riverSpot, db);
    expect(await getSpot('spot-truss', db)).toEqual(riverSpot);
  });

  it('round-trips a launch spot with coords', async () => {
    await createSpot(launchSpot, db);
    const back = await getSpot('spot-sandbar', db);
    expect(back).toEqual(launchSpot);
    expect(back?.lat).toBeCloseTo(45.7118);
    expect(back?.lng).toBeCloseTo(-121.4995);
  });

  it('keeps absent optional fields absent — a coord-less spot has no lat/lng keys', async () => {
    const bare: Spot = {
      id: 'spot-bare',
      name: 'Unnamed creek',
      kind: 'river-section',
      createdAt: '2026-07-03T10:00:00.000Z',
    };
    await createSpot(bare, db);
    const back = await getSpot('spot-bare', db);
    expect(back).toEqual(bare);
    expect(back).not.toHaveProperty('lat');
    expect(back).not.toHaveProperty('lng');
    expect(back).not.toHaveProperty('gaugeSiteId');
  });

  it('updateSpot persists changes (e.g. picking the home gauge later)', async () => {
    await createSpot({ ...riverSpot, gaugeSiteId: undefined }, db);
    await updateSpot(riverSpot, db);
    expect((await getSpot('spot-truss', db))?.gaugeSiteId).toBe('USGS-14123500');
  });

  it('listSpots filters by kind and lists all without a filter', async () => {
    await createSpot(riverSpot, db);
    await createSpot(launchSpot, db);

    const launches = await listSpots({ kind: 'launch' }, db);
    expect(launches.map((s) => s.id)).toEqual(['spot-sandbar']);

    const rivers = await listSpots({ kind: 'river-section' }, db);
    expect(rivers.map((s) => s.id)).toEqual(['spot-truss']);

    const all = await listSpots({}, db);
    expect(all.map((s) => s.id).sort()).toEqual(['spot-sandbar', 'spot-truss']);
  });

  it('getSpot returns null for an unknown id', async () => {
    expect(await getSpot('nope', db)).toBeNull();
  });
});
