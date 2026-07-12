/**
 * Route persistence tests (migration 016, routes-spec P1):
 *   - round-trips a route's points/source/visibility identical;
 *   - omit-when-absent: a note-less route comes back without a notes key;
 *   - listRoutes sorts updatedAt desc and filters by activityId;
 *   - updateRoute persists a change and re-stamps updatedAt.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import type { Route } from '@core/route';
import { makeTestDb } from './sqliteTestDb';
import { runMigrations, type SqlDatabase } from '../db';
import { createRoute, getRoute, listRoutes, updateRoute, deleteRoute } from '../routes';

const plottedRoute: Route = {
  id: 'route-1',
  name: 'Green Truss loop',
  activityId: 'kayak',
  source: 'plotted',
  points: [
    { lat: 45.7, lng: -121.5 },
    { lat: 45.701, lng: -121.5 },
  ],
  visibility: 'private',
};

const gpxRoute: Route = {
  id: 'route-2',
  name: 'Imported climb',
  activityId: 'run',
  source: 'gpx',
  points: [
    { lat: 45.6, lng: -121.4, eleM: 800 },
    { lat: 45.61, lng: -121.4, eleM: 850 },
  ],
  visibility: 'private',
  notes: 'watch the switchbacks',
};

describe('route storage', () => {
  let db: SqlDatabase;

  beforeEach(async () => {
    db = makeTestDb();
    await runMigrations(db);
  });

  it('round-trips a plotted route (no notes) — no notes key comes back', async () => {
    await createRoute(plottedRoute, db, '2026-07-11T10:00:00.000Z');
    const back = await getRoute('route-1', db);
    expect(back?.name).toBe('Green Truss loop');
    expect(back?.activityId).toBe('kayak');
    expect(back?.source).toBe('plotted');
    expect(back?.points).toEqual(plottedRoute.points);
    expect(back?.visibility).toBe('private');
    expect(back).not.toHaveProperty('notes');
    expect(back?.createdAt).toBe('2026-07-11T10:00:00.000Z');
  });

  it('round-trips a gpx route with per-point elevation and notes', async () => {
    await createRoute(gpxRoute, db);
    const back = await getRoute('route-2', db);
    expect(back?.source).toBe('gpx');
    expect(back?.points).toEqual(gpxRoute.points);
    expect(back?.notes).toBe('watch the switchbacks');
  });

  it('getRoute returns null for an unknown id', async () => {
    expect(await getRoute('nope', db)).toBeNull();
  });

  it('listRoutes sorts updatedAt desc and filters by activityId', async () => {
    await createRoute(plottedRoute, db, '2026-07-01T10:00:00.000Z');
    await createRoute(gpxRoute, db, '2026-07-05T10:00:00.000Z');

    const all = await listRoutes({}, db);
    expect(all.map((r) => r.id)).toEqual(['route-2', 'route-1']); // most-recently-updated first

    const kayakOnly = await listRoutes({ activityId: 'kayak' }, db);
    expect(kayakOnly.map((r) => r.id)).toEqual(['route-1']);
  });

  it('updateRoute persists a change and re-stamps updatedAt', async () => {
    await createRoute(plottedRoute, db, '2026-07-01T10:00:00.000Z');
    const updated = await updateRoute(
      'route-1',
      { name: 'Green Truss loop (renamed)' },
      db,
      '2026-07-11T12:00:00.000Z'
    );
    expect(updated.name).toBe('Green Truss loop (renamed)');
    expect(updated.updatedAt).toBe('2026-07-11T12:00:00.000Z');
    expect((await getRoute('route-1', db))?.name).toBe('Green Truss loop (renamed)');
  });

  it('updateRoute throws for an unknown id', async () => {
    await expect(updateRoute('nope', { name: 'x' }, db)).rejects.toThrow(/no route with id/);
  });

  it('deleteRoute removes the row and reports whether one existed', async () => {
    await createRoute(plottedRoute, db);
    expect(await deleteRoute('route-1', db)).toBe(true);
    expect(await getRoute('route-1', db)).toBeNull();
    expect(await deleteRoute('route-1', db)).toBe(false);
  });
});
