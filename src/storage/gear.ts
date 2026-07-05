/**
 * gear.ts — typed CRUD for the gear table (migration 010, quiver entity E1).
 *
 * Gear rows are mutable in place like session templates: edits overwrite,
 * retire sets `retiredAt` (the honest end of service — the accrued history
 * stays), and delete is a hard remove reserved for mistakes. Everything the
 * app *derives* about gear (mileage, days) is computed on read from session
 * observations (core/gear.ts) — nothing here stores a total.
 *
 * Ids are the caller's job (uuidv7 from @/lib/id, expo-crypto backed — the
 * same pattern observations.ts callers use), so tests stay deterministic.
 * Every function accepts an optional `db` for tests; the app uses the
 * expo-sqlite singleton by default (matches observations.ts / settings.ts).
 */
import type { Gear, GearCategory } from '@core/gear';
import type { ISOInstant } from '@core/observation';
import { getDb, type SqlDatabase } from './db';

/** A persisted gear row: the core Gear plus its bookkeeping timestamp. */
export type GearRecord = Gear & { createdAt: ISOInstant };

const COLUMNS = 'id, name, category, parentId, acquiredAt, retiredAt, spec, notes, createdAt';

interface GearRow {
  id: string;
  name: string;
  category: string;
  parentId: string | null;
  acquiredAt: string | null;
  retiredAt: string | null;
  spec: string | null;
  notes: string | null;
  createdAt: string;
}

function rowToGear(r: GearRow): GearRecord {
  // Corrupt spec JSON degrades to an absent spec (the gear itself is still
  // real), never a throw that would take the whole quiver list down.
  let spec: unknown;
  if (r.spec != null) {
    try {
      spec = JSON.parse(r.spec);
    } catch {
      spec = undefined;
    }
  }
  return {
    id: r.id,
    name: r.name,
    category: r.category as GearCategory,
    ...(r.parentId != null ? { parentId: r.parentId } : {}),
    ...(r.acquiredAt != null ? { acquiredAt: r.acquiredAt } : {}),
    ...(r.retiredAt != null ? { retiredAt: r.retiredAt } : {}),
    ...(spec !== undefined ? { spec } : {}),
    ...(r.notes != null ? { notes: r.notes } : {}),
    createdAt: r.createdAt,
  } as GearRecord;
}

export async function createGear(g: GearRecord, db?: SqlDatabase): Promise<GearRecord> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT INTO gear (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      g.id,
      g.name,
      g.category,
      g.parentId ?? null,
      g.acquiredAt ?? null,
      g.retiredAt ?? null,
      g.spec !== undefined ? JSON.stringify(g.spec) : null,
      g.notes ?? null,
      g.createdAt,
    ]
  );
  return g;
}

export async function getGearById(id: string, db?: SqlDatabase): Promise<GearRecord | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<GearRow>(`SELECT ${COLUMNS} FROM gear WHERE id = ?;`, [id]);
  return row ? rowToGear(row) : null;
}

export type ListGearOptions = {
  includeRetired?: boolean; // default false: the active quiver
};

/** Active gear by default — retired rows are history, opted into explicitly. */
export async function listGear(
  opts: ListGearOptions = {},
  db?: SqlDatabase
): Promise<GearRecord[]> {
  const d = db ?? (await getDb());
  const where = opts.includeRetired ? '' : 'WHERE retiredAt IS NULL';
  const rows = await d.getAllAsync<GearRow>(
    `SELECT ${COLUMNS} FROM gear ${where} ORDER BY category ASC, createdAt ASC;`
  );
  return rows.map(rowToGear);
}

/**
 * Merge a partial change into an existing row and persist it. Throws when the
 * id doesn't exist (matches updateObservation / updateTemplate).
 */
export async function updateGear(
  id: string,
  patch: Partial<Omit<GearRecord, 'id' | 'createdAt'>>,
  db?: SqlDatabase
): Promise<GearRecord> {
  const d = db ?? (await getDb());
  const existing = await getGearById(id, d);
  if (!existing) {
    throw new Error(`updateGear: no gear with id ${id}`);
  }
  const merged = { ...existing, ...patch, id } as GearRecord;
  await d.runAsync(
    `UPDATE gear
     SET name = ?, category = ?, parentId = ?, acquiredAt = ?,
         retiredAt = ?, spec = ?, notes = ?
     WHERE id = ?;`,
    [
      merged.name,
      merged.category,
      merged.parentId ?? null,
      merged.acquiredAt ?? null,
      merged.retiredAt ?? null,
      merged.spec !== undefined ? JSON.stringify(merged.spec) : null,
      merged.notes ?? null,
      id,
    ]
  );
  return merged;
}

/**
 * End of service: stamps `retiredAt`, never deletes — the sessions this gear
 * accrued stay attributed to it forever. The caller supplies the date (the
 * screen passes today), keeping storage deterministic for tests.
 */
export async function retireGear(
  id: string,
  retiredAt: string,
  db?: SqlDatabase
): Promise<GearRecord> {
  return updateGear(id, { retiredAt }, db);
}

/** Hard delete — for rows created by mistake, not for gear that lived a life
 *  (that's retireGear). Returns false when nothing matched the id. */
export async function deleteGear(id: string, db?: SqlDatabase): Promise<boolean> {
  const d = db ?? (await getDb());
  const existed = await d.getFirstAsync<{ id: string }>('SELECT id FROM gear WHERE id = ?;', [id]);
  if (!existed) return false;
  await d.runAsync('DELETE FROM gear WHERE id = ?;', [id]);
  return true;
}
