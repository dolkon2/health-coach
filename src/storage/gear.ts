/**
 * gear.ts — typed access to the gear + kits tables (migration 010).
 *
 * Modeled on mealTemplates.ts (COLUMNS const, row mappers, injected
 * SqlDatabase). Two deliberate asymmetries:
 *
 *   - Gear has NO hard-delete. Sessions reference gear ids, so removal is
 *     retirement (`retireGearItem` sets retired_on). `listGear` excludes
 *     retired items by default; `getGearItem` resolves retired items too —
 *     history must always resolve ("what boat was that?" outlives the boat).
 *   - Kits MAY be hard-deleted: picking a kit denormalizes the resolved
 *     gearIds onto the session's WindBlock (kitId kept only as provenance),
 *     so a deleted kit orphans nothing.
 *
 * `spec` (GearSpec) and `gear_ids` are JSON TEXT columns — the shapes ride
 * whole and evolve without DDL.
 */
import type { GearCategory, GearItem, GearSpec, Kit } from '@core/gear';
import { getDb, type SqlDatabase } from './db';

const GEAR_COLUMNS = 'id, name, category, spec, acquired_on, retired_on, notes, created_at';

interface GearRow {
  id: string;
  name: string;
  category: string;
  spec: string | null;
  acquired_on: string | null;
  retired_on: string | null;
  notes: string | null;
  created_at: string;
}

function rowToGearItem(r: GearRow): GearItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category as GearCategory,
    // Omit-when-absent: an absent spec/date/note stays absent, never null-filled.
    ...(r.spec ? { spec: JSON.parse(r.spec) as GearSpec } : {}),
    ...(r.acquired_on ? { acquiredOn: r.acquired_on } : {}),
    ...(r.retired_on ? { retiredOn: r.retired_on } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    createdAt: r.created_at,
  };
}

export async function createGearItem(g: GearItem, db?: SqlDatabase): Promise<GearItem> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT INTO gear (${GEAR_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      g.id,
      g.name,
      g.category,
      g.spec ? JSON.stringify(g.spec) : null,
      g.acquiredOn ?? null,
      g.retiredOn ?? null,
      g.notes ?? null,
      g.createdAt,
    ]
  );
  return g;
}

export async function updateGearItem(g: GearItem, db?: SqlDatabase): Promise<GearItem> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `UPDATE gear
        SET name = ?, category = ?, spec = ?, acquired_on = ?, retired_on = ?, notes = ?
      WHERE id = ?;`,
    [
      g.name,
      g.category,
      g.spec ? JSON.stringify(g.spec) : null,
      g.acquiredOn ?? null,
      g.retiredOn ?? null,
      g.notes ?? null,
      g.id,
    ]
  );
  return g;
}

/**
 * Soft delete — the ONLY removal gear has. Sessions keep the ref; a retired
 * wing still explains an old session.
 */
export async function retireGearItem(
  id: string,
  retiredOn: string,
  db?: SqlDatabase
): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(`UPDATE gear SET retired_on = ? WHERE id = ?;`, [retiredOn, id]);
}

/** Active quiver by default; pass includeRetired for the full history view. */
export async function listGear(
  opts: { includeRetired?: boolean } = {},
  db?: SqlDatabase
): Promise<GearItem[]> {
  const d = db ?? (await getDb());
  const where = opts.includeRetired ? '' : 'WHERE retired_on IS NULL';
  const rows = await d.getAllAsync<GearRow>(
    `SELECT ${GEAR_COLUMNS} FROM gear ${where} ORDER BY created_at DESC;`
  );
  return rows.map(rowToGearItem);
}

/** Resolves retired items too — session history must always resolve. */
export async function getGearItem(id: string, db?: SqlDatabase): Promise<GearItem | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<GearRow>(
    `SELECT ${GEAR_COLUMNS} FROM gear WHERE id = ?;`,
    [id]
  );
  return row ? rowToGearItem(row) : null;
}

const KIT_COLUMNS = 'id, name, gear_ids, created_at';

interface KitRow {
  id: string;
  name: string;
  gear_ids: string;
  created_at: string;
}

function rowToKit(r: KitRow): Kit {
  return {
    id: r.id,
    name: r.name,
    gearIds: JSON.parse(r.gear_ids) as string[],
    createdAt: r.created_at,
  };
}

export async function createKit(k: Kit, db?: SqlDatabase): Promise<Kit> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT INTO kits (${KIT_COLUMNS}) VALUES (?, ?, ?, ?);`,
    [k.id, k.name, JSON.stringify(k.gearIds), k.createdAt]
  );
  return k;
}

/** Hard delete IS allowed — WindBlock denormalizes resolved gearIds. */
export async function deleteKit(id: string, db?: SqlDatabase): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(`DELETE FROM kits WHERE id = ?;`, [id]);
}

export async function listKits(db?: SqlDatabase): Promise<Kit[]> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<KitRow>(
    `SELECT ${KIT_COLUMNS} FROM kits ORDER BY created_at DESC;`
  );
  return rows.map(rowToKit);
}

export async function getKit(id: string, db?: SqlDatabase): Promise<Kit | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<KitRow>(
    `SELECT ${KIT_COLUMNS} FROM kits WHERE id = ?;`,
    [id]
  );
  return row ? rowToKit(row) : null;
}
