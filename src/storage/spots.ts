/**
 * spots.ts — typed access to the spots table (migration 010).
 *
 * Modeled on mealTemplates.ts (COLUMNS const, row mapper, injected
 * SqlDatabase). No hard delete: session blocks denormalize the names they
 * display, but spotId refs should stay resolvable — soft enough for v1.
 */
import type { Spot } from '@core/spot';
import { getDb, type SqlDatabase } from './db';

const COLUMNS = 'id, name, kind, lat, lng, river_name, section_name, gauge_site_id, notes, created_at';

interface SpotRow {
  id: string;
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
  river_name: string | null;
  section_name: string | null;
  gauge_site_id: string | null;
  notes: string | null;
  created_at: string;
}

function rowToSpot(r: SpotRow): Spot {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as Spot['kind'],
    // Omit-when-absent — a spot without coords stays coord-less (null ≠ 0).
    ...(r.lat !== null ? { lat: r.lat } : {}),
    ...(r.lng !== null ? { lng: r.lng } : {}),
    ...(r.river_name ? { riverName: r.river_name } : {}),
    ...(r.section_name ? { sectionName: r.section_name } : {}),
    ...(r.gauge_site_id ? { gaugeSiteId: r.gauge_site_id } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    createdAt: r.created_at,
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
        SET name = ?, kind = ?, lat = ?, lng = ?, river_name = ?, section_name = ?,
            gauge_site_id = ?, notes = ?
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
      `SELECT ${COLUMNS} FROM spots WHERE kind = ? ORDER BY created_at DESC;`,
      [opts.kind]
    );
    return rows.map(rowToSpot);
  }
  const rows = await d.getAllAsync<SpotRow>(
    `SELECT ${COLUMNS} FROM spots ORDER BY created_at DESC;`
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
