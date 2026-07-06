/**
 * spots.ts — typed CRUD for the spots table (Spot/place entity, migration 011).
 *
 * Spots are places, not Observations — no soft-delete lifecycle like gear's
 * retirement; `deleteSpot` hard-removes (a spot you never fly again just stops
 * accumulating snapshots). createdAt/updatedAt are storage bookkeeping (row
 * columns, not Spot fields); writes stamp `new Date().toISOString()` by
 * default, tests pass `nowIso` for determinism.
 *
 * Every function accepts an optional `db` for tests; the app uses the
 * expo-sqlite singleton by default (matches gear.ts and benchmarks.ts).
 */
import type { Spot } from '@core/spot';
import { getDb, type SqlDatabase, type SqlParam } from './db';
import { spotToRow, rowToSpot, type SpotRow } from './serialize';

const COLUMNS = 'id, name, lat, lng, kind, meta, notes, createdAt, updatedAt';

export async function createSpot(
  spot: Spot,
  db?: SqlDatabase,
  nowIso?: string
): Promise<Spot> {
  const d = db ?? (await getDb());
  const now = nowIso ?? new Date().toISOString();
  const r = spotToRow(spot, now, now);
  await d.runAsync(
    `INSERT INTO spots (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [r.id, r.name, r.lat, r.lng, r.kind, r.meta, r.notes, r.createdAt, r.updatedAt]
  );
  return spot;
}

export type ListSpotsOptions = {
  kind?: string;
};

export async function listSpots(
  opts: ListSpotsOptions = {},
  db?: SqlDatabase
): Promise<Spot[]> {
  const d = db ?? (await getDb());
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (opts.kind) {
    where.push('kind = ?');
    params.push(opts.kind);
  }
  const rows = await d.getAllAsync<SpotRow>(
    `SELECT ${COLUMNS} FROM spots
     ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY createdAt DESC;`,
    params
  );
  return rows.map(rowToSpot);
}

export async function getSpotById(id: string, db?: SqlDatabase): Promise<Spot | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<SpotRow>(`SELECT ${COLUMNS} FROM spots WHERE id = ?;`, [
    id,
  ]);
  return row ? rowToSpot(row) : null;
}

/**
 * Merge a partial change into an existing spot and persist it. `createdAt` is
 * preserved; `updatedAt` is stamped from `nowIso` (or write time).
 */
export async function updateSpot(
  id: string,
  patch: Partial<Omit<Spot, 'id'>>,
  db?: SqlDatabase,
  nowIso?: string
): Promise<Spot> {
  const d = db ?? (await getDb());
  const existing = await getSpotById(id, d);
  if (!existing) {
    throw new Error(`updateSpot: no spot with id ${id}`);
  }
  const merged: Spot = { ...existing, ...patch, id };
  const now = nowIso ?? new Date().toISOString();
  const r = spotToRow(merged, now, now); // r.createdAt unused — the UPDATE never touches it
  await d.runAsync(
    `UPDATE spots
     SET name = ?, lat = ?, lng = ?, kind = ?, meta = ?, notes = ?, updatedAt = ?
     WHERE id = ?;`,
    [r.name, r.lat, r.lng, r.kind, r.meta, r.notes, r.updatedAt, id]
  );
  return merged;
}

export async function deleteSpot(id: string, db?: SqlDatabase): Promise<boolean> {
  const d = db ?? (await getDb());
  const existed = await d.getFirstAsync<{ id: string }>(
    'SELECT id FROM spots WHERE id = ?;',
    [id]
  );
  if (!existed) return false;
  await d.runAsync('DELETE FROM spots WHERE id = ?;', [id]);
  return true;
}
