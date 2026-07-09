/**
 * gear.ts — typed CRUD for the gear table (quiver, migration 010).
 *
 * Gear items are possessions, not Observations. Retirement is the default
 * end-of-life: `retireGear` stamps `retiredOn` and the row stays — a retired
 * wing's history is still real. `deleteGear` hard-removes and exists for
 * records created in error (matches deleteTemplate / deleteMealTemplate).
 *
 * createdAt/updatedAt are storage bookkeeping (row columns, not GearItem
 * fields). Writes stamp `new Date().toISOString()` by default; tests pass
 * `nowIso` for determinism. `category` is a top-level GearItem field, written
 * straight to its own column (no longer derived from a nested spec.category).
 *
 * Every function accepts an optional `db` for tests; the app uses the
 * expo-sqlite singleton by default (matches benchmarks.ts and observations.ts).
 */
import type { GearCategory, GearItem } from '@core/gear';
import { getDb, type SqlDatabase, type SqlParam } from './db';
import { gearToRow, rowToGear, type GearRow } from './serialize';

const COLUMNS =
  'id, category, name, spec, acquiredOn, retiredOn, notes, createdAt, updatedAt';

export async function createGear(
  item: GearItem,
  db?: SqlDatabase,
  nowIso?: string
): Promise<GearItem> {
  const d = db ?? (await getDb());
  const now = nowIso ?? new Date().toISOString();
  const r = gearToRow(item, now, now);
  await d.runAsync(
    `INSERT INTO gear (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      r.id,
      r.category,
      r.name,
      r.spec,
      r.acquiredOn,
      r.retiredOn,
      r.notes,
      r.createdAt,
      r.updatedAt,
    ]
  );
  return item;
}

export type ListGearOptions = {
  category?: GearCategory;
  includeRetired?: boolean; // default false: active quiver only (retiredOn IS NULL)
};

export async function listGear(
  opts: ListGearOptions = {},
  db?: SqlDatabase
): Promise<GearItem[]> {
  const d = db ?? (await getDb());
  const where: string[] = [];
  const params: SqlParam[] = [];
  if (opts.category) {
    where.push('category = ?');
    params.push(opts.category);
  }
  if (!opts.includeRetired) {
    where.push('retiredOn IS NULL');
  }
  const rows = await d.getAllAsync<GearRow>(
    `SELECT ${COLUMNS} FROM gear
     ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY createdAt DESC;`,
    params
  );
  return rows.map(rowToGear);
}

export async function getGearById(
  id: string,
  db?: SqlDatabase
): Promise<GearItem | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<GearRow>(
    `SELECT ${COLUMNS} FROM gear WHERE id = ?;`,
    [id]
  );
  return row ? rowToGear(row) : null;
}

/**
 * Merge a partial change into an existing item and persist it. `createdAt` is
 * preserved; `updatedAt` is stamped from `nowIso` (or write time).
 */
export async function updateGear(
  id: string,
  patch: Partial<Omit<GearItem, 'id'>>,
  db?: SqlDatabase,
  nowIso?: string
): Promise<GearItem> {
  const d = db ?? (await getDb());
  const existing = await getGearById(id, d);
  if (!existing) {
    throw new Error(`updateGear: no gear item with id ${id}`);
  }
  // Same pattern as earth's storage/gear.ts: a spread across a discriminated
  // union loses the category/spec narrowing, so this asserts rather than
  // relying on structural inference (the caller is responsible for passing
  // category+spec together when changing what kind of gear a row is).
  const merged = { ...existing, ...patch, id } as GearItem;
  const now = nowIso ?? new Date().toISOString();
  const r = gearToRow(merged, now, now); // r.createdAt unused — the UPDATE never touches it
  await d.runAsync(
    `UPDATE gear
     SET category = ?, name = ?, spec = ?, acquiredOn = ?, retiredOn = ?,
         notes = ?, updatedAt = ?
     WHERE id = ?;`,
    [r.category, r.name, r.spec, r.acquiredOn, r.retiredOn, r.notes, r.updatedAt, id]
  );
  return merged;
}

/**
 * Soft end-of-life: stamps `retiredOn`, keeps the row. Throws when the id
 * does not exist (via updateGear).
 */
export async function retireGear(
  id: string,
  retiredOnIso: string,
  db?: SqlDatabase,
  nowIso?: string
): Promise<GearItem> {
  return updateGear(id, { retiredOn: retiredOnIso }, db, nowIso);
}

/** Hard delete — for records created in error only; retireGear is the default. */
export async function deleteGear(id: string, db?: SqlDatabase): Promise<boolean> {
  const d = db ?? (await getDb());
  const existed = await d.getFirstAsync<{ id: string }>(
    'SELECT id FROM gear WHERE id = ?;',
    [id]
  );
  if (!existed) return false;
  await d.runAsync('DELETE FROM gear WHERE id = ?;', [id]);
  return true;
}
