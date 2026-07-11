/**
 * spots.ts — typed CRUD for the spots table (canonical schema, 014).
 *
 * One module, two dimension heritages (2026-07-09 merge): Water's typed
 * river-column view (createSpot/updateSpot(spot)/listSpots/getSpot) and
 * Sky's kind+meta view (createSpot/updateSpot(id, patch)/getSpotById/
 * deleteSpot). Both read/write the SAME canonical columns; `updateSpot` is
 * overloaded to carry both call shapes so neither branch's tested surface
 * changed at merge time.
 *
 * No retirement lifecycle: session blocks denormalize the names they
 * display, so `deleteSpot` hard-removes (Sky's rule — a spot you never fly
 * again just stops accumulating snapshots), while Water simply never calls
 * delete. createdAt/updatedAt are storage bookkeeping; writes stamp
 * `new Date().toISOString()` by default, tests pass `nowIso` for determinism.
 */
import type { Spot } from '@core/spot';
import { getDb, type SqlDatabase, type SqlParam } from './db';
import { spotToRow, rowToSpot, type SpotRow } from './serialize';

const COLUMNS =
  'id, name, lat, lng, kind, sport, meta, riverName, sectionName, gaugeSiteId, notes, createdAt, updatedAt';

export async function createSpot(
  spot: Spot,
  db?: SqlDatabase,
  nowIso?: string
): Promise<Spot> {
  const d = db ?? (await getDb());
  const now = nowIso ?? new Date().toISOString();
  const r = spotToRow(spot, spot.createdAt ?? now, now);
  await d.runAsync(
    `INSERT INTO spots (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      r.id,
      r.name,
      r.lat,
      r.lng,
      r.kind,
      r.sport,
      r.meta,
      r.riverName,
      r.sectionName,
      r.gaugeSiteId,
      r.notes,
      r.createdAt,
      r.updatedAt,
    ]
  );
  return spot;
}

export type ListSpotsOptions = {
  kind?: string;
  sport?: string;
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
  if (opts.sport) {
    where.push('sport = ?');
    params.push(opts.sport);
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

/** Water's name for the same lookup — session history must always resolve. */
export async function getSpot(id: string, db?: SqlDatabase): Promise<Spot | null> {
  return getSpotById(id, db);
}

/**
 * Merge a change into an existing spot and persist it. Two call shapes, one
 * per dimension heritage:
 *   updateSpot(spot)        — Water: a whole Spot, matched by spot.id
 *   updateSpot(id, patch)   — Sky: merge a partial onto the stored row
 * `createdAt` is preserved; `updatedAt` is stamped from `nowIso` (or write time).
 */
export async function updateSpot(spot: Spot, db?: SqlDatabase, nowIso?: string): Promise<Spot>;
export async function updateSpot(
  id: string,
  patch: Partial<Omit<Spot, 'id'>>,
  db?: SqlDatabase,
  nowIso?: string
): Promise<Spot>;
export async function updateSpot(
  spotOrId: Spot | string,
  patchOrDb?: Partial<Omit<Spot, 'id'>> | SqlDatabase,
  dbOrNow?: SqlDatabase | string,
  maybeNow?: string
): Promise<Spot> {
  let id: string;
  let patch: Partial<Omit<Spot, 'id'>>;
  let db: SqlDatabase | undefined;
  let nowIso: string | undefined;
  if (typeof spotOrId === 'string') {
    id = spotOrId;
    patch = (patchOrDb ?? {}) as Partial<Omit<Spot, 'id'>>;
    db = dbOrNow as SqlDatabase | undefined;
    nowIso = maybeNow;
  } else {
    id = spotOrId.id;
    patch = spotOrId;
    db = patchOrDb as SqlDatabase | undefined;
    nowIso = dbOrNow as string | undefined;
  }

  const d = db ?? (await getDb());
  const existing = await getSpotById(id, d);
  if (!existing) {
    throw new Error(`updateSpot: no spot with id ${id}`);
  }
  const merged: Spot = { ...existing, ...patch, id };
  const now = nowIso ?? new Date().toISOString();
  const r = spotToRow(merged, merged.createdAt ?? now, now); // r.createdAt unused — the UPDATE never touches it
  await d.runAsync(
    `UPDATE spots
     SET name = ?, lat = ?, lng = ?, kind = ?, sport = ?, meta = ?, riverName = ?, sectionName = ?,
         gaugeSiteId = ?, notes = ?, updatedAt = ?
     WHERE id = ?;`,
    [
      r.name,
      r.lat,
      r.lng,
      r.kind,
      r.sport,
      r.meta,
      r.riverName,
      r.sectionName,
      r.gaugeSiteId,
      r.notes,
      r.updatedAt,
      id,
    ]
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
