/**
 * routes.ts — typed CRUD for the routes table (migration 016, routes-spec P1).
 *
 * Mirrors spots.ts's shape (the nearest precedent: a small, user-created,
 * named-geometry entity). No merge history here, so a single call shape per
 * operation — unlike spots' updateSpot, which carries two overloads for
 * historical reasons.
 */
import type { Route } from '@core/route';
import { getDb, type SqlDatabase } from './db';
import { routeToRow, rowToRoute, type RouteRow } from './serialize';

const COLUMNS = 'id, name, activityId, source, points, visibility, notes, createdAt, updatedAt';

export async function createRoute(
  route: Route,
  db?: SqlDatabase,
  nowIso?: string
): Promise<Route> {
  const d = db ?? (await getDb());
  const now = nowIso ?? new Date().toISOString();
  const r = routeToRow(route, route.createdAt ?? now, now);
  await d.runAsync(
    `INSERT INTO routes (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [r.id, r.name, r.activityId, r.source, r.points, r.visibility, r.notes, r.createdAt, r.updatedAt]
  );
  return rowToRoute(r);
}

export type ListRoutesOptions = {
  activityId?: string;
};

/** Sorted `updatedAt` desc — "2 most-recent" for the Training shelf falls
 *  straight out of this order (training-tab.md §3 C). */
export async function listRoutes(
  opts: ListRoutesOptions = {},
  db?: SqlDatabase
): Promise<Route[]> {
  const d = db ?? (await getDb());
  const where: string[] = [];
  const params: string[] = [];
  if (opts.activityId) {
    where.push('activityId = ?');
    params.push(opts.activityId);
  }
  const rows = await d.getAllAsync<RouteRow>(
    `SELECT ${COLUMNS} FROM routes
     ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY updatedAt DESC;`,
    params
  );
  return rows.map(rowToRoute);
}

export async function getRoute(id: string, db?: SqlDatabase): Promise<Route | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<RouteRow>(`SELECT ${COLUMNS} FROM routes WHERE id = ?;`, [
    id,
  ]);
  return row ? rowToRoute(row) : null;
}

export async function updateRoute(
  id: string,
  patch: Partial<Omit<Route, 'id'>>,
  db?: SqlDatabase,
  nowIso?: string
): Promise<Route> {
  const d = db ?? (await getDb());
  const existing = await getRoute(id, d);
  if (!existing) {
    throw new Error(`updateRoute: no route with id ${id}`);
  }
  const merged: Route = { ...existing, ...patch, id };
  const now = nowIso ?? new Date().toISOString();
  const r = routeToRow(merged, merged.createdAt ?? now, now);
  await d.runAsync(
    `UPDATE routes
     SET name = ?, activityId = ?, source = ?, points = ?, visibility = ?, notes = ?, updatedAt = ?
     WHERE id = ?;`,
    [r.name, r.activityId, r.source, r.points, r.visibility, r.notes, r.updatedAt, id]
  );
  return { ...merged, updatedAt: r.updatedAt };
}

export async function deleteRoute(id: string, db?: SqlDatabase): Promise<boolean> {
  const d = db ?? (await getDb());
  const existed = await d.getFirstAsync<{ id: string }>('SELECT id FROM routes WHERE id = ?;', [
    id,
  ]);
  if (!existed) return false;
  await d.runAsync('DELETE FROM routes WHERE id = ?;', [id]);
  return true;
}
