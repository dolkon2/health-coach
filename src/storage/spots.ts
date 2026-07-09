/**
 * spots.ts — typed access to the spots table (canonical schema, 014).
 *
 * Modeled on mealTemplates.ts (COLUMNS const, row mapper, injected
 * SqlDatabase). No hard delete: session blocks denormalize the names they
 * display, but spotId refs should stay resolvable — soft enough for v1.
 *
 * Ported to the canonical camelCase columns at the 2026-07-09 dimension
 * merge (the canonical spots table = Water's typed columns + Sky's
 * kind/meta bag; this module reads/writes the typed-column view).
 */
import type { Spot } from '@core/spot';
import { getDb, type SqlDatabase } from './db';

const COLUMNS = 'id, name, kind, lat, lng, riverName, sectionName, gaugeSiteId, notes, createdAt';

interface SpotRow {
  id: string;
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
  riverName: string | null;
  sectionName: string | null;
  gaugeSiteId: string | null;
  notes: string | null;
  createdAt: string;
}

function rowToSpot(r: SpotRow): Spot {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as Spot['kind'],
    // Omit-when-absent — a spot without coords stays coord-less (null ≠ 0).
    ...(r.lat !== null ? { lat: r.lat } : {}),
    ...(r.lng !== null ? { lng: r.lng } : {}),
    ...(r.riverName ? { riverName: r.riverName } : {}),
    ...(r.sectionName ? { sectionName: r.sectionName } : {}),
    ...(r.gaugeSiteId ? { gaugeSiteId: r.gaugeSiteId } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    createdAt: r.createdAt,
  };
}

export async function createSpot(s: Spot, db?: SqlDatabase): Promise<Spot> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT INTO spots (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      s.id,
      s.name,
      s.kind,
      s.lat ?? null,
      s.lng ?? null,
      s.riverName ?? null,
      s.sectionName ?? null,
      s.gaugeSiteId ?? null,
      s.notes ?? null,
      s.createdAt,
    ]
  );
  return s;
}

export async function updateSpot(s: Spot, db?: SqlDatabase): Promise<Spot> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `UPDATE spots
        SET name = ?, kind = ?, lat = ?, lng = ?, riverName = ?, sectionName = ?,
            gaugeSiteId = ?, notes = ?
      WHERE id = ?;`,
    [
      s.name,
      s.kind,
      s.lat ?? null,
      s.lng ?? null,
      s.riverName ?? null,
      s.sectionName ?? null,
      s.gaugeSiteId ?? null,
      s.notes ?? null,
      s.id,
    ]
  );
  return s;
}

export async function listSpots(
  opts: { kind?: Spot['kind'] } = {},
  db?: SqlDatabase
): Promise<Spot[]> {
  const d = db ?? (await getDb());
  if (opts.kind) {
    const rows = await d.getAllAsync<SpotRow>(
      `SELECT ${COLUMNS} FROM spots WHERE kind = ? ORDER BY createdAt DESC;`,
      [opts.kind]
    );
    return rows.map(rowToSpot);
  }
  const rows = await d.getAllAsync<SpotRow>(
    `SELECT ${COLUMNS} FROM spots ORDER BY createdAt DESC;`
  );
  return rows.map(rowToSpot);
}

export async function getSpot(id: string, db?: SqlDatabase): Promise<Spot | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<SpotRow>(
    `SELECT ${COLUMNS} FROM spots WHERE id = ?;`,
    [id]
  );
  return row ? rowToSpot(row) : null;
}
